"""
Tashqi HTTP so'rovlar uchun umumiy sozlamalar.
Barcha modullar shu yerdagi User-Agent, timeout va sessiya yaratuvchidan foydalanadi.
"""
import aiohttp

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=8)


def make_session(**kwargs) -> aiohttp.ClientSession:
    """User-Agent va standart timeout bilan aiohttp sessiyasini yaratadi."""
    headers = {"User-Agent": USER_AGENT, **kwargs.pop("headers", {})}
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
    return aiohttp.ClientSession(headers=headers, **kwargs)
