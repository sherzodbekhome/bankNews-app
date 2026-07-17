"""
Lokal server: statik fayllar + API proxy endpointlar
- /api/ai/analyze     — Gemini AI tahlil
- /api/admin/stats    — statistika
- /api/admin/broadcast — broadcast xabar (bot orqali)
- /api/admin/rate     — kurs boshqaruvi
"""
import asyncio, hmac, json, os, sys
from pathlib import Path

_ROOT = Path(__file__).parent / "Sherzodbek.AI" / "backend"
sys.path.insert(0, str(_ROOT))

from aiohttp import web
from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")

FRONTEND_DIR = Path(__file__).parent / "Sherzodbek.AI" / "frontend"
PORT = 3000

# CORS: faqat ruxsat etilgan originlar (env orqali sozlanadi, wildcard emas)
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]


def _cors(request) -> dict:
    origin = request.headers.get("Origin", "")
    allow = origin if origin in _ALLOWED_ORIGINS else (_ALLOWED_ORIGINS[0] if _ALLOWED_ORIGINS else "")
    headers = {"Content-Type": "application/json", "Vary": "Origin"}
    if allow:
        headers["Access-Control-Allow-Origin"] = allow
    return headers


def _is_admin(request) -> bool:
    """Admin endpointlar uchun oddiy shared-secret tekshiruvi (fail-closed)."""
    expected = os.getenv("ADMIN_API_TOKEN", "")
    if not expected:
        # Token sozlanmagan bo'lsa — hech kimga ruxsat berilmaydi
        return False
    provided = request.headers.get("X-Admin-Token", "")
    auth = request.headers.get("Authorization", "")
    if not provided and auth.startswith("Bearer "):
        provided = auth[7:]
    return bool(provided) and hmac.compare_digest(provided, expected)


# ── AI tahlil ─────────────────────────────────────────────────────────────────
async def handle_ai(request):
    try:
        from backend.api_handlers import CBUHandler, CryptoHandler, MetalsHandler
        from telegram_bot.ai_analyzer import AIAnalyzer

        cbu, crypto, metals = await asyncio.gather(
            CBUHandler.get_rates(),
            CryptoHandler.get_crypto_prices(),
            MetalsHandler.get_metals_prices(),
            return_exceptions=True,
        )
        if isinstance(cbu,    Exception): cbu    = None
        if isinstance(crypto, Exception): crypto = None
        if isinstance(metals, Exception): metals = None

        currency_flat = {k: v["rate"] for k, v in (cbu or {}).items() if "rate" in v}
        crypto_flat   = {k: v["price"] for k, v in (crypto or {}).items() if "price" in v}

        ai       = AIAnalyzer()
        analysis = await ai.analyze_market(currency_flat, crypto_flat, metals or {})
        return web.Response(text=json.dumps({"ok": True, "analysis": analysis or "Tahlil mavjud emas."}), headers=_cors(request))
    except Exception as e:
        return web.Response(text=json.dumps({"ok": False, "error": str(e)}), headers=_cors(request))


# ── Admin: statistika ─────────────────────────────────────────────────────────
async def handle_admin_stats(request):
    if not _is_admin(request):
        return web.Response(text=json.dumps({"ok": False, "error": "Ruxsat yo'q"}), status=403, headers=_cors(request))
    try:
        from core.database import db
        stats = await db.get_global_stats()
        alerts = await db.get_web_alerts_count()
        web_users = await db.get_web_users_count()
        return web.Response(text=json.dumps({
            "ok": True,
            "web_users": web_users,
            "alerts": alerts,
            "tg_users": stats.get("total_users", 0),
        }), headers=_cors(request))
    except Exception as e:
        return web.Response(text=json.dumps({
            "ok": True,
            "web_users": "—",
            "alerts": "—",
            "tg_users": "—",
            "note": f"DB ulanmagan: {e}"
        }), headers=_cors(request))


