"""
Firebase Auth + foydalanuvchi boshqaruvi (PostgreSQL)
POST /api/auth/verify  — Firebase ID token tekshirish, user upsert
GET  /api/user/me      — joriy foydalanuvchi ma'lumotlari
PUT  /api/user/alerts  — ogohlantirish qo'shish/o'chirish
"""
import json
import logging
from typing import Optional

from aiohttp import web

from core.database import db

logger = logging.getLogger(__name__)

# Firebase Admin SDK ixtiyoriy — mavjud bo'lmasa token tekshirilmaydi
try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials
    _FB_AVAILABLE = True
except ImportError:
    _FB_AVAILABLE = False
    logger.warning("firebase-admin yo'q — token tekshirish o'chirilgan")


def _init_firebase():
    """Firebase Admin SDK ni bir marta boshlaydi."""
    if not _FB_AVAILABLE:
        return
    if firebase_admin._apps:
        return
    import os, json
    # 1) JSON mazmuni to'g'ridan-to'g'ri env da (Render uchun qulay)
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        try:
            cred = credentials.Certificate(json.loads(sa_json))
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK ishga tushdi (JSON env)")
            return
        except Exception as e:
            logger.error(f"Firebase JSON env xatosi: {e}")
    # 2) Fayl yo'li orqali (lokal ishlab chiqish uchun)
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK ishga tushdi (fayl)")
    else:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON yoki FIREBASE_SERVICE_ACCOUNT env yo'q")


_init_firebase()


async def _verify_token(token: str) -> Optional[dict]:
    """Firebase ID tokenni tekshiradi, uid va email qaytaradi."""
    if not _FB_AVAILABLE or not firebase_admin._apps:
        return None
    try:
        decoded = fb_auth.verify_id_token(token)
        return {
            "uid": decoded["uid"],
            "email": decoded.get("email", ""),
            "name": decoded.get("name", ""),
            "picture": decoded.get("picture", ""),
            "provider": decoded.get("firebase", {}).get("sign_in_provider", ""),
        }
    except Exception as e:
        logger.warning(f"Token tekshirishda xato: {e}")
        return None


def _get_token(request: web.Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def handle_auth_verify(request: web.Request) -> web.Response:
    """
    POST /api/auth/verify
    Body: {"token": "<Firebase ID token>"}
    Foydalanuvchini DB ga saqlaydi, user ma'lumotlarini qaytaradi.
    """
    try:
        body = await request.json()
        token = body.get("token", "")
        if not token:
            return web.json_response({"ok": False, "error": "token yo'q"}, status=400)

        info = await _verify_token(token)
        if not info:
            return web.json_response(
                {"ok": False, "error": "Token noto'g'ri yoki Firebase sozlanmagan"},
                status=401,
            )

        # Foydalanuvchini DB ga yozamiz
        await db.upsert_web_user(
            uid=info["uid"],
            email=info["email"],
            name=info["name"],
            picture=info["picture"],
            provider=info["provider"],
        )

        return web.json_response({"ok": True, "user": info})

    except Exception as e:
        logger.error(f"auth/verify xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_user_me(request: web.Request) -> web.Response:
    """GET /api/user/me — token orqali foydalanuvchi profili."""
    token = _get_token(request)
    if not token:
        return web.json_response({"ok": False, "error": "Avtorizatsiya talab etiladi"}, status=401)

    info = await _verify_token(token)
    if not info:
        return web.json_response({"ok": False, "error": "Token noto'g'ri"}, status=401)

    try:
        user = await db.get_web_user(info["uid"])
        return web.json_response({"ok": True, "user": user or info})
    except Exception as e:
        logger.error(f"user/me xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_user_alerts(request: web.Request) -> web.Response:
    """
    GET  /api/user/alerts — foydalanuvchi ogohlantirishlari
    POST /api/user/alerts — yangi ogohlantirish qo'shish
    DELETE /api/user/alerts — ogohlantirish o'chirish
    Body: {"currency":"USD","direction":"above","threshold":13500}
    """
    token = _get_token(request)
    if not token:
        return web.json_response({"ok": False, "error": "Avtorizatsiya talab etiladi"}, status=401)

    info = await _verify_token(token)
    if not info:
        return web.json_response({"ok": False, "error": "Token noto'g'ri"}, status=401)

    uid = info["uid"]

    try:
        if request.method == "GET":
            alerts = await db.get_user_alerts(uid)
            return web.json_response({"ok": True, "alerts": alerts})

        elif request.method == "POST":
            body = await request.json()
            cur = body.get("currency", "").upper()
            direction = body.get("direction", "above")  # above | below
            threshold = float(body.get("threshold", 0))
            if not cur or threshold <= 0:
                return web.json_response({"ok": False, "error": "currency va threshold kerak"}, status=400)
            alert_id = await db.add_user_alert(uid, cur, direction, threshold)
            return web.json_response({"ok": True, "id": alert_id})

        elif request.method == "DELETE":
            body = await request.json()
            alert_id = body.get("id")
            if not alert_id:
                return web.json_response({"ok": False, "error": "id kerak"}, status=400)
            await db.delete_user_alert(uid, alert_id)
            return web.json_response({"ok": True})

    except Exception as e:
        logger.error(f"alerts xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)

    return web.json_response({"ok": False, "error": "Noto'g'ri metod"}, status=405)


async def handle_user_portfolio(request: web.Request) -> web.Response:
    """
    GET  /api/user/portfolio — portfelni yuklash
    POST /api/user/portfolio — portfelni saqlash
    Body (POST): {"portfolio": [...]}
    """
    token = _get_token(request)
    if not token:
        return web.json_response({"ok": False, "error": "Avtorizatsiya talab etiladi"}, status=401)

    info = await _verify_token(token)
    if not info:
        return web.json_response({"ok": False, "error": "Token noto'g'ri"}, status=401)

    uid = info["uid"]

    try:
        if request.method == "GET":
            portfolio = await db.get_web_portfolio(uid)
            return web.json_response({"ok": True, "portfolio": portfolio})

        elif request.method == "POST":
            body = await request.json()
            portfolio = body.get("portfolio", [])
            if not isinstance(portfolio, list):
                return web.json_response({"ok": False, "error": "portfolio array bo'lishi kerak"}, status=400)
            await db.save_web_portfolio(uid, portfolio)
            return web.json_response({"ok": True})

    except Exception as e:
        logger.error(f"portfolio xatosi: {e}", exc_info=True)
        return web.json_response({"ok": False, "error": str(e)}, status=500)

    return web.json_response({"ok": False, "error": "Noto'g'ri metod"}, status=405)
