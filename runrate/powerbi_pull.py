#!/usr/bin/env python3
"""
Stáhne denní data z Power BI přes REST API a uloží je jako CSV.

Nahrazuje ruční klikání v Power BI. Běží kdekoli — nepotřebuje prohlížeč,
přihlášení ani zapnutý počítač.

PŘED PRVNÍM SPUŠTĚNÍM potřebuješ od IT / Milana:
  1. App registration v Azure AD (service principal)
  2. Zapnuté tenant settings "Service principals can use Power BI APIs"
     (Developer settings) a "Dataset Execute Queries REST API" (Integration settings)
  3. Service principal přidaný do workspace jako Viewer + Build na datasetu
     (Viewer sám nestačí, executeQueries chce Read i Build)
  4. Workspace ID a dataset ID

POZOR: service principal nefunguje nad datasetem s RLS nebo SSO, ať je tenant
nastavený jakkoli. Pak zbývá jen Power Automate (varianta A v zadání).

Údaje se berou z proměnných prostředí, NIKDY se nepíšou do souboru:
  PBI_TENANT_ID, PBI_CLIENT_ID, PBI_CLIENT_SECRET, PBI_WORKSPACE_ID, PBI_DATASET_ID

Použití:
  python3 powerbi_pull.py                 # aktuální měsíc (1.–4. den i minulý)
  python3 powerbi_pull.py --month 2026-10
  python3 powerbi_pull.py --out data.csv
"""

import argparse
import csv
import datetime as dt
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import json

AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
SCOPE = "https://analysis.windows.net/powerbi/api/.default"
QUERY_URL = ("https://api.powerbi.com/v1.0/myorg/groups/{workspace}"
             "/datasets/{dataset}/executeQueries")

# Devět divizí, které model používá. Ostatní (prodejny, Dr. Max, Flagranti…) se ignorují.
DIVISIONS = [
    "E-shop CZ", "E-shop SK", "E-shop HU", "E-shop RO", "E-shop BG",
    "E-shop HR", "E-shop SI", "Kondomshop CZ", "Kondomshop SK",
]

# DAX. Názvy měr a tabulek je potřeba ověřit proti modelu — tohle je tvar,
# který odpovídá sloupcům, jak je report ukazuje dnes.
DAX = """
EVALUATE
SUMMARIZECOLUMNS(
    'Calendar'[Date],
    'Division'[Division name],
    FILTER(
        VALUES('Calendar'[Date]),
        'Calendar'[Date] >= DATE({y}, {m}, 1)
            && 'Calendar'[Date] <= DATE({y}, {m}, {last})
    ),
    "Sales",          [Ʃ Sales],
    "SalesTarget",    [Ʃ Sales Target],
    "GM1",            [GM1],
    "InvoicedOrders", [# Invoiced orders],
    "Documents",      [# Documents],
    "WebSessions",    [Ʃ Web sessions]
)
ORDER BY 'Calendar'[Date], 'Division'[Division name]
"""


def env(name):
    v = os.environ.get(name)
    if not v:
        sys.exit(f"Chybí proměnná prostředí {name}. Viz hlavička souboru.")
    return v


def get_token():
    body = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": env("PBI_CLIENT_ID"),
        "client_secret": env("PBI_CLIENT_SECRET"),
        "scope": SCOPE,
    }).encode()
    url = AUTH_URL.format(tenant=env("PBI_TENANT_ID"))
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def run_query(token, dax):
    url = QUERY_URL.format(workspace=env("PBI_WORKSPACE_ID"),
                           dataset=env("PBI_DATASET_ID"))
    payload = json.dumps({
        "queries": [{"query": dax}],
        "serializerSettings": {"includeNulls": True},
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        # Chyba v DAX (špatný název míry/tabulky) přijde jako 400 a detail je
        # jen v těle odpovědi — bez něj by bylo vidět jen "Bad Request".
        sys.exit(f"Power BI vrátilo {e.code}:\n{e.read().decode(errors='replace')}")

    # Překročený limit řádků přijde jako 200 s chybou uvnitř a useknutými daty.
    result = data["results"][0]
    for err in (data.get("error"), result.get("error"),
                result["tables"][0].get("error")):
        if err:
            sys.exit(f"Power BI vrátilo chybu: {json.dumps(err, ensure_ascii=False)}")
    return result["tables"][0]["rows"]


def last_day(y, m):
    return (dt.date(y + (m == 12), (m % 12) + 1, 1) - dt.timedelta(days=1)).day


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--month", help="YYYY-MM, výchozí aktuální měsíc")
    p.add_argument("--out", help="výstupní CSV, výchozí runrate-YYYY-MM.csv")
    a = p.parse_args()

    today = dt.date.today()
    if a.month:
        months = [tuple(int(x) for x in a.month.split("-"))]
    else:
        months = [(today.year, today.month)]
        # Měsíc je definitivní až 4. den následujícího (DUZP), do té doby
        # stahujeme i minulý, ať se jeho poslední dny dopíšou.
        if today.day <= 4:
            prev = today.replace(day=1) - dt.timedelta(days=1)
            months.insert(0, (prev.year, prev.month))
    if a.out and len(months) > 1:
        sys.exit("--out jde jen s jedním měsícem, přidej --month.")

    token = get_token()
    for y, m in months:
        dump(run_query(token, DAX.format(y=y, m=m, last=last_day(y, m))),
             a.out or f"runrate-{y}-{m:02d}.csv", y, m)


def dump(rows, out, y, m):
    # Klíče přijdou jako "Calendar[Date]" a "[Sales]" — zkrátíme na čitelné názvy.
    def key(row, want):
        for k in row:
            if k.endswith(f"[{want}]"):
                return row[k]
        return None

    cols = ["Date", "Division name", "Sales", "SalesTarget", "GM1",
            "InvoicedOrders", "Documents", "WebSessions"]
    n = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for row in rows:
            div = key(row, "Division name")
            if div not in DIVISIONS:
                continue
            date = str(key(row, "Date") or "")[:10]
            w.writerow([date, div] + [key(row, c) for c in cols[2:]])
            n += 1

    print(f"{out}: {n} řádků ({y}-{m:02d}, {len(DIVISIONS)} divizí)")
    if n == 0:
        print("POZOR: nula řádků — zkontroluj názvy měr a tabulek v DAX dotazu.",
              file=sys.stderr)


if __name__ == "__main__":
    main()