# ── Admin: broadcast ──────────────────────────────────────────────────────────
async def handle_admin_broadcast(request):
    if not _is_admin(request):
        return web.Response(text=json.dumps({"ok": False, "error": "Ruxsat yo'q"}), status=403, headers=_cors(request))
    try:
        import os, sys
        ct = request.content_type or ""
        if "multipart" in ct:
            data = await request.post()
            text = (data.get("text") or "").strip()
            lang = data.get("lang") or "all"
            media = data.get("media")
            has_media = media and hasattr(media, "file")
            media_bytes = media.file.read() if has_media else None
            media_filename = (media.filename or "media") if has_media else None
            media_ct = (media.content_type or "") if has_media else ""
        else:
            data = await request.json()
            text = (data.get("text") or "").strip()
            lang = data.get("lang") or "all"
            has_media = False
            media_bytes = media_filename = media_ct = None

        if not text and not has_media:
            return web.Response(text=json.dumps({"ok": False, "error": "Matn yoki media kerak"}), headers=_cors(request))

        from core.config import BOT_TOKEN, ADMIN_ID
        from core.database import db
        from aiogram import Bot
        from aiogram.enums import ParseMode
        from aiogram.client.default import DefaultBotProperties
        from aiogram.types import BufferedInputFile

        bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
        try:
            # Mediani Telegram ga yuklash (file_id olish)
            file_id = None
            media_type = None
            if has_media and media_bytes:
                ext = os.path.splitext(media_filename)[1].lower()
                is_video = ext in (".mp4",".mov",".avi",".mkv",".webm") or "video" in media_ct
                media_type = "video" if is_video else "photo"
                buf = BufferedInputFile(media_bytes, filename=media_filename)
                if is_video:
                    msg = await bot.send_video(ADMIN_ID, video=buf, caption=text or None)
                    file_id = msg.video.file_id
                else:
                    msg = await bot.send_photo(ADMIN_ID, photo=buf, caption=text or None)
                    file_id = msg.photo[-1].file_id

            # DB dan foydalanuvchilar
            user_ids = await db.get_all_active_users() or []
            if not user_ids:
                # DB yo'q yoki bo'sh — faqat adminga yuborildi (media yuklashda allaqachon yuborildi)
                if not has_media:
                    await bot.send_message(ADMIN_ID, f"📢 <b>Test (DB yo'q):</b>\n\n{text}")
                return web.Response(text=json.dumps({
                    "ok": True, "sent": 1, "failed": 0,
                    "note": "DB ulanmagan — faqat adminga yuborildi"
                }), headers=_cors(request))

            # Barcha foydalanuvchilarga yuborish
            sent = 0; failed = 0
            for uid in user_ids:
                try:
                    if lang != "all":
                        user = await db.get_user(uid)
                        if user and user.get("language_code","uz") != lang:
                            continue
                    if file_id and media_type == "photo":
                        await bot.send_photo(uid, photo=file_id, caption=text or None)
                    elif file_id and media_type == "video":
                        await bot.send_video(uid, video=file_id, caption=text or None)
                    else:
                        await bot.send_message(uid, text)
                    sent += 1
                    import asyncio; await asyncio.sleep(0.05)
                except Exception:
                    failed += 1

            return web.Response(text=json.dumps({"ok": True, "sent": sent, "failed": failed}), headers=_cors(request))
        finally:
            await bot.session.close()
    except Exception as e:
        return web.Response(text=json.dumps({"ok": False, "error": str(e)}), headers=_cors(request))


# ── Admin: kurs saqlash ───────────────────────────────────────────────────────
async def handle_admin_rate(request):
    if not _is_admin(request):
        return web.Response(text=json.dumps({"ok": False, "error": "Ruxsat yo'q"}), status=403, headers=_cors(request))
    try:
        data = await request.json()
        currency = data.get("currency", "USD").upper()
        buy  = float(data.get("buy", 0))
        sell = float(data.get("sell", 0))

        # Lokal JSON faylga saqlash (DB yo'q bo'lganda)
        rates_file = FRONTEND_DIR.parent / "backend" / "banks_data.json"
        local_rates = {}
        if rates_file.exists():
            try:
                local_rates = json.loads(rates_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        if "overrides" not in local_rates:
            local_rates["overrides"] = {}
        local_rates["overrides"][currency] = {"buy": buy, "sell": sell}
        rates_file.write_text(json.dumps(local_rates, ensure_ascii=False, indent=2), encoding="utf-8")

        return web.Response(text=json.dumps({"ok": True, "currency": currency, "buy": buy, "sell": sell}), headers=_cors(request))
    except Exception as e:
        return web.Response(text=json.dumps({"ok": False, "error": str(e)}), headers=_cors(request))


# ── Statik fayllar ────────────────────────────────────────────────────────────
async def handle_static(request):
    path = request.match_info.get("path", "index.html") or "index.html"
    file_path = FRONTEND_DIR / path
    if file_path.is_dir():
        file_path = file_path / "index.html"
    if not file_path.exists():
        raise web.HTTPNotFound()
    return web.FileResponse(file_path)


# ── User API (lokal stub) ─────────────────────────────────────────────────────
async def handle_user_alerts(request):
    if request.method == 'GET':
        return web.Response(text=json.dumps({"ok": True, "alerts": []}), headers=_cors(request))
    if request.method == 'POST':
        return web.Response(text=json.dumps({"ok": True}), headers=_cors(request))
    if request.method == 'DELETE':
        return web.Response(text=json.dumps({"ok": True}), headers=_cors(request))
    raise web.HTTPMethodNotAllowed(request.method, ['GET','POST','DELETE'])

async def handle_user_portfolio(request):
    if request.method == 'GET':
        return web.Response(text=json.dumps({"ok": True, "portfolio": []}), headers=_cors(request))
    return web.Response(text=json.dumps({"ok": True}), headers=_cors(request))

async def handle_user_me(request):
    return web.Response(text=json.dumps({"ok": True, "user": None}), headers=_cors(request))

# ── App ───────────────────────────────────────────────────────────────────────
app = web.Application()
app.router.add_get ("/api/ai/analyze",       handle_ai)
app.router.add_get ("/api/admin/stats",      handle_admin_stats)
app.router.add_post("/api/admin/broadcast",  handle_admin_broadcast)
app.router.add_post("/api/admin/rate",       handle_admin_rate)
app.router.add_route("*", "/api/user/alerts",    handle_user_alerts)
app.router.add_route("*", "/api/user/portfolio", handle_user_portfolio)
app.router.add_get ("/api/user/me",              handle_user_me)
app.router.add_get ("/",                     handle_static)
app.router.add_get ("/{path:.+}",            handle_static)

if __name__ == "__main__":
    print(f"Server: http://localhost:{PORT}")
    print("Endpointlar: /api/ai/analyze | /api/admin/stats | /api/admin/broadcast | /api/admin/rate")
    web.run_app(app, host="0.0.0.0", port=PORT)
