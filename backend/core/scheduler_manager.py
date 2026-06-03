"""
APScheduler — kanalga avtomatik post yuborish.
Har kuni soat 09:00, 14:00 va 18:00 da Toshkent vaqti bo'yicha.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    _APScheduler = True
except ImportError:
    AsyncIOScheduler = None
    CronTrigger      = None
    _APScheduler     = False
    logger.warning("apscheduler o'rnatilmagan — jadval o'chirilgan")


class ChannelScheduler:
    def __init__(self):
        self._scheduler: Optional[AsyncIOScheduler] = (
            AsyncIOScheduler(timezone="Asia/Tashkent") if _APScheduler else None
        )
        self._bot  = None
        self._channels: List[str] = []

    def init(self, bot, channels: List[str]):
        self._bot      = bot
        self._channels = channels

    def start(self):
        if not self._scheduler:
            return
        if not self._channels:
            logger.warning("CHANNELS bo'sh — jadval ishlamaydi")
            return

        # 09:35 — valyuta kurslari (ertalabki)
        self._scheduler.add_job(
            self._post_currency,
            CronTrigger(hour=9, minute=35, timezone="Asia/Tashkent"),
            id="morning_rates", replace_existing=True,
        )
        # 12:10 — valyuta kurslari (kunduzgi)
        self._scheduler.add_job(
            self._post_currency,
            CronTrigger(hour=12, minute=10, timezone="Asia/Tashkent"),
            id="midday_rates", replace_existing=True,
        )
        # 18:00 — kripto + metallar (kechki)
        self._scheduler.add_job(
            self._post_crypto_metals,
            CronTrigger(hour=18, minute=0, timezone="Asia/Tashkent"),
            id="evening_crypto", replace_existing=True,
        )

        self._scheduler.start()
        logger.info("Jadval ishga tushdi (09:35, 12:10, 18:00 Toshkent)")

    def stop(self):
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    # ── Post yuboruvchi metodlar ──────────────────────────────────────────────

    async def _acquire_post_lock(self, job_id: str, ttl: int = 300) -> bool:
        """
        Redis lock — faqat bitta instance post yuborsin.
        True qaytarsa — lock olindi, post yuborish mumkin.
        False qaytarsa — boshqa instance allaqachon yuboryapti.
        """
        try:
            from core.redis_manager import redis_mgr
            if redis_mgr._ok():
                key = f"post_lock:{job_id}"
                result = await redis_mgr._redis.set(key, "1", nx=True, ex=ttl)
                return result is not None
        except Exception:
            pass
        return True  # Redis yo'q bo'lsa — har doim ruxsat

    async def _send(self, text: str, job_id: str = ""):
        if not self._bot or not self._channels:
            return

        # Redis lock — ikki instance bir vaqtda post yubora olmasin
        if job_id:
            if not await self._acquire_post_lock(job_id):
                logger.warning(f"Post lock band ({job_id}) — boshqa instance yuboryapti, o'tkazib yuborildi")
                return

        for channel in self._channels:
            try:
                await self._bot.send_message(
                    channel, text,
                    parse_mode="HTML",
                    disable_web_page_preview=True,
                )
                logger.info(f"Kanal posti yuborildi → {channel}")
            except Exception as e:
                logger.error(f"Kanal post xatosi ({channel}): {e}")
            await asyncio.sleep(0.5)

    async def build_currency_text(self) -> Optional[str]:
        """09:35 / 12:10 post matni — kanal va admin uchun bir xil"""
        from backend.api_handlers import CBUHandler, BankUzHandler
        from telegram_bot.bank_rates_formatter import BankRatesFormatter
        from telegram_bot.ai_analyzer import get_ai_analyzer

        cbu_data, bank_data = await asyncio.gather(
            CBUHandler.get_rates(),
            BankUzHandler.get_commercial_rates(),
            return_exceptions=True,
        )
        if isinstance(cbu_data,  Exception): cbu_data  = None
        if isinstance(bank_data, Exception): bank_data = None

        if cbu_data:
            from core.cache_manager import CacheManager
            rates_flat = {k: v["rate"] for k, v in cbu_data.items() if "rate" in v}
            CacheManager.set_cache("currency", rates_flat, ttl=3600)

        cbu_rates = {}
        if cbu_data:
            for ccy, info in cbu_data.items():
                cbu_rates[ccy]                   = info.get("rate", 0)
                cbu_rates[f"diff_{ccy.lower()}"] = info.get("diff", 0)
        if bank_data and cbu_rates:
            bank_data["cbu_rate"] = cbu_rates

        text = BankRatesFormatter.format_complete_rates(
            currency_rates=cbu_rates,
            bank_data=bank_data,
        )
        ai = get_ai_analyzer()
        analysis = await ai.analyze_currency(cbu_rates, bank_data)
        if analysis:
            text += f"\n\n🤖 <b>AI Tahlili</b>\n{analysis}"
        text += "\n\n@BankNews_official"
        return text

    async def build_crypto_metals_text(self) -> Optional[str]:
        """18:00 post matni — kanal va admin uchun bir xil"""
        from backend.api_handlers import CryptoHandler, MetalsHandler, CBUHandler
        from telegram_bot.formatters import MessageFormatter
        from telegram_bot.ai_analyzer import get_ai_analyzer

        cbu_data, crypto_data, metals_data = await asyncio.gather(
            CBUHandler.get_rates(),
            CryptoHandler.get_crypto_prices(),
            MetalsHandler.get_metals_prices(),
            return_exceptions=True,
        )
        if isinstance(cbu_data,    Exception): cbu_data    = None
        if isinstance(crypto_data, Exception): crypto_data = None
        if isinstance(metals_data, Exception): metals_data = None

        usd_rate = None
        if cbu_data and "USD" in cbu_data:
            usd_rate = cbu_data["USD"].get("rate")
            from core.cache_manager import CacheManager
            rates_flat = {k: v["rate"] for k, v in cbu_data.items() if "rate" in v}
            CacheManager.set_cache("currency", rates_flat, ttl=3600)

        parts = []
        if crypto_data:
            flat_crypto = {k: v["price"] for k, v in crypto_data.items() if "price" in v}
            parts.append(MessageFormatter.format_crypto_post(flat_crypto, usd_rate))
        if metals_data:
            parts.append(MessageFormatter.format_metals_section(metals_data))

        if crypto_data or metals_data:
            ai = get_ai_analyzer()
            flat_crypto = {k: v["price"] for k, v in (crypto_data or {}).items() if "price" in v}
            analysis = await ai.analyze_crypto_metals(flat_crypto, metals_data or {})
            if analysis:
                parts.append(f"🤖 <b>AI Tahlili</b>\n{analysis}")

        if not parts:
            return None
        text = "\n\n".join(parts)
        text += '\n\n<a href="https://t.me/BankNews_Official_bot">📲 To\'liq kurs va valyuta hisob-kitobi uchun botga kiring</a>'
        text += "\n@BankNews_official"
        return text

    async def _post_currency(self):
        from datetime import date
        job_id = f"currency_{date.today().isoformat()}"
        try:
            text = await self.build_currency_text()
            if text:
                await self._send(text, job_id=job_id)
        except Exception as e:
            logger.error(f"_post_currency xatosi: {e}", exc_info=True)

    async def _post_crypto_metals(self):
        from datetime import date
        job_id = f"crypto_{date.today().isoformat()}"
        try:
            text = await self.build_crypto_metals_text()
            if text:
                await self._send(text, job_id=job_id)
        except Exception as e:
            logger.error(f"_post_crypto_metals xatosi: {e}", exc_info=True)

    # ── Qo'lda ishga tushirish (admin buyrug'i) ───────────────────────────────

    async def trigger_currency_post(self):
        await self._post_currency()

    async def trigger_crypto_post(self):
        await self._post_crypto_metals()


scheduler = ChannelScheduler()



