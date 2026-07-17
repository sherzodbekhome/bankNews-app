"""
Tashqi API larga so'rovlar — CBU, bank.uz, CoinGecko, Metallar.
Barcha handler lar static async metodlar bilan, sessiyani qayta ishlatadi.
"""
import asyncio
import logging
import re
from typing import Dict, Optional, Tuple

import aiohttp
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=8)
_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _session() -> aiohttp.ClientSession:
    return aiohttp.ClientSession(
        headers={"User-Agent": _UA},
        timeout=_TIMEOUT,
    )


# ── CBU (Markaziy Bank) ────────────────────────────────────────────────────────

class CBUHandler:
    _URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/"

    @staticmethod
    async def get_rates() -> Optional[Dict]:
        """
        {
          "USD": {"rate": 12850.0, "diff": +12.5, "date": "2025-05-24"},
          "EUR": {...},
          "RUB": {...},
        }
        """
        try:
            async with _session() as s:
                async with s.get(
                    CBUHandler._URL,
                    headers={"Accept": "application/json"},
                ) as r:
                    if r.status != 200:
                        return None
                    data = await r.json(content_type=None)

            result = {}
            for item in data:
                ccy = item.get("Ccy", "").strip()
                if ccy not in ("USD", "EUR", "RUB", "GBP", "JPY", "CNY", "KZT"):
                    continue
                try:
                    rate = round(float(item["Rate"]), 2)
                    diff = round(float(item.get("Diff", 0)), 2)
                    date = item.get("Date", "")
                    result[ccy] = {"rate": rate, "diff": diff, "date": date}
                except Exception as e:
                    logger.debug(f"CBU element o'qib bo'lmadi ({ccy}): {e}")
            return result or None
        except Exception as e:
            logger.error(f"CBUHandler xatosi: {e}")
            return None


# ── bank.uz (tijorat banklari) ────────────────────────────────────────────────

class BankUzHandler:
    _URL = "https://bank.uz/uz/currency"
    _HEADERS = {
        "User-Agent": _UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "uz,en;q=0.5",
        "Referer": "https://bank.uz/",
    }

    @staticmethod
    def _clean_rate(raw: str) -> Optional[int]:
        m = re.search(r"(\d[\d\s]{0,8}?)(?:[.,]\d+)?\s*so", raw, re.IGNORECASE)
        if m:
            v = re.sub(r"\s", "", m.group(1))
            if v.isdigit():
                val = int(v)
                if 50 <= val <= 500_000:
                    return val
        for chunk in re.findall(r"\d+", raw):
            val = int(chunk)
            if 50 <= val <= 500_000:
                return val
        return None

    @staticmethod
    def _extract(section) -> list:
        result = []
        if not section:
            return result
        for block in section.find_all("div", class_="bc-inner-block-left-texts"):
            name_el = block.find("span", class_="medium-text")
            rate_el = block.find("span", class_="green-date")
            if not name_el or not rate_el:
                continue
            name = name_el.get_text(strip=True)
            rate = BankUzHandler._clean_rate(rate_el.get_text(strip=True))
            if name and rate:
                result.append((name, rate))
        return result

    @staticmethod
    async def get_commercial_rates() -> Optional[Dict]:
        """
        {
          "buying_usd":  [("Kapitalbank", 12820), ...],
          "selling_usd": [("Kapitalbank", 12950), ...],
          "buying_eur":  [...],
          "selling_eur": [...],
          "buying_rub":  [...],
          "selling_rub": [...],
        }
        """
        try:
            async with aiohttp.ClientSession(
                headers=BankUzHandler._HEADERS, timeout=_TIMEOUT
            ) as s:
                async with s.get(BankUzHandler._URL) as r:
                    if r.status != 200:
                        logger.warning(f"bank.uz status: {r.status}")
                        return None
                    html = await r.text(encoding="utf-8", errors="replace")

            soup = BeautifulSoup(html, "lxml")
            data = {}

            for cid, currency in (("best_USD", "usd"), ("best_RUB", "rub"), ("best_EUR", "eur")):
                section = soup.find(id=cid)
                if not section:
                    logger.warning(f"bank.uz: #{cid} topilmadi")
                    continue
                buys  = BankUzHandler._extract(section.find("div", class_="bc-inner-blocks-left"))
                sells = BankUzHandler._extract(section.find("div", class_="bc-inner-blocks-right"))
                data[f"buying_{currency}"]  = buys
                data[f"selling_{currency}"] = sells

            return data if data else None
        except Exception as e:
            logger.error(f"BankUzHandler xatosi: {e}")
            return None


