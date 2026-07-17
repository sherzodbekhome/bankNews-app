"""
Aiogram Middleware — foydalanuvchi tracking, rate limiting (Redis)
"""
import logging
from typing import Callable, Dict, Any

from aiogram import BaseMiddleware
from aiogram.types import Update

from core.database import db
from core.redis_manager import redis_mgr

logger = logging.getLogger(__name__)

RATE_LIMIT   = 20   # so'rov
RATE_WINDOW  = 60   # sekund


class UserTrackingMiddleware(BaseMiddleware):
    """Har bir xabarda foydalanuvchi ma'lumotlarini saqlash va log qilish"""

    async def __call__(self, handler: Callable, event: Update, data: Dict[str, Any]) -> Any:
        try:
            user    = None
            action  = None
            command = None

            if hasattr(event, "message") and event.message:
                user = event.message.from_user
                if user and event.message.text:
                    text = event.message.text
                    if text.startswith("/"):
                        command = text.split()[0].strip("/")
                        action  = f"Command: {command}"
                    else:
                        action = f"Text: {text[:50]}"

            elif hasattr(event, "callback_query") and event.callback_query:
                user   = event.callback_query.from_user
                action = f"Button: {event.callback_query.data[:50]}"

            if user:
                await db.add_or_update_user(
                    user_id=user.id,
                    username=user.username,
                    first_name=user.first_name,
                    language_code=user.language_code or "uz",
                )
                if action:
                    await db.log_user_action(
                        user_id=user.id,
                        command=command,
                        action=action,
                    )
                    logger.debug(f"User {user.id} (@{user.username}): {action}")

        except Exception as e:
            logger.error(f"UserTracking middleware xatosi: {e}", exc_info=True)

        return await handler(event, data)


class ErrorLoggingMiddleware(BaseMiddleware):
    """Handler xatolarini database ga yozish"""

    async def __call__(self, handler: Callable, event: Update, data: Dict[str, Any]) -> Any:
        try:
            return await handler(event, data)
        except Exception as e:
            component = "Handler"
            user = getattr(event, "from_user", None)
            if user:
                component += f" (User: {user.id})"
            try:
                await db.log_error(
                    error_type=type(e).__name__,
                    error_message=str(e),
                    component=component,
                    severity="error",
                )
            except Exception as log_err:
                logger.debug(f"Xatoni DB ga yozib bo'lmadi: {log_err}")
            logger.error(f"Handler error: {e}")
            raise


class UserLanguageMiddleware(BaseMiddleware):
    """Foydalanuvchi tilini context ga qo'shish"""

    async def __call__(self, handler: Callable, event: Update, data: Dict[str, Any]) -> Any:
        user = getattr(event, "from_user", None)
        data["user_language"] = (user.language_code or "uz") if user else "uz"
        return await handler(event, data)


class RateLimitMiddleware(BaseMiddleware):
    """
    Redis-based distributed rate limiting.
    Redis mavjud bo'lmasa in-memory fallback ishlatadi.
    """

    def __init__(self, limit: int = RATE_LIMIT, window: int = RATE_WINDOW):
        self.limit  = limit
        self.window = window
        self._mem: Dict[int, list] = {}  # Redis o'chsa fallback

    async def __call__(self, handler: Callable, event: Update, data: Dict[str, Any]) -> Any:
        user = getattr(event, "from_user", None)
        if not user:
            return await handler(event, data)

        allowed = await redis_mgr.check_rate_limit(
            user.id, limit=self.limit, window=self.window
        )
        if not allowed:
            logger.warning(f"Rate limit: user {user.id}")
            if hasattr(event, "answer"):
                await event.answer("⏳ Iltimos, biroz kuting. Juda ko'p so'rov yubordingiz.")
            return

        return await handler(event, data)


def setup_middlewares(dp):
    """Barcha middlewarelarni ro'yxatdan o'tkazish"""
    dp.message.middleware(UserTrackingMiddleware())
    dp.callback_query.middleware(UserTrackingMiddleware())

    dp.message.middleware(ErrorLoggingMiddleware())
    dp.callback_query.middleware(ErrorLoggingMiddleware())

    dp.message.middleware(UserLanguageMiddleware())
    dp.callback_query.middleware(UserLanguageMiddleware())

    dp.message.middleware(RateLimitMiddleware(limit=RATE_LIMIT, window=RATE_WINDOW))

    logger.info("✓ Middlewarelar sozlandi")
