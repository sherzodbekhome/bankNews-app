"""
Broadcast Worker — alohida process sifatida ishlaydi.
Redis navbatidan xabarlarni o'qib, Telegram ga yuboradi.

Ishga tushirish:
    python broadcast_worker.py

Render.com da ikkinchi servis sifatida qo'shiladi (render.yaml da).
Telegram rate limit: 30 msg/sec — biz 25 ishlatamiz (xavfsiz chegarada).
"""
import asyncio
import json
import logging
import os
import signal
import sys

from aiogram import Bot
from aiogram.enums import ParseMode
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

BOT_TOKEN  = os.getenv("BOT_TOKEN", "")
REDIS_URL  = os.getenv("REDIS_URL", "redis://localhost:6379")
RATE_LIMIT = 25          # xabar/sekund (Telegram maks 30)
CONCURRENCY = 25         # parallel so'rovlar
QUEUE_KEY  = "broadcast_queue"


class BroadcastWorker:
    def __init__(self):
        self.bot   = Bot(token=BOT_TOKEN)
        self.redis = aioredis.from_url(
            REDIS_URL, encoding="utf-8", decode_responses=True
        )
        self._running = True
        self._sem     = asyncio.Semaphore(CONCURRENCY)
        self._interval = 1.0 / RATE_LIMIT  # sekund/xabar

    async def _send_one(self, uid: int, text: str, pm: str) -> bool:
        async with self._sem:
            try:
                await self.bot.send_message(uid, text, parse_mode=pm)
                await asyncio.sleep(self._interval)
                return True
            except Exception as e:
                err = str(e)
                if "blocked" in err or "deactivated" in err or "not found" in err:
                    logger.debug(f"User {uid} botni bloklagan yoki o'chirilgan")
                elif "Too Many Requests" in err:
                    # 429: biroz kutamiz
                    retry_after = 5
                    try:
                        retry_after = int(err.split("retry after ")[-1])
                    except Exception as parse_err:
                        logger.debug(f"retry_after o'qib bo'lmadi, {retry_after}s ishlatiladi: {parse_err}")
                    logger.warning(f"Rate limit 429 — {retry_after}s kutamiz")
                    await asyncio.sleep(retry_after)
                else:
                    logger.warning(f"Send uid={uid}: {e}")
                return False

    async def _process_task(self, task: dict):
        user_ids = task.get("user_ids", [])
        text     = task.get("text", "")
        pm       = task.get("parse_mode", "HTML")

        if not user_ids or not text:
            return

        logger.info(f"Broadcast boshlandi: {len(user_ids)} foydalanuvchi")

        results = await asyncio.gather(
            *[self._send_one(uid, text, pm) for uid in user_ids],
            return_exceptions=True,
        )
        sent  = sum(1 for r in results if r is True)
        failed = len(user_ids) - sent
        logger.info(f"Broadcast tugadi: {sent} yuborildi, {failed} xato")

    async def run(self):
        logger.info("Broadcast worker tayyor. Navbat kutilmoqda...")
        try:
            while self._running:
                try:
                    result = await self.redis.brpop(QUEUE_KEY, timeout=30)
                    if result is None:
                        continue
                    _, raw = result
                    task = json.loads(raw)
                    await self._process_task(task)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    if not self._running:
                        break
                    logger.error(f"Worker loop xatosi: {e}")
                    await asyncio.sleep(5)
        finally:
            await self.shutdown()

    async def shutdown(self):
        if not self._running:
            return
        self._running = False
        try:
            await self.bot.session.close()
        except Exception as e:
            logger.debug(f"Bot sessiyasini yopishda xato: {e}")
        try:
            await self.redis.aclose()
        except Exception as e:
            logger.debug(f"Redis ulanishini yopishda xato: {e}")
        logger.info("Worker yopildi")


async def main():
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN muhit o'zgaruvchisi o'rnatilmagan!")
        sys.exit(1)

    worker = BroadcastWorker()

    loop = asyncio.get_running_loop()

    def _signal_handler():
        logger.info("To'xtatish signali qabul qilindi...")
        worker._running = False  # run() finally bloki shutdown() ni chaqiradi

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass  # Windows da signal handler ishlamaydi

    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
