"""
Bank kurslari taqqoslash xabarlarini formatlash moduli.

Mavjud BankRatesFormatter (kanal postlari uchun) dan alohida —
bu modul interaktiv bot xabarlariga (qisqa, inline-keyboard bilan) mo'ljallangan.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


# ── Yordamchi konstantlar ────────────────────────────────────────────────────

CURRENCY_FLAGS = {"USD": "🇺🇸", "EUR": "🇪🇺", "RUB": "🇷🇺"}
MEDAL = {1: "🥇", 2: "🥈", 3: "🥉"}

SORT_DESCRIPTIONS = {
    "buy":    "sotib olish narxi bo'yicha (yuqoridan)",
    "sell":   "sotish narxi bo'yicha (pastdan)",
    "spread": "eng kichik spread bo'yicha",
}


# ── Formatlash sinfi ─────────────────────────────────────────────────────────

class BankComparisonFormatter:
    """
    Bank kurslari taqqoslash xabarlarini HTML formatida tayyorlaydi.

    Barcha public metodlar str qaytaradi — to'g'ridan-to'g'ri
    bot.send_message(..., parse_mode="HTML") ga uzatiladi.
    """

    # ── Asosiy ro'yxat ───────────────────────────────────────────────────────

    def format_comparison_table(
        self,
        banks: list[dict[str, Any]],
        currency: str = "USD",
        sort_by: str = "buy",
        top_n: int = 10,
    ) -> str:
        """
        To'liq taqqoslash jadvalini qaytaradi.

        banks — [{"name": str, "buy": float, "sell": float}, ...] ro'yxati
        """
        if not banks:
            return self._no_data_message(currency)

        sorted_banks = self._sort(banks, sort_by)
        flag = CURRENCY_FLAGS.get(currency, "💱")
        now = datetime.now().strftime("%H:%M")

        lines: list[str] = [
            f"{flag} <b>Bank kurslari — {currency}/UZS</b>",
            f"<i>Saralash: {SORT_DESCRIPTIONS[sort_by]}</i>",
            f"<i>🕐 {now} da yangilangan</i>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ]

        for rank, bank in enumerate(sorted_banks[:top_n], start=1):
            lines.append(self._format_bank_row(rank, bank))

        # Xulosa: eng yaxshi buy va sell
        lines += [
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            self._format_best_summary(banks, currency),
            "",
            "<i>📌 Manba: bank.uz</i>",
        ]

        return "\n".join(lines)

    # ── Bitta bank qatori ────────────────────────────────────────────────────

    def _format_bank_row(self, rank: int, bank: dict[str, Any]) -> str:
        """
        Bitta bank uchun:
          🥇 Universal Bank
             📗 12 150 | 📕 12 250 | Spread: 100
        """
        name   = bank.get("name", "Noma'lum")[:24]
        buy    = bank.get("buy", 0)
        sell   = bank.get("sell", 0)
        spread = sell - buy if (buy and sell) else 0

        icon = MEDAL.get(rank, f"<b>{rank}.</b>")

        return (
            f"{icon} <b>{name}</b>\n"
            f"   📗 <code>{buy:>9,.0f}</code>  "
            f"📕 <code>{sell:>9,.0f}</code>  "
            f"<i>±{spread:,.0f}</i>"
        )

    # ── Xulosa satri ─────────────────────────────────────────────────────────

    def _format_best_summary(
        self, banks: list[dict[str, Any]], currency: str
    ) -> str:
        """Eng yaxshi sotib olish va sotish bankini ajratib ko'rsatadi."""
        try:
            best_buy  = max(banks, key=lambda b: b.get("buy", 0))
            best_sell = min(
                (b for b in banks if b.get("sell", 0) > 0),
                key=lambda b: b.get("sell", float("inf")),
            )
        except (ValueError, TypeError):
            return ""

        return (
            f"✅ Eng yuqori sotib olish: <b>{best_buy['name']}</b> — "
            f"<code>{best_buy['buy']:,.0f}</code>\n"
            f"✅ Eng past sotish: <b>{best_sell['name']}</b> — "
            f"<code>{best_sell['sell']:,.0f}</code>"
        )

    # ── Xato va bo'sh holat xabarlari ────────────────────────────────────────

    def _no_data_message(self, currency: str) -> str:
        return (
            f"⚠️ <b>{currency} uchun bank ma'lumotlari topilmadi.</b>\n\n"
            "Bir necha daqiqadan so'ng qayta urinib ko'ring.\n"
            "<i>Manba: bank.uz vaqtincha mavjud bo'lmasligi mumkin.</i>"
        )

    def format_error(self, detail: str = "") -> str:
        """Foydalanuvchiga ko'rsatiladigan xato xabari."""
        base = "❌ Ma'lumotlarni yuklashda xato yuz berdi."
        if detail:
            logger.warning("BankFormatter error detail: %s", detail)
        return f"{base}\n\n🔄 Iltimos, <b>Yangilash</b> tugmasini bosing."

    # ── Saralash ─────────────────────────────────────────────────────────────

    @staticmethod
    def _sort(
        banks: list[dict[str, Any]], sort_by: str
    ) -> list[dict[str, Any]]:
        """
        buy    → sotib olish narxi bo'yicha kamayish tartibida
                 (yuqoriroq = foydalanuvchi ko'proq pul oladi)
        sell   → sotish narxi bo'yicha o'sish tartibida
                 (pastroq = foydalanuvchi kam pul beradi)
        spread → (sell - buy) farqi bo'yicha o'sish tartibida
                 (kichikroq = bozor likvidliroq)
        """
        if sort_by == "buy":
            return sorted(banks, key=lambda b: b.get("buy", 0), reverse=True)
        if sort_by == "sell":
            return sorted(
                banks, key=lambda b: b.get("sell", float("inf"))
            )
        if sort_by == "spread":
            return sorted(
                banks,
                key=lambda b: b.get("sell", 0) - b.get("buy", 0),
            )
        return banks
