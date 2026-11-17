# Sestaví denní dataset: tržby DUZP, target, objednávky, návštěvy + Google Ads spend po trzích
import json,sys,collections
import pandas as pd, numpy as np
h=json.load(open(sys.argv[1])); a=json.load(open(sys.argv[2]))
rows=[]
for trh,dd in h.items():
    for ds,v in dd.items():
        s,t,g,o,ses=v
        rows.append(dict(trh=trh,d=ds,sales=s or 0.0,target=t or 0.0,gm1=g,orders=o or 0,sessions=ses or 0))
df=pd.DataFrame(rows); df['d']=pd.to_datetime(df['d'])
accmap={'RuzovySlon.cz':'RS CZ','Ruzovyslon.sk':'RS SK','SexyElephant.hu':'SE HU','Kondomshop.cz new':'KS CZ','Kondomshop.sk':'KS SK'}
sp=collections.defaultdict(float); val=collections.defaultdict(float)
for r in a:
    t=accmap.get(r['acc'])
    if not t: continue
    c=r['cost_czk'] if r['cost_czk'] is not None else (r['cost'] or 0)*24.34
    v=(r['val'] or 0)*(1 if r['cur']=='CZK' else (24.34 if r['cur']=='EUR' else (0.0667 if r['cur']=='HUF' else 1)))
    sp[(t,r['d'])]+=c; val[(t,r['d'])]+=v
df['spend']=[sp.get((t,d.strftime('%Y-%m-%d')),np.nan) for t,d in zip(df.trh,df.d)]
df.loc[df.d<'2025-10-01','spend']=np.nan
df['adsval']=[val.get((t,d.strftime('%Y-%m-%d')),np.nan) for t,d in zip(df.trh,df.d)]
df.to_pickle(sys.argv[3])
print(df.groupby('trh').agg(n=('d','size'),od=('d','min'),do=('d','max'),sales=('sales','sum'),spend=('spend','sum')))
