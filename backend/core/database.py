"""
asyncpg orqali PostgreSQL ulanishi.
Connection pool: min 5, max 20 — 100k+ foydalanuvchi uchun.

Agar DATABASE_URL bo'lmasa — barcha metodlar None/[] qaytaradi (graceful degradation).
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import asyncpg
    _ASYNCPG = True
except ImportError:
    asyncpg = None
    _ASYNCPG = False
    logger.warning("asyncpg o'rnatilmagan — DB ishlamaydi")


_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS users (
    user_id     BIGINT PRIMARY KEY,
    username    TEXT,
    first_name  TEXT,
    language_code TEXT DEFAULT 'uz',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_actions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT,
    command     TEXT,
    action      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_actions_user ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_ts   ON user_actions(created_at);

CREATE TABLE IF NOT EXISTS errors (
    id            BIGSERIAL PRIMARY KEY,
    error_type    TEXT,
    error_message TEXT,
    component     TEXT,
    severity      TEXT DEFAULT 'error',
    reported      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_rates (
    currency   TEXT PRIMARY KEY,
    buy        NUMERIC,
    sell       NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_rates (
    date     DATE PRIMARY KEY,
    rates    JSONB,
    saved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS web_users (
    uid        TEXT PRIMARY KEY,
    email      TEXT,
    name       TEXT,
    picture    TEXT,
    provider   TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS web_alerts (
    id         BIGSERIAL PRIMARY KEY,
    uid        TEXT NOT NULL,
    currency   TEXT NOT NULL,
    direction  TEXT NOT NULL,
    threshold  NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_web_alerts_uid ON web_alerts(uid);

CREATE TABLE IF NOT EXISTS web_portfolios (
    uid        TEXT PRIMARY KEY,
    portfolio  JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_overrides (
    currency   TEXT PRIMARY KEY,
    buy        NUMERIC,
    sell       NUMERIC,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
"""


