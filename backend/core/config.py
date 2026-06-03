import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN       = os.getenv("BOT_TOKEN", "")
ADMIN_ID        = int(os.getenv("ADMIN_ID", "0"))
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")

# Bir nechta Gemini kalit — ikki usulda berilishi mumkin:
# 1) GEMINI_API_KEYS=key1,key2,key3  (yangi field)
# 2) GEMINI_API_KEY=key1,key2,key3   (mavjud field, vergul bilan)
_raw_keys = os.getenv("GEMINI_API_KEYS", "") or GEMINI_API_KEY
GEMINI_API_KEYS: list = [k.strip() for k in _raw_keys.split(",") if k.strip()]

# Kanal(lar) — vergul bilan ajratilgan (@channel yoki -100xxx)
CHANNELS = [c.strip() for c in os.getenv("CHANNELS", "").split(",") if c.strip()]

# PostgreSQL (asyncpg)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Webhook (Render/Railway da to'liq URL, lokal bo'sh qoladi → polling)
WEBHOOK_URL  = os.getenv("WEBHOOK_URL", "")   # https://myapp.onrender.com
WEBHOOK_PATH = "/webhook"

# Logging
LOG_LEVEL  = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s %(message)s"
LOG_FILE   = os.getenv("LOG_FILE", "")
