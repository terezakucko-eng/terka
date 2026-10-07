# Brand rádce – Růžový slon

Pracovní složka značky Slon 4.0: brand book, briefy kampaní, záznamy rozhodnutí a podklady pro sociální sítě. Všechno se řídí strategií značky z oficiálního visualbooku (ruzovyslon.visualbook.pro).

## Obsah

| Složka | Co v ní je |
|---|---|
| `brand-book/` | Brand Book 4.0 jako jeden HTML soubor (`Slon_4_0_brand_book.html`) + šablona a sestavení, viz `brand-book/README.md` |
| `campaigns/` | briefy kampaní |
| `decisions/` | záznamy rozhodnutí o nabídkách partnerů včetně návrhů odpovědí |
| `instagram/` | briefy pro Instagram |
| `tools/` | `nbsp.py` – nezlomitelné mezery po jednopísmenných předložkách a spojkách |

### Dokumenty k 6. 10. 2026

- `campaigns/2026-10-rijen-mas-to-ve-svych-rukou.md` – říjnová kampaň „Máš to ve svých rukou.“
- `campaigns/2026-11-bf-clv-metro.md` – Black Friday, CLV v pražském metru
- `decisions/2026-10-playboy-odmitnuti.md` – Playboy CZ: odmítnutí a protinávrh
- `decisions/2026-10-krupka-odmitnuti.md` – talk show z Krupky: odmítnutí, kontakt na Dr. Broula
- `decisions/2026-10-givery-odmitnuti.md` – Givery.cz: odmítnutí
- `instagram/typo-series-brief.md` – série „typografie z hraček“

### Dokumenty k 7. 10. 2026

- `campaigns/2026-10-kondomedie-program.md` – Kondomedie: celostránková inzerce v divadelním programu
- `campaigns/kondomedie-program/` – tiskové PDF (A5 se spadávkou, CMYK, písma v křivkách), náhled a zdroje pro jeho sestavení

Chybějící údaje jsou v dokumentech označené `[doplnit]`, návrhy, které ještě nikdo neschválil, jsou označené „k potvrzení“.

## Pravidla psaní

- Spisovná čeština („děkuji“, ne „děkuju“), české uvozovky „…“.
- Prostý styl bez marketingového žargonu, české výrazy místo anglických zkratek.
- V dokumentech žádné emoji.
- Nezlomitelné mezery po k, s, v, z, a, i, o, u (i velkých). Po úpravě souboru spusťte:

```
python3 tools/nbsp.py soubor.md          # doplní mezery
python3 tools/nbsp.py --check soubor.md  # jen zkontroluje
```
