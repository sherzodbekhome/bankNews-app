"""
BankNews Bot — asosiy kirish nuqtasi.

Arxitektura (100k–500k foydalanuvchi uchun):
  • Webhook yoki polling (WEBHOOK_URL bo'lsa → webhook)
  • aiohttp: API (/api/...) + webhook (/webhook) bir portda
  • asyncpg connection pool (5–20)
  • Redis distributed rate limiting
  • APScheduler — kanal postlari (09:00, 14:00, 18:00 Toshkent)
  • CacheUpdater — CBU/kripto 4 daqiqada yangilanadi
  • BroadcastWorker — alohida process (Redis navbati)

Ishga tushirish:
    cd backend
    python -m telegram_bot.bot
"""
import asyncio
import logging
import os
import sys

# ── Path sozlash ─────────────────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from core.config import (
    BOT_TOKEN, ADMIN_ID, CHANNELS,
    DATABASE_URL, REDIS_URL,
    WEBHOOK_URL, WEBHOOK_PATH,
    LOG_LEVEL, LOG_FORMAT, LOG_FILE,
)

# ── Logging ───────────────────────────────────────────────────────────────────
handlers = [logging.StreamHandler()]
if LOG_FILE:
    handlers.append(logging.FileHandler(LOG_FILE, encoding="utf-8"))

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO),
                    format=LOG_FORMAT, handlers=handlers)
logger = logging.getLogger(__name__)

# ── Aiogram ───────────────────────────────────────────────────────────────────
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo

# ── Core services ─────────────────────────────────────────────────────────────
from core.database       import db
from core.redis_manager  import redis_mgr
from core.cache_manager  import cache_updater, CacheManager
from core.scheduler_manager import scheduler

# ── API handlers (cache uchun) ────────────────────────────────────────────────
from backend.api_handlers import CBUHandler, CryptoHandler

# ── Bot handlers ──────────────────────────────────────────────────────────────
from telegram_bot.middleware  import setup_middlewares
from telegram_bot.admin_panel import register_admin_handlers
from telegram_bot.handlers    import bank_comparison_router

# Mini App URL (GitHub Pages)
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://sherzodbekhome.github.io/bankNews-app/")


# ── Dispatcher + Bot ──────────────────────────────────────────────────────────
storage = MemoryStorage()
dp = Dispatcher(storage=storage)
bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp.bot = bot  # admin_handler.py dan foydalanish uchun


# ── Handlerlarni ro'yxatdan o'tkazish ─────────────────────────────────────────
dp.include_router(bank_comparison_router)
register_admin_handlers(dp, bot, ADMIN_ID, CHANNELS)


# ── Asosiy komandalar ─────────────────────────────────────────────────────────
@dp.message()
async def default_handler(message):
    from aiogram.filters import CommandStart
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

    text = message.text or ""
    if text == "/start":
        await message.answer(
            f"👋 Salom, <b>{message.from_user.first_name}</b>!\n\n"
            "💱 <b>BankNews Bot</b> — O'zbekiston valyuta kurslari, bank taqqoslamalari "
            "va kripto narxlari haqida real vaqtda ma'lumot beradi.\n\n"
            "📲 App ni ochish uchun pastdagi tugmani bosing:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(
                    text="📊 BankNews App",
                    web_app=WebAppInfo(url=MINI_APP_URL),
                )
            ]]),
        )
    elif text == "/banklar":
        pass  # bank_comparison_router ushlaydi
    elif text == "/help":
        await message.answer(
            "ℹ️ <b>Buyruqlar:</b>\n"
            "/start — Botni boshlash\n"
            "/banklar — Bank kurslari taqqoslash\n"
            "/help — Yordam"
        )


# ── Startup postlar adminga ───────────────────────────────────────────────────
async def _send_startup_posts_to_admin():
    """Bot ishga tushganda 3 ta postni adminga yuborish"""
    if not ADMIN_ID:
        return

    # Avval oddiy ping — bot adminga yetib borishi mumkinligini tekshirish
    try:
        await bot.send_message(ADMIN_ID, "⏳ Bot ishga tushdi, postlar tayyorlanmoqda...")
    except Exception as e:
        print(f"[STARTUP] Admin ga xabar yuborib bo'lmadi: {e}")
        logger.error(f"Admin ga xabar yuborib bo'lmadi (ADMIN_ID={ADMIN_ID}): {e}")
        return

    try:
        from core.scheduler_manager import scheduler

        print("[STARTUP] Valyuta posti tayyorlanmoqda...")
        text1 = await scheduler.build_currency_text()

        print("[STARTUP] Kripto posti tayyorlanmoqda...")
        text2 = await scheduler.build_crypto_metals_text()

        if text1:
            await bot.send_message(ADMIN_ID, "<b>📤 POST 1 / POST 2 — 09:35 / 12:10</b>", parse_mode="HTML", disable_web_page_preview=True)
            await bot.send_message(ADMIN_ID, text1, parse_mode="HTML", disable_web_page_preview=True)
            await asyncio.sleep(0.5)
        if text2:
            await bot.send_message(ADMIN_ID, "<b>📤 POST 3 — 18:00</b>", parse_mode="HTML", disable_web_page_preview=True)
            await bot.send_message(ADMIN_ID, text2, parse_mode="HTML", disable_web_page_preview=True)
        print("[STARTUP] Barcha postlar adminga yuborildi ✓")
        logger.info("Startup postlari adminga yuborildi")

    except Exception as e:
        print(f"[STARTUP] Xato: {e}")
        logger.error(f"Startup postlarini tayyorlashda xato: {e}", exc_info=True)
        try:
            await bot.send_message(ADMIN_ID, f"⚠️ Post yuborishda xato: <code>{e}</code>")
        except Exception:
            pass


