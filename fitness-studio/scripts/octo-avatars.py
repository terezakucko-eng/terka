"""Generates the 12 octopus avatars in public/avatars (run: python3 scripts/octo-avatars.py)."""
LES, MECH, SALVEJ, ZEME = "#151a13", "#394330", "#606350", "#674329"
ZLATO, ZLATO_L, PISEK, KREM, PAPIR = "#d2a772", "#f7dbb4", "#d1b89a", "#e2d1bd", "#f3ebde"
DARK = {LES, MECH, SALVEJ, ZEME}

def tentacles(c):
    # five wavy arms with curled tips
    arms = [
        "M40 74 C30 84 22 88 20 98 C18 106 26 108 28 102",
        "M50 78 C46 90 40 98 42 106 C44 112 51 110 49 104",
        "M64 80 C64 92 62 100 64 108 C66 114 72 110 70 104",
        "M78 78 C82 90 88 98 86 106 C84 112 77 110 79 104",
        "M88 74 C98 84 106 88 108 98 C110 106 102 108 100 102",
    ]
    return "".join(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="8" stroke-linecap="round"/>' for d in arms)

def head(c):
    return f'<path d="M64 22 C86 22 96 40 94 58 C92 74 80 82 64 82 C48 82 36 74 34 58 C32 40 42 22 64 22 Z" fill="{c}"/>'

def eyes(kind, ink):
    if kind == "closed":
        return f'<path d="M50 55 Q55 59 60 55 M68 55 Q73 59 78 55" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>'
    if kind == "sleepy":
        return f'<path d="M50 56 L60 56 M68 56 L78 56" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>'
    if kind == "wink":
        return f'<circle cx="55" cy="54" r="4.2" fill="{ink}"/><path d="M68 55 Q73 51 78 55" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>'
    return f'<circle cx="55" cy="54" r="4.2" fill="{ink}"/><circle cx="73" cy="54" r="4.2" fill="{ink}"/><circle cx="56.4" cy="52.6" r="1.3" fill="#fff"/><circle cx="74.4" cy="52.6" r="1.3" fill="#fff"/>'

def mouth(kind, ink):
    if kind == "o":
        return f'<ellipse cx="64" cy="66" rx="3" ry="3.6" fill="{ink}"/>'
    return f'<path d="M57 64 Q64 71 71 64" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>'

def cheeks():
    return '<circle cx="47" cy="63" r="4" fill="#e9a58f" opacity=".55"/><circle cx="81" cy="63" r="4" fill="#e9a58f" opacity=".55"/>'

ACC = {
    "none": "",
    "lotus": f'<path d="M64 20 C60 14 60 10 64 6 C68 10 68 14 64 20 Z M64 20 C56 18 52 14 52 10 C58 11 62 14 64 20 Z M64 20 C72 18 76 14 76 10 C70 11 66 14 64 20 Z" fill="#e9a58f"/>',
    "dumbbell": f'<g transform="rotate(-15 100 89)"><rect x="90" y="87" width="20" height="4.5" rx="2" fill="{PAPIR}"/><rect x="86" y="80" width="7" height="18" rx="2.5" fill="{PAPIR}"/><rect x="107" y="80" width="7" height="18" rx="2.5" fill="{PAPIR}"/></g>',
    "headband": f'<path d="M35 44 Q64 34 93 44" fill="none" stroke="#e9a58f" stroke-width="6" stroke-linecap="round"/><path d="M100 26 L100 14 L108 12 L108 24" fill="none" stroke="{ZLATO_L}" stroke-width="2.5"/><circle cx="98" cy="27" r="3" fill="{ZLATO_L}"/><circle cx="106" cy="25" r="3" fill="{ZLATO_L}"/>',
    "zzz": f'<text x="92" y="30" font-family="Arial, sans-serif" font-weight="700" font-size="14" fill="{ZEME}">z</text><text x="102" y="20" font-family="Arial, sans-serif" font-weight="700" font-size="10" fill="{ZEME}">z</text>',
    "heart": '<path d="M104 30 C104 24 96 22 94 28 C92 22 84 24 84 30 C84 36 94 42 94 42 C94 42 104 36 104 30 Z" fill="#d9695a"/>',
    "sunglasses": f'<rect x="45" y="48" width="17" height="11" rx="4" fill="{LES}"/><rect x="66" y="48" width="17" height="11" rx="4" fill="{LES}"/><path d="M62 52 L66 52" stroke="{LES}" stroke-width="2.5"/>',
    "flower": f'<g transform="translate(80 24)"><circle cx="0" cy="-6" r="5" fill="#f2b8c6"/><circle cx="6" cy="0" r="5" fill="#f2b8c6"/><circle cx="0" cy="6" r="5" fill="#f2b8c6"/><circle cx="-6" cy="0" r="5" fill="#f2b8c6"/><circle r="4" fill="{ZLATO}"/></g>',
    "sweat": f'<path d="M35 42 Q64 32 93 42" fill="none" stroke="{PAPIR}" stroke-width="6" stroke-linecap="round"/><path d="M98 42 C98 42 94 48 94 51 C94 54 98 55 99.5 53 C101 51 98 42 98 42 Z" fill="#7fb6d6"/>',
    "star": f'<path d="M100 14 L103 21 L110 22 L105 27 L106 34 L100 30 L94 34 L95 27 L90 22 L97 21 Z" fill="{ZLATO_L}"/>',
    "crown": f'<path d="M48 26 L52 12 L58 22 L64 8 L70 22 L76 12 L80 26 Z" fill="{ZLATO}" stroke="{ZEME}" stroke-width="1.5" stroke-linejoin="round"/>',
    "bow": '<path d="M64 22 L52 14 L52 30 Z M64 22 L76 14 L76 30 Z" fill="#d9695a"/><circle cx="64" cy="22" r="3.5" fill="#b9504a"/>',
}

# (bg, body, eyes, mouth, accessory)
SET = [
    (MECH, ZLATO, "open", "smile", "none"),
    (SALVEJ, KREM, "closed", "smile", "lotus"),
    (ZEME, ZLATO_L, "open", "smile", "dumbbell"),
    (LES, ZLATO, "open", "o", "headband"),
    (KREM, SALVEJ, "sleepy", "smile", "zzz"),
    (PISEK, ZEME, "open", "smile", "heart"),
    (ZLATO_L, MECH, "open", "smile", "sunglasses"),
    ("#e8dac6", SALVEJ, "open", "smile", "flower"),
    (MECH, PISEK, "open", "o", "sweat"),
    (ZLATO, LES, "wink", "smile", "star"),
    (LES, ZLATO_L, "open", "smile", "crown"),
    (SALVEJ, ZLATO_L, "open", "smile", "bow"),
]

for i, (bg, body, e, m, acc) in enumerate(SET, 1):
    ink = PAPIR if body in DARK else LES
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
        f'<rect width="128" height="128" fill="{bg}"/>'
        f"{tentacles(body)}{head(body)}{eyes(e, ink)}{mouth(m, ink)}{cheeks()}{ACC[acc]}"
        "</svg>"
    )
    open(f"public/avatars/octo-{i}.svg", "w").write(svg)
print("ok")
