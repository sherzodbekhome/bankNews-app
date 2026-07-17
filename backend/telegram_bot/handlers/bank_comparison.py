"""
/banklar — bank kurslari taqqoslash handler.
"""
import logging
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command

from backend.api_handlers import BankUzHandler
from telegram_bot.bank_comparison_formatter import BankComparisonFormatter

logger = logging.getLogger(__name__)
router = Router()
_fmt   = BankComparisonFormatter()


def _kb(currency: str, sort_by: str) -> InlineKeyboardMarkup:
    currencies = [("🇺🇸 USD", "USD"), ("🇪🇺 EUR", "EUR"), ("🇷🇺 RUB", "RUB")]
    sorts      = [("⬆️ Sotib olish", "buy"), ("⬇️ Sotish", "sell"), ("📊 Spread", "spread")]

    rows = []
    row1 = []
    for label, ccy in currencies:
        mark = "✅ " if ccy == currency else ""
        row1.append(InlineKeyboardButton(
            text=f"{mark}{label}",
            callback_data=f"bk:{ccy}:{sort_by}",
        ))
    rows.append(row1)

    row2 = []
    for label, srt in sorts:
        mark = "✅ " if srt == sort_by else ""
        row2.append(InlineKeyboardButton(
            text=f"{mark}{label}",
            callback_data=f"bk:{currency}:{srt}",
        ))
    rows.append(row2)
    rows.append([InlineKeyboardButton(text="🔄 Yangilash", callback_data=f"bk:{currency}:{sort_by}")])

    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _build_text(currency: str, sort_by: str) -> str:
    raw: dict = await BankUzHandler.get_commercial_rates() or {}

    buy_dict  = {n: r for n, r in raw.get(f"buying_{currency.lower()}",  [])}
    sell_dict = {n: r for n, r in raw.get(f"selling_{currency.lower()}", [])}
    all_names = set(buy_dict) | set(sell_dict)

    banks = [
        {
            "name":   name,
            "buy":    buy_dict.get(name, 0),
            "sell":   sell_dict.get(name, 0),
        }
        for name in all_names
        if buy_dict.get(name, 0) or sell_dict.get(name, 0)
    ]

    if not banks:
        return "❌ Bank.uz dan ma'lumot olinmadi. Keyinroq urinib ko'ring."

    return _fmt.format_comparison_table(banks, currency=currency, sort_by=sort_by)


@router.message(Command("banklar"))
async def cmd_banklar(message: Message):
    currency = "USD"
    sort_by  = "buy"
    msg = await message.answer("⏳ Ma'lumotlar yuklanmoqda...")
    text = await _build_text(currency, sort_by)
    await msg.edit_text(text, parse_mode="HTML", reply_markup=_kb(currency, sort_by))


@router.callback_query(F.data.startswith("bk:"))
async def cb_banklar(call: CallbackQuery):
    _, currency, sort_by = call.data.split(":", 2)
    await call.answer("⏳")
    text = await _build_text(currency, sort_by)
    try:
        await call.message.edit_text(
            text, parse_mode="HTML", reply_markup=_kb(currency, sort_by)
        )
    except Exception as e:
        # "message is not modified" — foydalanuvchi bir xil tugmani bosgan, zararsiz
        if "message is not modified" in str(e).lower():
            logger.debug(f"edit_text o'tkazib yuborildi: {e}")
        else:
            logger.warning(f"Bank taqqoslash xabarini yangilab bo'lmadi: {e}")
