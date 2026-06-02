"""
Mini App uchun API server — bank.uz real ma'lumotlarini JSON formatda beradi.
Bot bilan birgalikda port 8080 da ishlaydi.

Endpoints:
  GET /api/rates   — CBU rasmiy valyuta kurslari
  GET /api/banks   — bank.uz tijorat banklari kurslari
  GET /api/crypto  — CoinGecko kripto narxlari
  GET /api/metals  — Metallar narxi
  GET /health      — Server holati
"""
import json
import logging
from datetime import datetime

from aiohttp import web

import os

from .api_handlers import BankUzHandler, CBUHandler, CryptoHandler, MetalsHandler, CryptoTopHandler

logger = logging.getLogger(__name__)

# Render/Railway $PORT ishlatadi, lokal uchun 8080
API_PORT = int(os.environ.get("PORT", 8080))

# Ruxsat berilgan originlar (env orqali kengaytirish mumkin)
_ALLOWED_ORIGINS = {
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://sherzodbekhome.github.io,https://web.telegram.org",
    ).split(",")
    if o.strip()
}


def _cors_origin(request: web.Request) -> str:
    origin = request.headers.get("Origin", "")
    if origin in _ALLOWED_ORIGINS:
        return origin
    return list(_ALLOWED_ORIGINS)[0]  # default: birinchi ruxsat etilgan


def _json_response(data: dict, status: int = 200, request: web.Request = None) -> web.Response:
    origin = _cors_origin(request) if request else list(_ALLOWED_ORIGINS)[0]
    return web.Response(
        text=json.dumps(data, ensure_ascii=False),
        content_type="application/json",
        status=status,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Vary": "Origin",
        },
    )


async def handle_rates(request: web.Request) -> web.Response:
    """CBU rasmiy valyuta kurslari"""
    try:
        cbu = await CBUHandler.get_rates()
        if not cbu:
            return _json_response({"error": "CBU API unavailable"}, 503, request)
        rates = {ccy: {"rate": info["rate"], "diff": info["diff"], "date": info["date"]}
                 for ccy, info in cbu.items()}
        return _json_response({"rates": rates, "updated": datetime.now().isoformat()}, request=request)
    except Exception as e:
        logger.error(f"API /rates xatosi: {e}")
        return _json_response({"error": str(e)}, 500, request)


def _banks_for_miniapp(data: dict) -> dict:
    """
    BankUzHandler natijasini Mini App formatiga o'zgartirish.
    Mini App kutadigan format: {USD:[{name,buy,sell,spread},...], EUR:[...], RUB:[...]}
    Har bir valyuta uchun buy va sell ro'yxatlarini bank nomi bo'yicha birlashtiramiz.
    """
    result = {}
    for currency in ("USD", "EUR", "RUB"):
        buy_dict = {n: r for n, r in data.get(f"buying_{currency.lower()}", [])}
        sell_dict = {n: r for n, r in data.get(f"selling_{currency.lower()}", [])}
        all_names = set(buy_dict) | set(sell_dict)
        banks = []
        for name in all_names:
            buy = buy_dict.get(name, 0)
            sell = sell_dict.get(name, 0)
            if buy or sell:
                banks.append({
                    "name": name,
                    "buy": buy,
                    "sell": sell,
                    "spread": (sell - buy) if buy and sell else 0,
                })
        result[currency] = sorted(banks, key=lambda x: x["buy"], reverse=True)
    return result


async def handle_banks(request: web.Request) -> web.Response:
    """bank.uz tijorat banklari kurslari — Mini App formatida"""
    try:
        data = await BankUzHandler.get_commercial_rates()
        if not data:
            return _json_response({"ok": False, "error": "bank.uz unavailable"}, 503, request)
        return _json_response({
            "ok": True,
            "data": _banks_for_miniapp(data),
            "source": "bank.uz",
            "updated": datetime.now().isoformat(),
        }, request=request)
    except Exception as e:
        logger.error(f"API /banks xatosi: {e}")
        return _json_response({"ok": False, "error": str(e)}, 500, request)


