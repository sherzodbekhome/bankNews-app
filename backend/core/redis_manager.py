"""
Redis Manager — distributed rate limiting + broadcast queue.
Redis yo'q bo'lsa in-memory fallback ishlatadi (bitta process uchun).
"""
import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    _REDIS_LIB = True
except ImportError:
    aioredis = None
    _REDIS_LIB = False
    logger.warning("redis moduli o'rnatilmagan — in-memory fallback ishlatiladi")

QUEUE_KEY = "broadcast_queue"


class RedisManager:
    def __init__(self):
        self._redis = None
        self._mem_rl: Dict[int, List[float]] = defaultdict(list)  # fallback

    # ── Ulanish ────────────────────────────────────────────────────────────────

    async def connect(self, url: str):
        if not _REDIS_LIB or not url:
            return
        try:
            self._redis = aioredis.from_url(
                url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
            )
            await self._redis.ping()
            logger.info("Redis ulanish muvaffaqiyatli")
        except Exception as e:
            logger.warning(f"Redis ulanmadi — in-memory fallback: {e}")
            self._redis = None

    async def close(self):
        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass

    def _ok(self) -> bool:
        return self._redis is not None

    # ── Rate Limiting ──────────────────────────────────────────────────────────

    async def check_rate_limit(self, user_id: int, limit: int = 20, window: int = 60) -> bool:
        """True — ruxsat, False — limit oshdi"""
        if self._ok():
            return await self._redis_rate_limit(user_id, limit, window)
        return self._mem_rate_limit(user_id, limit, window)

    async def _redis_rate_limit(self, user_id: int, limit: int, window: int) -> bool:
        key = f"rl:{user_id}"
        try:
            pipe = self._redis.pipeline()
            now = time.time()
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window + 1)
            results = await pipe.execute()
            count = results[2]
            return count <= limit
        except Exception as e:
            logger.debug(f"Redis rate limit xatosi: {e}")
            return self._mem_rate_limit(user_id, limit, window)

    def _mem_rate_limit(self, user_id: int, limit: int, window: int) -> bool:
        now = time.time()
        history = self._mem_rl[user_id]
        self._mem_rl[user_id] = [t for t in history if now - t < window]
        self._mem_rl[user_id].append(now)
        return len(self._mem_rl[user_id]) <= limit

    # ── Broadcast Queue ────────────────────────────────────────────────────────

    async def enqueue_broadcast(self, user_ids: List[int], text: str, parse_mode: str = "HTML"):
        """Broadcast worker uchun Redis navbatiga qo'shish"""
        task = {"user_ids": user_ids, "text": text, "parse_mode": parse_mode}
        if self._ok():
            try:
                await self._redis.lpush(QUEUE_KEY, json.dumps(task))
                return
            except Exception as e:
                logger.error(f"enqueue_broadcast Redis xatosi: {e}")
        # Redis yo'q — to'g'ridan-to'g'ri xabar yuborish bot.py da amalga oshiriladi
        logger.warning("Redis yo'q — broadcast navbatga qo'shilmadi")

    # ── Cache (ixtiyoriy) ──────────────────────────────────────────────────────

    async def set_cache(self, key: str, value: Any, ttl: int = 300):
        if not self._ok():
            return
        try:
            await self._redis.setex(key, ttl, json.dumps(value, ensure_ascii=False))
        except Exception:
            pass

    async def get_cache(self, key: str) -> Any:
        if not self._ok():
            return None
        try:
            raw = await self._redis.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            return None


redis_mgr = RedisManager()
