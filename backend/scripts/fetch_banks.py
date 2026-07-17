"""
GitHub Actions tomonidan ishga tushiriladi.
bank.uz dan kurslarni oladi, CBU tarixi saqlaydi, banks_data.json ni yangilaydi.
"""
import asyncio
import json
import re
import sys
from datetime import datetime, timezone

import aiohttp
from bs4 import BeautifulSoup

URL = "https://bank.uz/uz/currency"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "uz,en;q=0.5",
}


def clean_rate(raw: str):
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


def extract(section):
    result = []
    if not section:
        return result
    for block in section.find_all("div", class_="bc-inner-block-left-texts"):
        name_el = block.find("span", class_="medium-text")
        rate_el = block.find("span", class_="green-date")
        if not name_el or not rate_el:
            continue
        name = name_el.get_text(strip=True)
        rate = clean_rate(rate_el.get_text(strip=True))
        if name and rate:
            result.append((name, rate))
    return result


async def fetch_banks():
    """bank.uz dan tijorat banklari kurslarini olish"""
    async with aiohttp.ClientSession(headers=HEADERS) as session:
        async with session.get(URL, timeout=aiohttp.ClientTimeout(total=20)) as r:
            if r.status != 200:
                print(f"ERROR: bank.uz status {r.status}", file=sys.stderr)
                return None
            html = await r.text(encoding="utf-8", errors="replace")

    soup = BeautifulSoup(html, "lxml")
    data = {}

    for cid, currency in (("best_USD", "USD"), ("best_RUB", "RUB"), ("best_EUR", "EUR")):
        section = soup.find(id=cid)
        if not section:
            print(f"WARN: #{cid} topilmadi", file=sys.stderr)
            continue

        buys  = extract(section.find("div", class_="bc-inner-blocks-left"))
        sells = extract(section.find("div", class_="bc-inner-blocks-right"))

        buy_dict  = {n: r for n, r in buys}
        sell_dict = {n: r for n, r in sells}
        all_names = set(buy_dict) | set(sell_dict)

        banks = []
        for name in all_names:
            buy  = buy_dict.get(name, 0)
            sell = sell_dict.get(name, 0)
            if buy or sell:
                banks.append({
                    "name":   name,
                    "buy":    buy,
                    "sell":   sell,
                    "spread": (sell - buy) if buy and sell else 0,
                })

        data[currency] = sorted(banks, key=lambda x: x["buy"], reverse=True)
        print(f"{currency}: {len(banks)} ta bank")

    return data if data else None


async def fetch_cbu():
    """CBU rasmiy kurslarini olish (grafik uchun)"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://cbu.uz/uz/arkhiv-kursov-valyut/json/",
                headers={"User-Agent": "BankNewsBot/1.0", "Accept": "application/json"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as r:
                if r.status != 200:
                    return None
                data = await r.json(content_type=None)

        rates = {}
        for item in data:
            ccy = item.get("Ccy", "").strip()
            if ccy in ("USD", "EUR", "RUB"):
                try:
                    rates[ccy] = round(float(item["Rate"]), 2)
                except Exception as e:
                    print(f"WARN: CBU {ccy} kursini o'qib bo'lmadi: {e}", file=sys.stderr)
        return rates if rates else None
    except Exception as e:
        print(f"CBU xatosi: {e}", file=sys.stderr)
        return None


async def main():
    # bank.uz va CBU parallel olish
    banks_result, cbu_result = await asyncio.gather(
        fetch_banks(),
        fetch_cbu(),
        return_exceptions=True,
    )

    banks = None if isinstance(banks_result, Exception) else banks_result
    cbu   = None if isinstance(cbu_result, Exception) else cbu_result

    if not banks:
        print("FAILED: bank.uz dan data olinmadi", file=sys.stderr)
        sys.exit(1)

    # Eski history ni yuklash
    history = []
    try:
        with open("banks_data.json", "r", encoding="utf-8") as f:
            old = json.load(f)
            history = old.get("history", [])
    except FileNotFoundError:
        pass  # Birinchi ishga tushirish — history hali yo'q
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARN: eski banks_data.json o'qib bo'lmadi, history tashlab yuborildi: {e}",
              file=sys.stderr)

    # Bugungi CBU kurslarini tariхga qo'shish
    if cbu:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        history = [h for h in history if h.get("date") != today]
        entry = {"date": today}
        entry.update(cbu)
        history.append(entry)
        history = history[-30:]  # Faqat so'nggi 30 kun

    output = {
        "ok":      True,
        "data":    banks,
        "cbu":     cbu or {},
        "source":  "bank.uz",
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "history": history,
    }

    with open("banks_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"banks_data.json yangilandi: {len(history)} kun tarix, {datetime.now(timezone.utc).strftime('%H:%M UTC')}")


asyncio.run(main())
