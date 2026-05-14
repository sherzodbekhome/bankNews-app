"""
GitHub Actions tomonidan ishga tushiriladi.
bank.uz dan kurslarni oladi va banks_data.json faylini yangilaydi.
"""
import asyncio
import json
import re
import sys
from datetime import datetime

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


async def fetch():
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
        top = banks[0] if banks else "yo'q"
        print(f"{currency}: {len(banks)} ta bank | Top: {top}")

    return data


async def main():
    banks = await fetch()
    if not banks:
        print("FAILED: bank.uz dan data olinmadi", file=sys.stderr)
        sys.exit(1)

    output = {
        "ok":      True,
        "data":    banks,
        "source":  "bank.uz",
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    with open("banks_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"banks_data.json yangilandi ({datetime.utcnow().strftime('%H:%M UTC')})")


asyncio.run(main())
