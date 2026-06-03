"""
Gemini AI orqali kuchaytirilgan moliyaviy bozor tahlili.
Valyuta, kripto va metallar uchun alohida professional promptlar.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict

from core.config import GEMINI_API_KEYS

logger = logging.getLogger(__name__)

try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False
    logger.warning("google-genai moduli o'rnatilmagan: pip install google-genai")

_MODEL = "gemini-2.5-flash"

_PERSONA = (
    "Sen O'zbekiston moliya bozorini yaxshi biladigan tajribali moliyaviy tahlilchisan. "
    "Odamlarga oddiy, amaliy va foydali maslahat berasan. "
    "Telegram post uchun HTML teglari ishlata olasan (<b>, <i>). "
    "Ortiqcha akademik tushuntirish yo'q — faqat muhim narsalar."
)


class AIAnalyzer:
    """
    Gemini API key rotatsiyasi:
    Bir kalit 429 (quota tugagan) qaytarsa — keyingi kalitga o'tadi.
    Barcha kalitlar tugasa — None qaytaradi.
    """

    def __init__(self):
        self._keys = GEMINI_API_KEYS[:]  # nusxa
        self._idx = 0                     # joriy kalit indeksi
        self._clients: Dict[str, any] = {}
        self._build_clients()

    def _build_clients(self):
        if not GEMINI_AVAILABLE:
            return
        for key in self._keys:
            if key and key not in self._clients:
                try:
                    self._clients[key] = genai.Client(api_key=key)
                except Exception as e:
                    logger.warning(f"Gemini kalit yaratishda xato: {e}")

    @property
    def client(self):
        if not self._keys:
            return None
        key = self._keys[self._idx % len(self._keys)]
        return self._clients.get(key)

    def _next_key(self):
        """Keyingi kalitga o'tish"""
        if len(self._keys) > 1:
            self._idx = (self._idx + 1) % len(self._keys)
            logger.warning(f"Gemini kalit rotatsiyasi: {self._idx + 1}/{len(self._keys)}")

    async def _ask(self, prompt: str) -> Optional[str]:
        if not self._keys or not GEMINI_AVAILABLE:
            return None
        loop = asyncio.get_running_loop()

        # Barcha kalitlarni bir marta sinab ko'rish
        for _ in range(len(self._keys)):
            client = self.client
            if not client:
                self._next_key()
                continue
            try:
                response = await loop.run_in_executor(
                    None,
                    lambda c=client: c.models.generate_content(
                        model=_MODEL,
                        contents=prompt,
                    )
                )
                return response.text.strip()
            except Exception as e:
                msg = str(e)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    logger.warning(f"Gemini 429 — kalit {self._idx + 1} tugadi, keyingisiga o'tish...")
                    self._next_key()
                    continue
                logger.error(f"Gemini API xatosi: {e}")
                return None

        logger.error("Barcha Gemini kalitlari quota tugagan!")
        return None

    async def analyze_currency(
        self,
        currency_data: dict,
        bank_data: dict = None,
    ) -> Optional[str]:
        """Valyuta + bank kurslari tahlili — 09:45 va 12:00 post uchun."""
        if not self.client:
            return None

        usd  = currency_data.get("USD", 0)
        eur  = currency_data.get("EUR", 0)
        rub  = currency_data.get("RUB", 0)

        cbu_diff   = ""
        bank_block = ""
        best_buy_name = best_sell_name = ""

        if bank_data:
            cbu = bank_data.get("cbu_rate", {})
            diff_usd = cbu.get("diff_usd", 0)
            arrow = "⬆️ ko'tarildi" if diff_usd > 0 else ("⬇️ tushdi" if diff_usd < 0 else "➡️ o'zgarmadi")
            cbu_diff = f"CBU rasmiy kurs kecha nisbatan {arrow} ({diff_usd:+.2f} so'm)"

            buying  = sorted(bank_data.get("buying_usd",  []), key=lambda x: x[1], reverse=True)
            selling = sorted(bank_data.get("selling_usd", []), key=lambda x: x[1])

            if buying and selling:
                best_buy_name  = buying[0][0]
                best_sell_name = selling[0][0]
                spread = selling[0][1] - buying[0][1]
                bank_block = (
                    f"Eng yuqori xarid narxi:  {best_buy_name} — {buying[0][1]:,} so'm\n"
                    f"Eng qulay sotish narxi: {best_sell_name} — {selling[0][1]:,} so'm\n"
                    f"Bank spread (farq): {spread:,} so'm\n"
                    f"O'rtacha bozor: top-5 xarid o'rtacha "
                    f"{sum(r for _, r in buying[:5]) // 5:,} so'm"
                ).replace(",", " ")

        prompt = f"""{_PERSONA}

=== BUGUNGI BOZOR ({datetime.now().strftime('%d.%m.%Y %H:%M')}) ===

CBU RASMIY KURS:
  USD = {usd:,.2f} so'm
  EUR = {eur:,.2f} so'm
  RUB = {rub:,.4f} so'm
  {cbu_diff}

TIJORAT BANKLAR:
{bank_block if bank_block else "  Bank ma'lumotlari mavjud emas"}

=== JAVOB FORMATI (AYNAN SHU KO'RINISHDA YOZ) ===

<b>📊 Bugungi vaziyat:</b>
Bugun USD kursi [o'sdi/pasaydi] [emoji]. CBU rasmiy kursi [aniq raqam] so'mni tashkil etib, kechagi kunga nisbatan [+/-raqam] so'mga [o'sdi/arzonlashdi].

<b>🏦 Eng foydali bank:</b>
Dollar SOTIB OLISH uchun eng yuqori narx bermoqda: [bank nomi] — [kurs] so'm.
Dollar SOTISH uchun eng arzon: [bank nomi] — [kurs] so'm.

<b>💡 Bugungi maslahat:</b>
[Kurs tendensiyasi haqida amaliy maslahat]. Banklararo spread ([spread miqdori] so'm) [baholash].

QOIDALAR:
- Sarlavhadan KEYIN yangi qatordan matn yoz
- Qavslar [] ISHLATMA — haqiqiy ma'lumotlarni yoz
- HTML: faqat <b> sarlavhalarda
- Har bir bo'lim orasida bo'sh qator qo'y
- Emoji ishlat ammo ortiqcha emas
- Raqamlar: aniq, vergullar bilan (11,979.64)"""

        return await self._ask(prompt)

    async def analyze_crypto_metals(
        self,
        crypto_data: dict,
        metals_data: dict,
    ) -> Optional[str]:
        """Kripto + metallar tahlili — 18:00 post uchun."""
        if not self.client:
            return None

        btc    = crypto_data.get("BTC", 0)
        eth    = crypto_data.get("ETH", 0)
        sol    = crypto_data.get("SOL", 0)
        ton    = crypto_data.get("TON", 0)
        usdt   = crypto_data.get("USDT", 1)
        gold   = metals_data.get("Gold", 0)
        silver = metals_data.get("Silver", 0)

        # Oltin tarixiy kontekst
        gold_level = ""
        if gold > 3200:
            gold_level = "Tarixiy rekord darajasida (>$3200)"
        elif gold > 3000:
            gold_level = "Yuqori daraja ($3000 dan yuqori)"
        elif gold > 2500:
            gold_level = "O'rta-yuqori daraja"
        else:
            gold_level = "O'rta daraja"

        # BTC kontekst
        btc_level = ""
        if btc > 100_000:
            btc_level = "Tarixiy maksimum zonasida"
        elif btc > 80_000:
            btc_level = "Kuchli zona ($80k-$100k)"
        elif btc > 50_000:
            btc_level = "O'rta zona"
        else:
            btc_level = "Past zona"

        prompt = f"""{_PERSONA}

=== BUGUNGI BOZOR ({datetime.now().strftime('%d.%m.%Y %H:%M')}) ===

KRIPTOVALYUTALAR:
  BTC  = ${btc:,.0f}  [{btc_level}]
  ETH  = ${eth:,.0f}
  SOL  = ${sol:,.0f}
  TON  = ${ton:,.2f}
  USDT = ${usdt:.2f}

QIMMATBAHO METALLAR:
  Oltin  = ${gold:,.2f}/oz  [{gold_level}]
  Kumush = ${silver:,.2f}/oz

=== JAVOB FORMATI (AYNAN SHU KO'RINISHDA YOZ) ===

<b>₿ Kripto holati:</b>
BTC va umumiy kripto bozori haqida 1-2 qator yoz.

<b>🥇 Oltin signali:</b>
Oltin narxi haqida 1-2 qator yoz.

<b>💡 Bugungi tavsiya:</b>
Eng muhim amaliy maslahat 1-2 qator.

QOIDALAR: Sarlavhadan KEYIN yangi qatordan matn yoz. Qavslar [] ISHLATMA. HTML: faqat <b>. Emoji ishlat."""

        return await self._ask(prompt)

    async def analyze_market(
        self,
        currency_data: dict,
        crypto_data: dict,
        metals_data: dict,
        bank_data: dict = None,
        trends: dict = None,
    ) -> Optional[str]:
        """Asosiy interfeys — bot.py chaqiradi."""
        if currency_data and not crypto_data:
            return await self.analyze_currency(currency_data, bank_data)
        if crypto_data or metals_data:
            return await self.analyze_crypto_metals(crypto_data or {}, metals_data or {})
        return None

    @staticmethod
    def get_default_analysis() -> str:
        return "📊 Bozor barqaror. Keskin o'zgarishlar kutilmayapti."


ai_analyzer: Optional[AIAnalyzer] = None


def get_ai_analyzer() -> AIAnalyzer:
    global ai_analyzer
    if ai_analyzer is None:
        ai_analyzer = AIAnalyzer()
    return ai_analyzer
