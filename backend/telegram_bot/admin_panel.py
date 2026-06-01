"""
Admin panel — bank kurslarini qo'lda kiritish moduli
bot.py ga import qilinadi
"""
import aiohttp
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
from aiogram import types
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.filters import Command

from core.database import db

# ── Holatlar (FSM) ─────────────────────────────────────────────────
class BankRateStates(StatesGroup):
    waiting_currency   = State()
    waiting_buy_rate   = State()
    waiting_sell_rate  = State()


async def get_current_rates() -> dict:
    """Hozirgi kurslarni olish (bot.py dan chaqiriladi)"""
    return await db.get_bank_rates()


# ── Admin panel ────────────────────────────────────────────────────
def register_admin_handlers(dp, bot, ADMIN_ID: int, CHANNELS: list):

    async def _show_admin_panel(target: types.Message):
        rates = await db.get_bank_rates()

        text = (
            "🏦 <b>Admin Panel — Bank Kurslari</b>\n\n"
            "<b>Hozirgi kurslar:</b>\n"
        )

        for cur, emoji in [('USD','🇺🇸'), ('EUR','🇪🇺'), ('RUB','🇷🇺')]:
            r = rates.get(cur, {})
            if r.get('buy'):
                text += f"{emoji} <b>{cur}:</b> {r['buy']:,} / {r['sell']:,} so'm\n".replace(",", " ")
                text += f"   <i>Yangilangan: {r.get('updated','?')}</i>\n"
            else:
                text += f"{emoji} <b>{cur}:</b> <i>Kiritilmagan</i>\n"

        keyboard = types.InlineKeyboardMarkup(inline_keyboard=[
            [
                types.InlineKeyboardButton(text="🇺🇸 USD kiriting", callback_data="admin_rate_USD"),
                types.InlineKeyboardButton(text="🇪🇺 EUR kiriting", callback_data="admin_rate_EUR"),
            ],
            [
                types.InlineKeyboardButton(text="🇷🇺 RUB kiriting", callback_data="admin_rate_RUB"),
            ],
            [
                types.InlineKeyboardButton(text="📢 Kanalga post qil", callback_data="admin_post_rates"),
            ],
            [
                types.InlineKeyboardButton(text="🔄 CBU dan yangilash", callback_data="admin_update_cbu"),
            ],
        ])

        await target.answer(text, parse_mode="HTML", reply_markup=keyboard)

    @dp.message(Command("admin"))
    async def cmd_admin(message: types.Message):
        if message.from_user.id != ADMIN_ID:
            await message.answer("❌ Ruxsat yo'q!")
            return
        await _show_admin_panel(message)

    @dp.callback_query(lambda c: c.data.startswith("admin_rate_"))
    async def cb_select_currency(callback: types.CallbackQuery, state: FSMContext):
        if callback.from_user.id != ADMIN_ID:
            return

        currency = callback.data.replace("admin_rate_", "")
        await state.update_data(currency=currency)
        await state.set_state(BankRateStates.waiting_buy_rate)

        flags = {'USD':'🇺🇸', 'EUR':'🇪🇺', 'RUB':'🇷🇺'}
        await callback.message.answer(
            f"{flags.get(currency,'')} <b>{currency}</b> uchun kurs kiriting\n\n"
            f"<b>Sotib olish (buy)</b> kursini yozing:\n"
            f"<i>Masalan: 12130</i>",
            parse_mode="HTML"
        )
        await callback.answer()

    @dp.message(BankRateStates.waiting_buy_rate)
    async def handle_buy_rate(message: types.Message, state: FSMContext):
        if message.from_user.id != ADMIN_ID:
            return

        try:
            buy = float(message.text.strip().replace(',', '.').replace(' ', ''))
            if buy < 100:
                raise ValueError("Juda kichik")
        except (ValueError, TypeError):
            await message.answer("❌ Noto'g'ri raqam! Qaytadan kiriting:\n<i>Masalan: 12130</i>", parse_mode="HTML")
            return

        await state.update_data(buy=buy)
        await state.set_state(BankRateStates.waiting_sell_rate)

        await message.answer(
            f"✅ Sotib olish: <b>{buy:,.0f}</b> so'm\n\n"
            f"Endi <b>Sotish (sell)</b> kursini yozing:\n"
            f"<i>Masalan: 12200</i>",
            parse_mode="HTML"
        )

    @dp.message(BankRateStates.waiting_sell_rate)
    async def handle_sell_rate(message: types.Message, state: FSMContext):
        if message.from_user.id != ADMIN_ID:
            return

        try:
            sell = float(message.text.strip().replace(',', '.').replace(' ', ''))
            if sell < 100:
                raise ValueError("Juda kichik")
        except (ValueError, TypeError):
            await message.answer("❌ Noto'g'ri raqam! Qaytadan kiriting:", parse_mode="HTML")
            return

        data = await state.get_data()
        buy  = data['buy']
        cur  = data['currency']

        if sell < buy:
            await message.answer("❌ Sotish narxi sotib olishdan past bo'lmasligi kerak!")
            return

        updated_at = datetime.now().strftime('%d.%m.%Y %H:%M')
        await db.save_bank_rate(cur, buy, sell, updated_at)
        await state.clear()

        flags = {'USD':'🇺🇸','EUR':'🇪🇺','RUB':'🇷🇺'}
        keyboard = types.InlineKeyboardMarkup(inline_keyboard=[
            [
                types.InlineKeyboardButton(text="📢 Hozir kanalga post qil", callback_data="admin_post_rates"),
                types.InlineKeyboardButton(text="🔙 Admin panel", callback_data="admin_back"),
            ]
        ])

        await message.answer(
            f"✅ <b>{cur} kursi saqlandi!</b>\n\n"
            f"{flags.get(cur,'')} {cur}:\n"
            f"  Sotib olish: <b>{buy:,.0f}</b> so'm\n"
            f"  Sotish: <b>{sell:,.0f}</b> so'm\n"
            f"  Farq: <b>{sell-buy:,.0f}</b> so'm".replace(",", " "),
            parse_mode="HTML",
            reply_markup=keyboard
        )

    @dp.callback_query(lambda c: c.data == "admin_post_rates")
    async def cb_post_rates(callback: types.CallbackQuery):
        if callback.from_user.id != ADMIN_ID:
            return

        rates = await db.get_bank_rates()
        now   = datetime.now().strftime('%d.%m.%Y %H:%M')

        lines = [f"💱 <b>Valyuta Kurslari</b> | {now}\n"]
        flags = {'USD':'🇺🇸','EUR':'🇪🇺','RUB':'🇷🇺'}

        has_data = False
        for cur in ['USD', 'EUR', 'RUB']:
            r = rates.get(cur, {})
            if r.get('buy'):
                has_data = True
                lines.append((
                    f"{flags[cur]} <b>{cur}:</b>\n"
                    f"  ↗️ Sotib olish: <b>{int(r['buy']):,}</b> so'm\n"
                    f"  ↘️ Sotish: <b>{int(r['sell']):,}</b> so'm"
                ).replace(",", " "))

        if not has_data:
            await callback.answer("❌ Hech qanday kurs kiritilmagan!", show_alert=True)
            return

        lines.append(f"\n📌 @BankNews_official")
        text = "\n".join(lines)

        sent = 0
        for channel_id in CHANNELS:
            try:
                await bot.send_message(
                    chat_id=channel_id,
                    text=text,
                    parse_mode="HTML"
                )
                sent += 1
            except Exception as e:
                logger.error(f"Post xatosi {channel_id}: {e}")

        await callback.answer(f"✅ {sent} ta kanalga yuborildi!")
        await callback.message.answer(
            f"✅ <b>{sent} ta kanalga post yuborildi!</b>\n\n{text}",
            parse_mode="HTML"
        )

    @dp.callback_query(lambda c: c.data == "admin_update_cbu")
    async def cb_update_cbu(callback: types.CallbackQuery):
        if callback.from_user.id != ADMIN_ID:
            return

        await callback.answer("⏳ CBU dan yuklanmoqda...")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    'https://cbu.uz/uz/arkhiv-kursov-valyut/json/',
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as r:
                    data = await r.json(content_type=None)

            cbu = {item['Ccy']: float(item['Rate']) for item in data
                   if item['Ccy'] in ['USD', 'EUR', 'RUB']}

            margins = {'USD': (0.9990, 1.0048), 'EUR': (0.9990, 1.0048), 'RUB': (0.9985, 1.0050)}

            now  = datetime.now().strftime('%d.%m.%Y %H:%M')
            text = "📊 <b>CBU kurslari yangilandi:</b>\n\n"
            flags = {'USD':'🇺🇸','EUR':'🇪🇺','RUB':'🇷🇺'}

            for cur, base in cbu.items():
                bk, sk = margins[cur]
                buy  = round(base * bk)
                sell = round(base * sk)
                await db.save_bank_rate(cur, buy, sell, now)
                text += (f"{flags[cur]} <b>{cur}:</b> {base:,.2f} so'm (CBU)\n"
                         f"  Bank: {buy:,} / {sell:,} so'm\n").replace(",", " ")

            text += f"\n<i>Manba: cbu.uz • {now}</i>"

            keyboard = types.InlineKeyboardMarkup(inline_keyboard=[[
                types.InlineKeyboardButton(text="📢 Kanalga post qil", callback_data="admin_post_rates")
            ]])

            await callback.message.answer(text, parse_mode="HTML", reply_markup=keyboard)

        except Exception as e:
            await callback.message.answer(f"❌ Xato: {e}")

    @dp.callback_query(lambda c: c.data == "admin_back")
    async def cb_admin_back(callback: types.CallbackQuery):
        if callback.from_user.id != ADMIN_ID:
            return
        await callback.answer()
        await _show_admin_panel(callback.message)
