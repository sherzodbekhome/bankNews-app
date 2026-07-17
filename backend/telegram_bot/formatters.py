"""
Post xabarlarni formatlash
"""
from datetime import datetime
from typing import Dict, Optional

from core.cache_manager import get_usd_uzs_rate
from core.formatting import num


class MessageFormatter:
    """Xabarlarni chiroyli formatda yaratish"""
    
    @staticmethod
    def format_metals_section(metals: Dict[str, float]) -> str:
        """Qimmatbaho metalllarni formatlab qaytarish"""
        if not metals:
            return "❌ Metallar narxi ma'lumoti mavjud emas"

        TROY_OZ_TO_G = 31.1035
        gold_oz = metals.get('Gold', 0)
        silver_oz = metals.get('Silver', 0)
        gold_g = gold_oz / TROY_OZ_TO_G
        silver_g = silver_oz / TROY_OZ_TO_G

        usd_to_uzs = get_usd_uzs_rate()

        gold_oz_uzs = int(gold_oz * usd_to_uzs)
        gold_g_uzs = int(gold_g * usd_to_uzs)
        silver_oz_uzs = int(silver_oz * usd_to_uzs)
        silver_g_uzs = int(silver_g * usd_to_uzs)

        message = "💰 <b>Qimmatbaho metallar | Драгоценные металлы</b>\n\n"

        message += "💵 <b>Dolarda | В долларах:</b>\n"
        message += f"🥇 Oltin | Золото: <b>${num(gold_oz, 2)}/oz</b>  |  <b>${gold_g:.2f}/g</b>\n"
        if silver_oz > 0:
            message += f"🥈 Kumush | Серебро: <b>${num(silver_oz, 2)}/oz</b>  |  <b>${silver_g:.3f}/g</b>\n"

        message += "\n🇺🇿 <b>So'mda | В сумах:</b>\n"
        message += f"🥇 Oltin | Золото: <b>{num(gold_oz_uzs)} so'm/oz</b>  |  <b>{num(gold_g_uzs)} so'm/g</b>\n"
        if silver_oz > 0:
            message += f"🥈 Kumush | Серебро: <b>{num(silver_oz_uzs)} so'm/oz</b>  |  <b>{num(silver_g_uzs)} so'm/g</b>\n"

        return message
    
    @staticmethod
    def format_crypto_post(crypto: Dict[str, float], usd_rate: Optional[float] = None) -> str:
        """
        Kripto post - aniq format:
        Kriptovalyuta kurslari | Cryptocurrency exchange rates DD.MM.YYYY
        """
        if not crypto:
            return "❌ Kriptovalyuta ma'lumoti mavjud emas"

        # USD→UZS kursi: parametr > cache > default
        if usd_rate and usd_rate > 0:
            usd_to_uzs = usd_rate
        else:
            usd_to_uzs = get_usd_uzs_rate()

        date_str = datetime.now().strftime('%d.%m.%Y')
        usdt_uzs = int(usd_to_uzs)

        message = f"Kriptovalyuta kurslari | Курсы криптовалют {date_str}\n\n"

        # Dollar section FIRST
        message += "💵 <b>Dolarda | В долларах:</b>\n"
        message += "— USDT — $1.00\n"

        if 'BTC' in crypto:
            message += f"— BTC — ${num(crypto['BTC'])}\n"

        if 'ETH' in crypto:
            message += f"— ETH — ${num(crypto['ETH'])}\n"

        if 'SOL' in crypto:
            message += f"— SOL — ${num(crypto['SOL'])}\n"

        if 'TON' in crypto:
            message += f"— TON — ${num(crypto['TON'], 2)}\n"

        # Som section SECOND
        message += "\n🇺🇿 <b>So'mda | В сумах:</b>\n"
        message += f"— USDT — {num(usdt_uzs)} so'm\n"

        if 'BTC' in crypto:
            message += f"— BTC — {num(int(crypto['BTC'] * usd_to_uzs))} so'm\n"

        if 'ETH' in crypto:
            message += f"— ETH — {num(int(crypto['ETH'] * usd_to_uzs))} so'm\n"

        if 'SOL' in crypto:
            message += f"— SOL — {num(int(crypto['SOL'] * usd_to_uzs))} so'm\n"

        if 'TON' in crypto:
            message += f"— TON — {num(int(crypto['TON'] * usd_to_uzs))} so'm\n"

        return message

