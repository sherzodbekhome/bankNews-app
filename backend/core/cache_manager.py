"""
In-memory cache — API natijalarini vaqtincha saqlaydi.
CacheUpdater arxa fonda har N daqiqada yangilaydi.
"""
import asyncio
import logging
import time
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class CacheManager:
    _store: Dict[str, Dict] = {}  # {key: {"data": ..., "ts": float, "ttl": int}}

    @classmethod
    def set_cache(cls, key: str, data: Any, ttl: int = 300):
        cls._store[key] = {"data": data, "ts": time.time(), "ttl": ttl}

    @classmethod
    def get_cache(cls, key: str) -> Optional[Any]:
        entry = cls._store.get(key)
        if not entry:
            return None
        if time.time() - entry["ts"] > entry["ttl"]:
            del cls._store[key]
            return None
        return entry["data"]

    @classmethod
    def get_cache_stats(cls) -> Dict:
        now = time.time()
        stats = {}
        for key, entry in cls._store.items():
            age = int(now - entry["ts"])
            ttl = entry["ttl"]
            stats[key] = {"age_sec": age, "ttl": ttl, "valid": age < ttl}
        return stats


# ── Qulay funksiyalar ──────────────────────────────────────────────────────────

async def get_cached_currency_data() -> Optional[Dict]:
    return CacheManager.get_cache("currency")

async def get_cached_crypto_data() -> Optional[Dict]:
    return CacheManager.get_cache("crypto")


# ── Arxa fon yangilovchi ───────────────────────────────────────────────────────

class CacheUpdater:
    """
    Bot ishga tushgandan so'ng arxa fonda ishlaydi.
    Har interval_sec da API handler funksiyalarni chaqirib cache ni yangilaydi.
    """

    def __init__(self):
        self._tasks: list[asyncio.Task] = []

    def register(self, key: str, fetcher: Callable, ttl: int = 300, interval: int = 240):
        """
        key      — CacheManager.set_cache da ishlatiladigan kalit
        fetcher  — async funksiya, ma'lumot qaytaradi yoki None
        ttl      — cache amal qilish vaqti (sekund)
        interval — yangilash oralig'i (sekund, TTL dan oz kichik bo'lishi yaxshi)
        """
        async def _loop():
            await asyncio.sleep(5)  # botning to'liq ishga tushishini kutamiz
            while True:
                try:
                    data = await fetcher()
                    if data:
                        CacheManager.set_cache(key, data, ttl)
                        logger.debug(f"Cache yangilandi: {key}")
                    else:
                        logger.warning(f"Cache fetcher bo'sh qaytdi: {key}")
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"CacheUpdater [{key}] xatosi: {e}")
                await asyncio.sleep(interval)

        task = asyncio.create_task(_loop(), name=f"cache_{key}")
        self._tasks.append(task)
        return task

    def stop(self):
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()


cache_updater = CacheUpdater()