# ── CoinGecko (kripto) ────────────────────────────────────────────────────────

class CryptoHandler:
    # Binance — asosiy manba (kalitsiz, ishonchli)
    _BINANCE_URL = "https://api.binance.com/api/v3/ticker/24hr"
    _BINANCE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "TONUSDT"]
    _BINANCE_MAP = {
        "BTCUSDT": "BTC",
        "ETHUSDT": "ETH",
        "SOLUSDT": "SOL",
        "TONUSDT": "TON",
    }
    # CoinGecko — zaxira manba
    _CG_URL = (
        "https://api.coingecko.com/api/v3/simple/price"
        "?ids=bitcoin,ethereum,solana,the-open-network"
        "&vs_currencies=usd&include_24hr_change=true"
    )
    _CG_MAP = {
        "bitcoin": "BTC", "ethereum": "ETH",
        "solana": "SOL", "the-open-network": "TON",
    }

    @staticmethod
    def _decimals(p: float) -> int:
        if p >= 100: return 0
        if p >= 1:   return 2
        if p >= 0.01: return 4
        return 6

    @staticmethod
    async def get_crypto_prices() -> Optional[Dict]:
        # 1) Binance
        try:
            params = {"symbols": str(CryptoHandler._BINANCE_SYMBOLS).replace("'", '"')}
            async with _session() as s:
                async with s.get(CryptoHandler._BINANCE_URL, params=params) as r:
                    if r.status == 200:
                        data = await r.json(content_type=None)
                        result = {}
                        for item in data:
                            sym = item.get("symbol", "")
                            ticker = CryptoHandler._BINANCE_MAP.get(sym)
                            if not ticker:
                                continue
                            p = float(item.get("lastPrice", 0))
                            ch = float(item.get("priceChangePercent", 0))
                            if p:
                                result[ticker] = {
                                    "price": round(p, CryptoHandler._decimals(p)),
                                    "change_24h": round(ch, 2),
                                }
                        result["USDT"] = {"price": 1.0, "change_24h": 0.0}
                        if result:
                            return result
        except Exception as e:
            logger.warning(f"Binance crypto xatosi: {e}")

        # 2) CoinGecko — zaxira
        try:
            async with _session() as s:
                async with s.get(CryptoHandler._CG_URL) as r:
                    if r.status == 200:
                        raw = await r.json(content_type=None)
                        result = {}
                        for coin_id, ticker in CryptoHandler._CG_MAP.items():
                            item = raw.get(coin_id, {})
                            p = float(item.get("usd", 0))
                            ch = float(item.get("usd_24h_change", 0))
                            if p:
                                result[ticker] = {
                                    "price": round(p, CryptoHandler._decimals(p)),
                                    "change_24h": round(ch, 2),
                                }
                        result["USDT"] = {"price": 1.0, "change_24h": 0.0}
                        if result:
                            return result
        except Exception as e:
            logger.warning(f"CoinGecko zaxira xatosi: {e}")

        return None


# ── Metallar ──────────────────────────────────────────────────────────────────

