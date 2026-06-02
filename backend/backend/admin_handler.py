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
    """POST /api/admin/broadcast
    JSON:      {"text":"...","lang":"all|uz|ru"}
    Multipart: text=..., lang=..., media=<file>  (rasm yoki video)
    """
    admin = await _verify_admin(request)
    if not admin:
        return web.json_response({"ok": False, "error": "Ruxsat yo'q"}, status=403)

    try:
        import asyncio, os
        from aiogram.types import BufferedInputFile

        # ── Ma'lumotlarni o'qish (JSON yoki multipart) ────────────────────────
        media_bytes = None
        media_filename = None
        media_content_type = None

        ct = request.content_type or ""
        if "multipart" in ct:
            data = await request.post()
            text = (data.get("text") or "").strip()
            lang = data.get("lang") or "all"
            mf = data.get("media")
            if mf and hasattr(mf, "file"):
                media_bytes = mf.file.read()
                media_filename = mf.filename or "media"
                media_content_type = mf.content_type or ""
        else:
            body = await request.json()
            text = (body.get("text") or "").strip()
            lang = body.get("lang") or "all"

        if not text and not media_bytes:
            return web.json_response({"ok": False, "error": "Matn yoki media kerak"}, status=400)

        # ── Bot ───────────────────────────────────────────────────────────────
        from aiogram import Bot as AioBot
        from aiogram.client.default import DefaultBotProperties
        from aiogram.enums import ParseMode as AioParseMode
        _bot_token = os.getenv("BOT_TOKEN", "")
        if not _bot_token:
            return web.json_response({"ok": False, "error": "BOT_TOKEN yo'q"}, status=503)
        bot = AioBot(token=_bot_token,
                     default=DefaultBotProperties(parse_mode=AioParseMode.HTML))

        try:
            # ── Media turini aniqlash & Telegram ga yuklash ───────────────────
            file_id = None
            media_type = None   # "photo" | "video"

            if media_bytes:
                ext = os.path.splitext(media_filename)[1].lower()
                is_video = ext in (".mp4", ".mov", ".avi", ".mkv", ".webm") or "video" in media_content_type
                media_type = "video" if is_video else "photo"

                # Faylni Telegram ga bir marta yuklaymiz — file_id olamiz
                admin_id = int(os.getenv("ADMIN_ID", "0"))
                buf = BufferedInputFile(media_bytes, filename=media_filename)
                if media_type == "photo":
                    msg = await bot.send_photo(admin_id, photo=buf,
                                               caption=text or None)
                    file_id = msg.photo[-1].file_id
                else:
                    msg = await bot.send_video(admin_id, video=buf,
                                               caption=text or None)
                    file_id = msg.video.file_id

            # ── Foydalanuvchilar ro'yxati ─────────────────────────────────────
            user_ids = await db.get_all_active_users()
            if not user_ids:
                return web.json_response({
                    "ok": False,
                    "error": "Foydalanuvchilar DB da yo'q. Bot ni qayta ishga tushiring — "
                             "foydalanuvchilar /start qilgandan keyin saqlanadi."
                }, status=400)

            # ── Broadcast ─────────────────────────────────────────────────────
            sent = 0
            failed = 0
            for uid in user_ids:
                try:
                    if lang != "all":
                        user = await db.get_user(uid)
                        if user and user.get("language_code", "uz") != lang:
                            continue

                    if file_id and media_type == "photo":
                        await bot.send_photo(uid, photo=file_id, caption=text or None)
                    elif file_id and media_type == "video":
                        await bot.send_video(uid, video=file_id, caption=text or None)
                    else:
                        await bot.send_message(uid, text)

                    sent += 1
                    await asyncio.sleep(0.05)   # flood control ~20 msg/s
                except Exception:
                    failed += 1

            return web.json_response({"ok": True, "sent": sent, "failed": failed})

        finally:
            await bot.session.close()

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