class Database:
    def __init__(self):
        self._pool = None

    # ── Ulanish ────────────────────────────────────────────────────────────────

    async def connect(self, dsn: str):
        if not _ASYNCPG or not dsn:
            logger.warning("DB ulanish o'tkazib yuborildi (asyncpg yo'q yoki DSN bo'sh)")
            return
        try:
            self._pool = await asyncpg.create_pool(
                dsn,
                min_size=5,
                max_size=20,
                command_timeout=30,
                max_inactive_connection_lifetime=300,
            )
            async with self._pool.acquire() as conn:
                await conn.execute(_CREATE_TABLES)
            logger.info("PostgreSQL ulanish muvaffaqiyatli")
        except Exception as e:
            logger.error(f"DB ulanish xatosi: {e}")
            self._pool = None

    async def close(self):
        if self._pool:
            await self._pool.close()
            logger.info("DB ulanish yopildi")

    def _ok(self) -> bool:
        return self._pool is not None

    # ── Foydalanuvchilar ───────────────────────────────────────────────────────

    async def add_or_update_user(
        self,
        user_id: int,
        username: Optional[str] = None,
        first_name: Optional[str] = None,
        language_code: str = "uz",
    ):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO users(user_id, username, first_name, language_code, last_active)
                    VALUES($1,$2,$3,$4,NOW())
                    ON CONFLICT(user_id) DO UPDATE
                      SET username=EXCLUDED.username,
                          first_name=EXCLUDED.first_name,
                          language_code=EXCLUDED.language_code,
                          last_active=NOW()
                    """,
                    user_id, username, first_name, language_code,
                )
        except Exception as e:
            logger.error(f"add_or_update_user: {e}")

    async def get_user(self, user_id) -> Optional[Dict]:
        if not self._ok():
            return None
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM users WHERE user_id=$1", int(user_id))
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"get_user: {e}")
            return None

    async def get_all_active_users(self, days: int = 90) -> List[int]:
        """Son `days` kun ichida aktiv bo'lgan user_id lar"""
        if not self._ok():
            return []
        try:
            since = datetime.utcnow() - timedelta(days=days)
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT user_id FROM users WHERE last_active > $1", since
                )
                return [r["user_id"] for r in rows]
        except Exception as e:
            logger.error(f"get_all_active_users: {e}")
            return []

    async def get_active_users_count(self, hours: int = 24) -> int:
        if not self._ok():
            return 0
        try:
            since = datetime.utcnow() - timedelta(hours=hours)
            async with self._pool.acquire() as conn:
                return await conn.fetchval(
                    "SELECT COUNT(*) FROM users WHERE last_active > $1", since
                )
        except Exception as e:
            logger.error(f"get_active_users_count: {e}")
            return 0

    # ── Harakatlar logi ────────────────────────────────────────────────────────

    async def log_user_action(
        self,
        user_id: int,
        command: Optional[str] = None,
        action: Optional[str] = None,
    ):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO user_actions(user_id,command,action) VALUES($1,$2,$3)",
                    user_id, command, action,
                )
        except Exception as e:
            logger.error(f"log_user_action: {e}")

    async def get_user_stats(self, user_id: int) -> Dict:
        if not self._ok():
            return {}
        try:
            async with self._pool.acquire() as conn:
                total = await conn.fetchval(
                    "SELECT COUNT(*) FROM user_actions WHERE user_id=$1", user_id
                )
                return {"total_actions": total or 0}
        except Exception as e:
            logger.error(f"get_user_stats: {e}")
            return {}

    async def get_global_stats(self) -> Dict:
        if not self._ok():
            return {}
        try:
            async with self._pool.acquire() as conn:
                users  = await conn.fetchval("SELECT COUNT(*) FROM users")
                active = await conn.fetchval(
                    "SELECT COUNT(*) FROM users WHERE last_active > NOW() - INTERVAL '24 hours'"
                )
                return {"total_users": users or 0, "active_24h": active or 0}
        except Exception as e:
            logger.error(f"get_global_stats: {e}")
            return {}

    async def get_top_commands(self, limit: int = 10) -> List[Dict]:
        if not self._ok():
            return []
        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT command, COUNT(*) as cnt
                       FROM user_actions WHERE command IS NOT NULL
                       GROUP BY command ORDER BY cnt DESC LIMIT $1""",
                    limit,
                )
                return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"get_top_commands: {e}")
            return []

    # ── Xatolar ───────────────────────────────────────────────────────────────

    async def log_error(
        self,
        error_type: str,
        error_message: str,
        component: str = "",
        severity: str = "error",
    ):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO errors(error_type,error_message,component,severity) VALUES($1,$2,$3,$4)",
                    error_type, error_message, component, severity,
                )
        except Exception as e:
            logger.error(f"log_error: {e}")

    async def get_unreported_errors(self, limit: int = 20) -> List[Dict]:
        if not self._ok():
            return []
        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT * FROM errors WHERE reported=FALSE ORDER BY created_at DESC LIMIT $1",
                    limit,
                )
                return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"get_unreported_errors: {e}")
            return []

    async def mark_all_errors_reported(self):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute("UPDATE errors SET reported=TRUE WHERE reported=FALSE")
        except Exception as e:
            logger.error(f"mark_all_errors_reported: {e}")

    # ── Bank kurslari (qo'lda kiritilgan) ─────────────────────────────────────

    async def get_bank_rates(self) -> Dict:
        if not self._ok():
            return {}
        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch("SELECT * FROM bank_rates")
                return {
                    r["currency"]: {
                        "buy":     float(r["buy"]) if r["buy"] else 0,
                        "sell":    float(r["sell"]) if r["sell"] else 0,
                        "updated": r["updated_at"].strftime("%H:%M %d.%m.%Y") if r["updated_at"] else "",
                    }
                    for r in rows
                }
        except Exception as e:
            logger.error(f"get_bank_rates: {e}")
            return {}

    async def save_bank_rate(self, currency: str, buy: float, sell: float, updated_at: str = None):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO bank_rates(currency,buy,sell,updated_at)
                       VALUES($1,$2,$3,NOW())
                       ON CONFLICT(currency) DO UPDATE
                         SET buy=$2, sell=$3, updated_at=NOW()""",
                    currency.upper(), buy, sell,
                )
        except Exception as e:
            logger.error(f"save_bank_rate: {e}")

    async def save_rate_override(self, currency: str, buy: float, sell: float, updated_by: str = ""):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO rate_overrides(currency,buy,sell,updated_by,updated_at)
                       VALUES($1,$2,$3,$4,NOW())
                       ON CONFLICT(currency) DO UPDATE
                         SET buy=$2, sell=$3, updated_by=$4, updated_at=NOW()""",
                    currency.upper(), buy, sell, updated_by,
                )
        except Exception as e:
            logger.error(f"save_rate_override: {e}")

    # ── Kunlik kurslar tarixi ──────────────────────────────────────────────────

    async def save_daily_rates(self, date: str, rates: Dict):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO daily_rates(date,rates) VALUES($1,$2)
                       ON CONFLICT(date) DO UPDATE SET rates=$2, saved_at=NOW()""",
                    date, json.dumps(rates),
                )
        except Exception as e:
            logger.error(f"save_daily_rates: {e}")

    async def get_rates_for_date(self, date: str) -> Optional[Dict]:
        if not self._ok():
            return None
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow("SELECT rates FROM daily_rates WHERE date=$1", date)
                return json.loads(row["rates"]) if row else None
        except Exception as e:
            logger.error(f"get_rates_for_date: {e}")
            return None

    async def get_latest_saved_rates(self) -> Optional[Dict]:
        if not self._ok():
            return None
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT rates FROM daily_rates ORDER BY date DESC LIMIT 1"
                )
                return json.loads(row["rates"]) if row else None
        except Exception as e:
            logger.error(f"get_latest_saved_rates: {e}")
            return None

    # ── Ogohlantirishlar (Telegram bot) ────────────────────────────────────────

    async def get_active_alerts(self) -> List[Dict]:
        if not self._ok():
            return []
        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch("SELECT * FROM web_alerts ORDER BY created_at")
                return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"get_active_alerts: {e}")
            return []

    async def remove_alert(self, alert_id: int):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute("DELETE FROM web_alerts WHERE id=$1", alert_id)
        except Exception as e:
            logger.error(f"remove_alert: {e}")

    # ── Obunalar (Telegram kanallar) ───────────────────────────────────────────

    async def get_subscribers(self, channel: str = "") -> List[int]:
        """Kanal obunachilari — hozircha barcha aktiv userlarni qaytaradi"""
        return await self.get_all_active_users()

    async def remove_subscription(self, user_id: int, channel: str = ""):
        pass  # Hozircha faqat aktiv users asosida

    # ── O'yinlar (guess game) ──────────────────────────────────────────────────

    async def get_guesses_for_date(self, date: str) -> List[Dict]:
        return []

    async def update_guess_results(self, date: str, results: Dict):
        pass

    # ── Eski ma'lumotlarni tozalash ────────────────────────────────────────────

    async def cleanup_old_data(self, days: int = 30):
        if not self._ok():
            return
        try:
            cutoff = datetime.utcnow() - timedelta(days=days)
            async with self._pool.acquire() as conn:
                await conn.execute("DELETE FROM user_actions WHERE created_at < $1", cutoff)
                await conn.execute("DELETE FROM errors WHERE created_at < $1 AND reported=TRUE", cutoff)
        except Exception as e:
            logger.error(f"cleanup_old_data: {e}")

    # ── Web foydalanuvchilar ───────────────────────────────────────────────────

    async def upsert_web_user(
        self,
        uid: str,
        email: str = "",
        name: str = "",
        picture: str = "",
        provider: str = "",
    ):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO web_users(uid,email,name,picture,provider,last_seen)
                       VALUES($1,$2,$3,$4,$5,NOW())
                       ON CONFLICT(uid) DO UPDATE
                         SET email=$2, name=$3, picture=$4, provider=$5, last_seen=NOW()""",
                    uid, email, name, picture, provider,
                )
        except Exception as e:
            logger.error(f"upsert_web_user: {e}")

    async def get_web_user(self, uid: str) -> Optional[Dict]:
        if not self._ok():
            return None
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM web_users WHERE uid=$1", uid)
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"get_web_user: {e}")
            return None

    async def get_web_users_count(self) -> int:
        if not self._ok():
            return 0
        try:
            async with self._pool.acquire() as conn:
                return await conn.fetchval("SELECT COUNT(*) FROM web_users")
        except Exception as e:
            logger.error(f"get_web_users_count: {e}")
            return 0

    async def get_web_alerts_count(self) -> int:
        if not self._ok():
            return 0
        try:
            async with self._pool.acquire() as conn:
                return await conn.fetchval("SELECT COUNT(*) FROM web_alerts")
        except Exception as e:
            logger.error(f"get_web_alerts_count: {e}")
            return 0

    async def get_user_alerts(self, uid: str) -> List[Dict]:
        if not self._ok():
            return []
        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT * FROM web_alerts WHERE uid=$1 ORDER BY created_at", uid
                )
                return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"get_user_alerts: {e}")
            return []

    async def add_user_alert(
        self, uid: str, currency: str, direction: str, threshold: float
    ) -> Optional[int]:
        if not self._ok():
            return None
        try:
            async with self._pool.acquire() as conn:
                return await conn.fetchval(
                    """INSERT INTO web_alerts(uid,currency,direction,threshold)
                       VALUES($1,$2,$3,$4) RETURNING id""",
                    uid, currency.upper(), direction, threshold,
                )
        except Exception as e:
            logger.error(f"add_user_alert: {e}")
            return None

    async def delete_user_alert(self, uid: str, alert_id: int):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM web_alerts WHERE id=$1 AND uid=$2", int(alert_id), uid
                )
        except Exception as e:
            logger.error(f"delete_user_alert: {e}")

    async def get_web_portfolio(self, uid: str) -> List:
        if not self._ok():
            return []
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT portfolio FROM web_portfolios WHERE uid=$1", uid
                )
                if not row:
                    return []
                val = row["portfolio"]
                return json.loads(val) if isinstance(val, str) else (val or [])
        except Exception as e:
            logger.error(f"get_web_portfolio: {e}")
            return []

    async def save_web_portfolio(self, uid: str, portfolio: List):
        if not self._ok():
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO web_portfolios(uid,portfolio,updated_at)
                       VALUES($1,$2,NOW())
                       ON CONFLICT(uid) DO UPDATE
                         SET portfolio=$2, updated_at=NOW()""",
                    uid, json.dumps(portfolio),
                )
        except Exception as e:
            logger.error(f"save_web_portfolio: {e}")


db = Database()
