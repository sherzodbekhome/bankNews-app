"""
Firebase Admin SDK — bir marta initsializatsiya va token tekshirish yordamchilari.

auth_handler va admin_handler shu moduldan foydalanadi — ilgari har ikki modul
o'zining `firebase_admin` importi, init logikasi va Bearer token ajratishini
takrorlar edi.
"""
import json
import logging
import os
from typing import Optional

from aiohttp import web

logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials
    FIREBASE_AVAILABLE = True
except ImportError:
    firebase_admin = None
    fb_auth = None
    credentials = None
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin yo'q — token tekshirish o'chirilgan")


def init_firebase() -> None:
    """Firebase Admin SDK ni bir marta boshlaydi."""
    if not FIREBASE_AVAILABLE or firebase_admin._apps:
        return
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


def _ready() -> bool:
    return FIREBASE_AVAILABLE and bool(firebase_admin._apps)


def get_bearer_token(request: web.Request) -> Optional[str]:
    """`Authorization: Bearer <token>` sarlavhasidan tokenni ajratadi."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def decode_token(token: str) -> Optional[dict]:
    """Firebase ID tokenni dekodlaydi — xom decoded dict yoki None."""
    if not token or not _ready():
        return None
    try:
        return fb_auth.verify_id_token(token)
    except Exception as e:
        logger.warning(f"Token tekshirishda xato: {e}")
        return None


def verify_token(token: str) -> Optional[dict]:
    """Normallashtirilgan foydalanuvchi ma'lumotlarini qaytaradi."""
    decoded = decode_token(token)
    if not decoded:
        return None
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email", ""),
        "name": decoded.get("name", ""),
        "picture": decoded.get("picture", ""),
        "provider": decoded.get("firebase", {}).get("sign_in_provider", ""),
    }


init_firebase()