# ── Startup / Shutdown ────────────────────────────────────────────────────────
async def on_startup():
    logger.info("Bot ishga tushmoqda...")

    # Core services
    await db.connect(DATABASE_URL)
    await redis_mgr.connect(REDIS_URL)

    # Cache — fon yangilovchilar
    # CBUHandler raw nested dict qaytaradi; formatters flat {ccy: rate} kutadi
    async def _flat_currency():
        raw = await CBUHandler.get_rates()
        if not raw:
            return None
        return {k: v["rate"] for k, v in raw.items() if isinstance(v, dict) and "rate" in v}

    cache_updater.register("currency", _flat_currency, ttl=3600, interval=240)
    cache_updater.register("crypto",   CryptoHandler.get_crypto_prices, ttl=600, interval=280)

    # Kanal scheduler
    scheduler.init(bot, CHANNELS)
    scheduler.start()

    # Startup postlarni adminga yuborish (fon taskida — startupni to'smaslik uchun)
    asyncio.create_task(_send_startup_posts_to_admin())

    # Bot komandalarini Telegram ga ro'yxatdan o'tkazish
    await bot.set_my_commands([
        BotCommand(command="start",   description="Botni boshlash"),
        BotCommand(command="banklar", description="Bank kurslari taqqoslash"),
        BotCommand(command="help",    description="Yordam"),
    ])

    # Mini App tugmasi — asosiy menyu sifatida
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="📊 BankNews",
                web_app=WebAppInfo(url=MINI_APP_URL),
            )
        )
    except Exception as e:
        logger.warning(f"Menu button o'rnatilmadi: {e}")

    logger.info(f"Bot @{(await bot.get_me()).username} tayyor")


async def on_shutdown():
    logger.info("Bot to'xtatilmoqda...")
    scheduler.stop()
    cache_updater.stop()
    await db.close()
    await redis_mgr.close()
    await bot.session.close()
    logger.info("Bot yopildi")


# ── Asosiy loop ───────────────────────────────────────────────────────────────
async def main():
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN o'rnatilmagan! .env faylini tekshiring.")
        sys.exit(1)

    await on_startup()

    try:
        if WEBHOOK_URL:
            await _run_webhook()
        else:
            await _run_polling()
    finally:
        await on_shutdown()


async def _run_polling():
    """Lokal ishlab chiqish uchun polling"""
    logger.info("Polling rejimida ishlamoqda...")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


async def _run_webhook():
    """Production: aiohttp server — API + Webhook bir portda"""
    from aiohttp import web
    from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
    from backend.api_server import create_app
    from backend.auth_handler import handle_auth_verify, handle_user_me, handle_user_alerts, handle_user_portfolio
    from backend.admin_handler import handle_admin_stats, handle_admin_broadcast, handle_admin_rate
    from backend.ai_handler import handle_ai_analyze

    full_webhook = WEBHOOK_URL.rstrip("/") + WEBHOOK_PATH

    app = create_app()

    # Auth / User routes
    app.router.add_post("/api/auth/verify",      handle_auth_verify)
    app.router.add_get ("/api/user/me",           handle_user_me)
    app.router.add_route("*", "/api/user/alerts", handle_user_alerts)
    app.router.add_route("*", "/api/user/portfolio", handle_user_portfolio)

    # Admin routes
    app.router.add_get ("/api/admin/stats",      handle_admin_stats)
    app.router.add_post("/api/admin/broadcast",  handle_admin_broadcast)
    app.router.add_post("/api/admin/rate",       handle_admin_rate)

    # AI route
    app.router.add_get("/api/ai/analyze", handle_ai_analyze)

    # Webhook
    await bot.set_webhook(full_webhook, drop_pending_updates=True)
    logger.info(f"Webhook o'rnatildi: {full_webhook}")

    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)

    port = int(os.environ.get("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info(f"Server ishlamoqda: http://0.0.0.0:{port}")

    # Sonsiz kutish — signal kelguncha
    stop_event = asyncio.Event()

    import signal

    def _stop(*_):
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, _stop)
        except NotImplementedError:
            pass

    await stop_event.wait()
    await runner.cleanup()
    await bot.delete_webhook()


if __name__ == "__main__":
    asyncio.run(main())


