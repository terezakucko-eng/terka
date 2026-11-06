import pandas as pd, numpy as np, json, os
CFG=json.load(open(os.path.join(os.path.dirname(__file__),'config.json')))
_HOL=set(pd.to_datetime(['2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-08','2025-07-05','2025-07-06','2025-09-28','2025-10-28','2025-11-17','2025-12-24','2025-12-25','2025-12-26',
 '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-08','2026-07-05','2026-07-06','2026-09-28','2026-10-28','2026-11-17','2026-12-24','2026-12-25','2026-12-26','2027-01-01']))
# svátky, kdy sklad podle dat normálně expedoval (v sezóně se sobotní expedicí), se jako svátek nepočítají
HOL=_HOL-set(pd.to_datetime(CFG.get('sklad_jede_o_svatku',[])))
BF={2025:pd.Timestamp('2025-11-28'),2026:pd.Timestamp('2026-11-27')}
DOMB=[0,3,7,10,13,16,19,22,25,28,31]
def sat_regime(d):
    # období, kdy sklad expeduje i v sobotu (config.json): změřeno z dat (RS CZ sobota >18 % bloku so-ne-po)
    ship=CFG['sobotni_expedice']
    return any(pd.Timestamp(a)<=d<=pd.Timestamp(b) for a,b in ship)
def workday(d): return d.dayofweek<5 and d not in HOL
def calendar(dates):
    f=pd.DataFrame(index=pd.DatetimeIndex(dates))
    reg=np.array([sat_regime(d) for d in f.index])
    for k in range(7):
        # dvě oddělené sady dnů v týdnu: bez víkendové expedice a s ní. Ridge stahuje každou sadu
        # k rovnoměrnému týdnu, ne ke druhému režimu. Dřív byla víkendová expedice jen přirážka ke
        # starému vzoru (po +60 %, so -61 %) a s málem dat ji ridge stáhl jen napůl: model dál
        # čekal pondělí s nedělními tržbami (+38 %) a slabou sobotu (-29 %).
        f[f'dow{k}']=((f.index.dayofweek==k)&~reg).astype(float)
        f[f'dow{k}_sobexp']=((f.index.dayofweek==k)&reg).astype(float)
    dom=f.index.day
    for i in range(len(DOMB)-1):
        f[f'dom{DOMB[i]+1}_{DOMB[i+1]}']=((dom>DOMB[i])&(dom<=DOMB[i+1])).astype(float)
    hol=np.array([d in HOL for d in f.index])
    f['svatek']=hol.astype(float)
    # svátek, kdy sklad expeduje jako o víkendu (config sklad_jede_o_svatku)
    f['svatek_s_expedici']=np.array([d in _HOL and d not in HOL for d in f.index],float)
    # první pracovní den po svátku (dohánění fakturace)
    prev_hol=[]
    for d in f.index:
        if workday(d):
            p=d-pd.Timedelta(days=1); flag=False
            while not workday(p):
                if p in HOL: flag=True
                p-=pd.Timedelta(days=1)
            prev_hol.append(flag)
        else: prev_hol.append(False)
    f['po_svatku']=np.array(prev_hol,float)
    # Black Friday a okolí
    bf=np.array([BF.get(d.year) for d in f.index])
    delta=np.array([(d-b).days if b is not None else 999 for d,b in zip(f.index,bf)])
    f['bf_tyden_pred']=((delta>=-4)&(delta<=-1)).astype(float)
    f['bf_den']=(delta==0).astype(float)
    f['bf_vikend']=((delta>=1)&(delta<=2)).astype(float)
    # Vánoce: 1.-20.12. nákupní, 21.-31.12. útlum
    f['vanoce_nakup']=((f.index.month==12)&(dom<=19)).astype(float)
    f['vanoce_po']=((f.index.month==12)&(dom>=21)).astype(float)
    f['valentyn']=((f.index.month==2)&(dom>=5)&(dom<=13)).astype(float)
    return f
