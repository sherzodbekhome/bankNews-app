"""
Admin API endpointlari — faqat ADMIN_EMAILS uchun
GET  /api/admin/stats     — statistika
POST /api/admin/broadcast — Telegram broadcast
POST /api/admin/rate      — kurs override
"""
import logging
import os

from aiohttp import web

from core.database import db

logger = logging.getLogger(__name__)

ADMIN_EMAILS = {e.strip() for e in os.getenv("ADMIN_EMAILS", "sherzodbekhome@gmail.com").split(",")}

try:
    import firebase_admin
    from firebase_admin import auth as fb_auth
    _FB_AVAILABLE = True
except ImportError:
    _FB_AVAILABLE = False


async def _verify_admin(request: web.Request):
    """Bearer tokenni tekshirib, admin email ekanini tasdiqlaydi. None qaytarsa — xato."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    if not _FB_AVAILABLE or not firebase_admin._apps:
        return None
    try:
        decoded = fb_auth.verify_id_token(token)
        email = decoded.get("email", "")
        if email not in ADMIN_EMAILS:
            return None
        return decoded
    except Exception:
        return None


async def handle_admin_stats(request: web.Request) -> web.Response:
    """GET /api/admin/stats"""
    admin = await _verify_admin(request)
    if not admin:
        return web.json_response({"ok": False, "error": "Ruxsat yo'q"}, status=403)

    try:
        web_users = await db.get_web_users_count()
        alerts = await db.get_web_alerts_count()
        tg_users = await db.get_active_users_count(hours=24 * 30)
        return web.json_response({
            "ok": True,
            "web_users": web_users,
            "alerts": alerts,
            "tg_users": tg_users,
        })
    except Exception as e:
        logger.error(f"admin/stats xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_admin_broadcast(request: web.Request) -> web.Response:
    """POST /api/admin/broadcast — {"text": "...", "lang": "all|uz|ru"}"""
    admin = await _verify_admin(request)
    if not admin:
        return web.json_response({"ok": False, "error": "Ruxsat yo'q"}, status=403)

    try:
        body = await request.json()
        text = body.get("text", "").strip()
        lang = body.get("lang", "all")
        if not text:
            return web.json_response({"ok": False, "error": "Xabar matni kerak"}, status=400)

        # Bot instance'ni import qilamiz (aylanma import — faqat shu yerda)
        try:
            from telegram_bot.bot import dp
            bot = dp.bot
        except Exception:
            return web.json_response({"ok": False, "error": "Bot ulanmagan"}, status=503)

        user_ids = await db.get_all_active_users()
        sent = 0
        failed = 0
        import asyncio
        for uid in user_ids:
            try:
                if lang != "all":
                    user = await db.get_user(uid)
                    if user and user.get("language_code", "uz") != lang:
                        continue
                await bot.send_message(uid, text, parse_mode="HTML")
                sent += 1
                await asyncio.sleep(0.05)  # flood control
            except Exception:
                failed += 1

        return web.json_response({"ok": True, "sent": sent, "failed": failed})

    except Exception as e:
        logger.error(f"admin/broadcast xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_admin_rate(request: web.Request) -> web.Response:
    """POST /api/admin/rate — {"currency":"USD","buy":12300,"sell":12500}"""
    admin = await _verify_admin(request)
    if not admin:
        return web.json_response({"ok": False, "error": "Ruxsat yo'q"}, status=403)

    try:
        body = await request.json()
        currency = body.get("currency", "").upper()
        buy = float(body.get("buy", 0))
        sell = float(body.get("sell", 0))
        if not currency or buy <= 0 or sell <= 0:
            return web.json_response({"ok": False, "error": "currency, buy va sell kerak"}, status=400)

        await db.save_rate_override(currency, buy, sell, updated_by=admin.get("email", ""))
        return web.json_response({"ok": True})

    except Exception as e:
        logger.error(f"admin/rate xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)