async def handle_crypto(request: web.Request) -> web.Response:
    """Kripto narxlari"""
    try:
        prices = await CryptoHandler.get_crypto_prices()
        if not prices:
            return _json_response({"error": "Crypto API unavailable"}, 503, request)
        return _json_response({"crypto": prices, "updated": datetime.now().isoformat()}, request=request)
    except Exception as e:
        logger.error(f"API /crypto xatosi: {e}")
        return _json_response({"error": str(e)}, 500, request)


async def handle_metals(request: web.Request) -> web.Response:
    """Metallar narxi"""
    try:
        prices = await MetalsHandler.get_metals_prices()
        if not prices:
            return _json_response({"error": "Metals API unavailable"}, 503, request)
        return _json_response({"metals": prices, "updated": datetime.now().isoformat()}, request=request)
    except Exception as e:
        logger.error(f"API /metals xatosi: {e}")
        return _json_response({"error": str(e)}, 500, request)


async def handle_p2p(request: web.Request) -> web.Response:
    """Binance P2P USDT/UZS kurslari — server tomonidan CORS muammosiz"""
    try:
        payload = {
            "fiat": "UZS", "page": 1, "rows": 10,
            "tradeType": request.query.get("type", "BUY"),
            "asset": "USDT", "countries": [], "proMerchantAds": False,
            "shieldMerchantAds": False, "filterType": "all",
            "periods": [], "additionalKycVerifyFilter": 0,
            "publisherType": None, "payTypes": [], "classifies": ["mass"],
        }
        headers = {
            "Content-Type": "application/json",
            "User-Agent": _UA,
            "Referer": "https://p2p.binance.com/",
        }
        async with _session() as s:
            async with s.post(
                "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
                json=payload, headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as r:
                data = await r.json(content_type=None)
        ads = data.get("data", [])
        offers = [
            {
                "price": float(ad["adv"]["price"]),
                "min": float(ad["adv"]["minSingleTransAmount"]),
                "max": float(ad["adv"]["dynamicMaxSingleTransAmount"]),
                "nick": ad["advertiser"]["nickName"],
                "orders": ad["advertiser"]["monthOrderCount"],
                "rate": round(float(ad["advertiser"]["monthFinishRate"]) * 100, 1),
            }
            for ad in ads
        ]
        return _json_response({"ok": True, "offers": offers, "type": payload["tradeType"]}, request=request)
    except Exception as e:
        logger.error(f"P2P xatosi: {e}")
        return _json_response({"ok": False, "error": str(e)}, 500, request)


async def handle_crypto_top(request: web.Request) -> web.Response:
    """Top 250 kripto — server tomonidan keshlangan"""
    try:
        data = await CryptoTopHandler.get_top()
        if not data:
            return _json_response({"error": "Crypto top unavailable"}, 503, request)
        usd_rate = request.query.get("usd_rate")
        result = []
        for c in data:
            item = dict(c)
            if usd_rate:
                item["uzs"] = round(c["price"] * float(usd_rate), 0)
            result.append(item)
        return _json_response({
            "ok": True,
            "count": len(result),
            "data": result,
            "updated": datetime.now().isoformat(),
        }, request=request)
    except Exception as e:
        logger.error(f"API /crypto/top xatosi: {e}")
        return _json_response({"error": str(e)}, 500, request)


async def handle_health(request: web.Request) -> web.Response:
    return _json_response({"status": "ok", "time": datetime.now().isoformat()}, request=request)


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health",          handle_health)
    app.router.add_get("/api/rates",       handle_rates)
    app.router.add_get("/api/banks",       handle_banks)
    app.router.add_get("/api/crypto",      handle_crypto)
    app.router.add_get("/api/crypto/top",  handle_crypto_top)
    app.router.add_get("/api/metals",      handle_metals)
    app.router.add_post("/api/p2p",        handle_p2p)
    app.router.add_get("/api/p2p",         handle_p2p)
    return app


async def start_api_server() -> web.AppRunner:
    """API serverni ishga tushirish (bot bilan birgalikda)"""
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", API_PORT)
    await site.start()
    logger.info(f"API server ishga tushdi: http://0.0.0.0:{API_PORT}")
    return runner
