"""
GET /api/ai/analyze — Gemini AI bozor tahlili
Cache: 5 daqiqa (takroriy so'rovlarni kamaytirish uchun)
"""
import logging
import time
from aiohttp import web
from core.cache_manager import get_cached_currency_data, get_cached_crypto_data

logger = logging.getLogger(__name__)

_cache: dict | None = None
_cache_ts: float = 0.0
_CACHE_TTL = 5 * 60  # 5 daqiqa


async def handle_ai_analyze(request: web.Request) -> web.Response:
    """GET /api/ai/analyze"""
    global _cache, _cache_ts

    now = time.time()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return web.json_response(_cache)

    try:
        from telegram_bot.ai_analyzer import get_ai_analyzer

        currency_data = await get_cached_currency_data() or {}
        crypto_data = await get_cached_crypto_data() or {}

        ai = get_ai_analyzer()
        analysis = await ai.analyze_market(currency_data, crypto_data, {})
        if not analysis:
            analysis = ai.get_default_analysis()

        # Oddiy signal hisoblash: USD kursiga qarab
        usd = currency_data.get("USD", 0)
        signals = _calc_signals(usd, currency_data)

        _cache = {
            "ok": True,
            "analysis": analysis,
            "signals": signals,
            "ts": int(now),
        }
        _cache_ts = now
        return web.json_response(_cache)

    except Exception as e:
        logger.error(f"ai/analyze xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)


def _calc_signals(usd: float, currency_data: dict) -> dict:
    """Bozor signallarini hisoblash (oddiy heuristik)"""
    try:
        eur = currency_data.get("EUR", 0)
        rub = currency_data.get("RUB", 0)

        buy_score = 0
        sell_score = 0

        # USD 12500 dan pastda bo'lsa — sotib olish vaqti
        if usd and usd < 12500:
            buy_score += 1
        elif usd and usd > 13000:
            sell_score += 1

        buy = "🟢 Kuchli" if buy_score > sell_score else ("🔴 Kuchsiz" if sell_score > buy_score else "🟡 O'rtacha")
        sell = "🔴 Kuchsiz" if buy_score > sell_score else ("🟢 Kuchli" if sell_score > buy_score else "🟡 O'rtacha")
        hold = "🟡 Kutish"

        return {"buy": buy, "sell": sell, "hold": hold}
    except Exception as e:
        logger.debug(f"_calc_signals xatosi: {e}")
        return {"buy": "—", "sell": "—", "hold": "—"}