class MetalsHandler:
    # Coinbase — asosiy manba (bepul, ishonchli)
    _CB_GOLD   = "https://api.coinbase.com/v2/prices/XAU-USD/spot"
    _CB_SILVER = "https://api.coinbase.com/v2/prices/XAG-USD/spot"
    # metals.live — zaxira manba
    _URL_METALS = "https://api.metals.live/v1/spot/gold,silver"
    # PAXG — oxirgi zaxira (faqat oltin)
    _URL_PAXG = (
        "https://api.coingecko.com/api/v3/simple/price"
        "?ids=pax-gold&vs_currencies=usd"
    )

    @staticmethod
    async def _coinbase_price(url: str) -> Optional[float]:
        try:
            async with _session() as s:
                async with s.get(url, timeout=_TIMEOUT) as r:
                    if r.status != 200:
                        return None
                    data = await r.json(content_type=None)
            amount = data.get("data", {}).get("amount")
            return round(float(amount), 2) if amount else None
        except Exception as e:
            logger.debug(f"Coinbase metals xatosi: {e}")
            return None

    @staticmethod
    async def get_metals_prices() -> Optional[Dict]:
        """{"Gold": 4560.0, "Silver": 32.5}"""
        # Coinbase orqali oltin va kumushni parallel olish
        gold, silver = await asyncio.gather(
            MetalsHandler._coinbase_price(MetalsHandler._CB_GOLD),
            MetalsHandler._coinbase_price(MetalsHandler._CB_SILVER),
        )
        result = {}
        if gold:
            result["Gold"] = gold
        if silver:
            result["Silver"] = silver

        # Coinbase ishlamagan bo'lsa — metals.live zaxira
        if not result:
            try:
                import ssl
                ssl_ctx = ssl.create_default_context()
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = ssl.CERT_NONE
                conn = aiohttp.TCPConnector(ssl=ssl_ctx)
                async with aiohttp.ClientSession(
                    connector=conn, timeout=_TIMEOUT
                ) as s:
                    async with s.get(MetalsHandler._URL_METALS) as r:
                        if r.status == 200:
                            data = await r.json(content_type=None)
                            if isinstance(data, list):
                                for item in data:
                                    for k, v in item.items():
                                        name = k.capitalize()
                                        if name in ("Gold", "Silver"):
                                            result[name] = round(float(v), 2)
            except Exception as e:
                logger.debug(f"metals.live zaxira xatosi: {e}")

        # Hali ham oltin yo'q — PAXG
        if "Gold" not in result:
            try:
                async with _session() as s:
                    async with s.get(MetalsHandler._URL_PAXG) as r:
                        if r.status == 200:
                            raw = await r.json(content_type=None)
                            g = raw.get("pax-gold", {}).get("usd")
                            if g:
                                result["Gold"] = round(float(g), 2)
            except Exception as e:
                logger.debug(f"PAXG xatosi: {e}")

        return result if result else None



# ── Top 250 Kripto ────────────────────────────────────────────────────────────

class CryptoTopHandler:
    """Top 250 kriptovalyuta market cap bo'yicha — server tomonidan keshlangan"""
    _URL = (
        "https://api.coingecko.com/api/v3/coins/markets"
        "?vs_currency=usd&order=market_cap_desc"
        "&per_page=250&page=1&sparkline=false"
        "&price_change_percentage=24h"
    )
    _cache: list = []
    _cache_ts: float = 0.0
    _CACHE_TTL = 300  # 5 daqiqa

    @classmethod
    async def get_top(cls) -> Optional[list]:
        import time
        now = time.time()
        if cls._cache and (now - cls._cache_ts) < cls._CACHE_TTL:
            return cls._cache
        try:
            async with _session() as s:
                async with s.get(cls._URL, headers={"Accept": "application/json"}) as r:
                    if r.status != 200:
                        logger.warning(f"CoinGecko top250 status: {r.status}")
                        return cls._cache or None
                    data = await r.json(content_type=None)
            if not isinstance(data, list) or len(data) < 10:
                return cls._cache or None
            result = []
            for c in data:
                result.append({
                    "id":     c.get("id", ""),
                    "symbol": (c.get("symbol") or "").upper(),
                    "name":   c.get("name", ""),
                    "image":  c.get("image", ""),
                    "rank":   c.get("market_cap_rank") or 9999,
                    "price":  c.get("current_price") or 0,
                    "change": round(c.get("price_change_percentage_24h") or 0, 2),
                    "mcap":   c.get("market_cap") or 0,
                    "volume": c.get("total_volume") or 0,
                })
            cls._cache = result
            cls._cache_ts = now
            return result
        except Exception as e:
            logger.error(f"CryptoTopHandler xatosi: {e}")
            return cls._cache or None


# ── DataCollector ─────────────────────────────────────────────────────────────

class DataCollector:
    @staticmethod
    async def collect_all_data() -> Tuple[Dict, None]:
        """Barcha API lardan ma'lumot parallel olish"""
        results = await asyncio.gather(
            CBUHandler.get_rates(),
            CryptoHandler.get_crypto_prices(),
            MetalsHandler.get_metals_prices(),
            BankUzHandler.get_commercial_rates(),
            return_exceptions=True,
        )
        keys     = ("currency", "crypto", "metals", "banks")
        handlers = ("CBUHandler", "CryptoHandler", "MetalsHandler", "BankUzHandler")
        data: Dict = {}
        for key, handler_name, result in zip(keys, handlers, results):
            if isinstance(result, Exception):
                logger.warning(f"{handler_name} xatosi: {result}")
                data[key] = None
            else:
                data[key] = result or None
        return data, None


# ── BankHandler alias (ba'zi joylarda shu nom ishlatilgan) ────────────────────
BankHandler = BankUzHandler
