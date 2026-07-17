"""
Post xabarlarni formatlash
"""
import logging
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)


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

        try:
            from core.cache_manager import CacheManager
            currency_cache = CacheManager.get_cache('currency')
            usd_to_uzs = currency_cache.get('USD', 12500) if currency_cache else 12500
        except Exception as e:
            logger.debug(f"USD kursi cache dan olinmadi, default ishlatiladi: {e}")
            usd_to_uzs = 12500

        gold_oz_uzs = int(gold_oz * usd_to_uzs)
        gold_g_uzs = int(gold_g * usd_to_uzs)
        silver_oz_uzs = int(silver_oz * usd_to_uzs)
        silver_g_uzs = int(silver_g * usd_to_uzs)

        message = "💰 <b>Qimmatbaho metallar | Драгоценные металлы</b>\n\n"

        message += "💵 <b>Dolarda | В долларах:</b>\n"
        message += f"🥇 Oltin | Золото: <b>${gold_oz:,.2f}/oz</b>  |  <b>${gold_g:.2f}/g</b>\n".replace(",", " ")
        if silver_oz > 0:
            message += f"🥈 Kumush | Серебро: <b>${silver_oz:,.2f}/oz</b>  |  <b>${silver_g:.3f}/g</b>\n".replace(",", " ")

        message += "\n🇺🇿 <b>So'mda | В сумах:</b>\n"
        message += f"🥇 Oltin | Золото: <b>{gold_oz_uzs:,} so'm/oz</b>  |  <b>{gold_g_uzs:,} so'm/g</b>\n".replace(",", " ")
        if silver_oz > 0:
            message += f"🥈 Kumush | Серебро: <b>{silver_oz_uzs:,} so'm/oz</b>  |  <b>{silver_g_uzs:,} so'm/g</b>\n".replace(",", " ")

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
            try:
                from core.cache_manager import CacheManager
                currency_cache = CacheManager.get_cache('currency')
                usd_to_uzs = currency_cache.get('USD', 12500) if currency_cache else 12500
            except Exception as e:
                logger.debug(f"USD kursi cache dan olinmadi, default ishlatiladi: {e}")
                usd_to_uzs = 12500

        date_str = datetime.now().strftime('%d.%m.%Y')
        usdt_uzs = int(usd_to_uzs)

        message = f"Kriptovalyuta kurslari | Курсы криптовалют {date_str}\n\n"

        # Dollar section FIRST
        message += "💵 <b>Dolarda | В долларах:</b>\n"
        message += "— USDT — $1.00\n"

        if 'BTC' in crypto:
            message += f"— BTC — ${crypto['BTC']:,.0f}\n".replace(",", " ")

        if 'ETH' in crypto:
            message += f"— ETH — ${crypto['ETH']:,.0f}\n".replace(",", " ")

        if 'SOL' in crypto:
            message += f"— SOL — ${crypto['SOL']:,.0f}\n".replace(",", " ")

        if 'TON' in crypto:
            message += f"— TON — ${crypto['TON']:,.2f}\n".replace(",", " ")

        # Som section SECOND
        message += "\n🇺🇿 <b>So'mda | В сумах:</b>\n"
        message += f"— USDT — {usdt_uzs:,} so'm\n".replace(",", " ")

        if 'BTC' in crypto:
            message += f"— BTC — {int(crypto['BTC'] * usd_to_uzs):,} so'm\n".replace(",", " ")

        if 'ETH' in crypto:
            message += f"— ETH — {int(crypto['ETH'] * usd_to_uzs):,} so'm\n".replace(",", " ")

        if 'SOL' in crypto:
            message += f"— SOL — {int(crypto['SOL'] * usd_to_uzs):,} so'm\n".replace(",", " ")

        if 'TON' in crypto:
            message += f"— TON — {int(crypto['TON'] * usd_to_uzs):,} so'm\n".replace(",", " ")

        return message

