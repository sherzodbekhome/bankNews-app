"""
Batafsil valyuta va bank kurslari postlari
Banklar ma'lumotlari bilan formatted posts
"""
import logging
from datetime import datetime
from typing import Any, Dict

logger = logging.getLogger(__name__)


class BankRatesFormatter:
    """Bank kurslari va batafsil valyuta postlari - Real API dan olingan"""
    
    
    @staticmethod
    def _format_cbu_block(cbu: Dict) -> str:
        """CBU rasmiy kurs blokini formatlash"""
        if not cbu or not cbu.get('USD'):
            return ""
        usd = cbu['USD']
        diff_usd = cbu.get('diff_usd', 0)
        eur = cbu.get('EUR', 0)
        diff_eur = cbu.get('diff_eur', 0)
        rub = cbu.get('RUB', 0)
        diff_rub = cbu.get('diff_rub', 0)

        def arrow(d): return "⬆️" if d > 0 else "⬇️" if d < 0 else "➡️"

        block = f"🏛 <b>CBU rasmiy kursi | Официальный курс ЦБ</b>\n"
        block += f"  🇺🇸 USD: <b>{usd:,.2f}</b> so'm  {arrow(diff_usd)} {diff_usd:+.2f}\n".replace(",", " ")
        if eur:
            block += f"  🇪🇺 EUR: <b>{eur:,.2f}</b> so'm  {arrow(diff_eur)} {diff_eur:+.2f}\n".replace(",", " ")
        if rub:
            block += f"  🇷🇺 RUB: <b>{rub:,.2f}</b> so'm  {arrow(diff_rub)} {diff_rub:+.2f}\n".replace(",", " ")
        return block

    @staticmethod
    def format_complete_rates(
        currency_rates: Dict[str, float],
        bank_data: Dict = None,
        date_str: str = None
    ) -> str:
        """Valyuta kurslari + bank.uz tijorat banklari — kanal post formati"""
        if date_str is None:
            date_str = datetime.now().strftime('%d.%m.%Y')

        cbu_meta = bank_data.get('cbu_rate', {}) if isinstance(bank_data, dict) else {}

        message  = f"<b>Valyuta kurslari | Курсы валют</b>\n"
        message += f"<b>{date_str}</b>\n"

        # CBU rasmiy kursi — sarlavhaga yaqin, bo'sh qatorsiz
        cbu_block = BankRatesFormatter._format_cbu_block(cbu_meta)
        if cbu_block:
            message += cbu_block + "\n"

        BOT_LINK = '<a href="https://t.me/BankNews_Official_bot">📲 To\'liq kurs va valyuta hisob-kitobi uchun botga kiring</a>'

        # ── USD sotib olish — TOP 10 (eng qimati) ──
        if bank_data and bank_data.get('buying_usd'):
            buying = sorted(bank_data['buying_usd'], key=lambda x: x[1], reverse=True)[:10]
            message += "💵 <b>USD sotib olish | Покупка:</b>\n"
            for name, rate in buying:
                message += f"  {name} — <b>{rate:,}</b>\n".replace(",", " ")
            message += f"{BOT_LINK}\n\n"

        # ── USD sotish — TOP 10 (eng arzoni) ──
        if bank_data and bank_data.get('selling_usd'):
            selling = sorted(bank_data['selling_usd'], key=lambda x: x[1])[:10]
            message += "💵 <b>USD sotish | Продажа:</b>\n"
            for name, rate in selling:
                message += f"  {name} — <b>{rate:,}</b>\n".replace(",", " ")
            message += f"{BOT_LINK}\n\n"

        # ── RUB sotib olish — TOP 5 (eng qimati) ──
        if bank_data and bank_data.get('buying_rub'):
            buying_rub = sorted(bank_data['buying_rub'], key=lambda x: x[1], reverse=True)[:5]
            message += "🇷🇺 <b>RUB sotib olish | Покупка:</b>\n"
            for name, rate in buying_rub:
                message += f"  {name} — <b>{rate:,}</b>\n".replace(",", " ")
            message += f"{BOT_LINK}\n\n"

        message = message.rstrip()

        return message
    
