"""
Raqamlarni matn ko'rinishida formatlash uchun umumiy yordamchilar.

Loyihada minglar ajratgichi sifatida bo'sh joy ishlatiladi
(masalan, 12 850). Ilgari har joyda `f"{x:,}".replace(",", " ")` yozilar edi —
shu takroriy idioma o'rniga `num()` funksiyasidan foydalaning.
"""
from typing import Union

Number = Union[int, float]


def num(value: Number, decimals: int = 0, sign: bool = False) -> str:
    """
    Sonni bo'sh joy bilan ajratilgan minglar ko'rinishida qaytaradi.

    num(12850)          -> "12 850"
    num(4560.5, 2)      -> "4 560.50"
    num(12.5, 2, True)  -> "+12.50"
    """
    spec = f"{'+' if sign else ''},.{decimals}f"
    return format(value, spec).replace(",", " ")
