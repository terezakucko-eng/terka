# Zpětný test pro přepínač AUTO: A, B, C a Z změřené stejně jako ve vzorcích tabulky,
# chyba odhadu konce měsíce za celou firmu pro každý den v měsíci.
# Malé trhy berou u A a B referenční faktor velkých trhů (jako list Křivky targetu).
# Výstup: auto_tab_out.json (den -> průměrná absolutní chyba A/B/C/Z) -> list RRRR_MM Křivky targetu, řádky 59–89.
# Spouštět při založení měsíce: python3 bt_auto.py
import pandas as pd, numpy as np, json
from core import *
ANCH={1:0.3,3:0.4,7:0.5,14:0.5,17:0.6,21:0.8,24:1.0,31:1.0}       # váha tvar×MTD, stejně jako params.py
WZ=np.interp(range(1,32),list(ANCH),list(ANCH.values()))
MONTHS={'2026-02':1,'2026-03':1,'2026-06':2,'2026-07':3,'2026-08':3,'2026-09':3,'2026-10':3}   # duben a květen vyřazeny, váha na novější
rows=[]
for Ms,wt in MONTHS.items():
    M=pd.Period(Ms,'M'); start=M.to_timestamp(); end=(M+1).to_timestamp()-pd.Timedelta(days=1); nd=(end-start).days+1
    per={}
    for trh in MK:
        x=series(trh); xm=x[(x.index>=start)&(x.index<=end)]
        assert not xm.sales.isna().any() and len(xm)==nd, (trh,Ms)
        mdl,cols=fit_shape(trh,start)
        w=month_weights(mdl,cols,xm.index,xm.target.values if trh in BIG else np.ones(nd),trh)   # jako params.py
        per[trh]=(x,xm,w)
    for d in range(1,nd):
        o=start+pd.Timedelta(days=d-1); r={}
        for trh,(x,xm,w) in per.items():
            act=xm.sales.values; T=xm.target.values; mtd=act[:d].sum()
            Ao=mtd*T.sum()/T[:d].sum()
            l7=x[(x.index>o-pd.Timedelta(days=7))&(x.index<=o)]
            Bo=mtd+(l7.sales.sum()/l7.target.sum())*T[d:].sum()
            S=mtd/w[:d].sum(); Z=S
            if trh in BIG:
                win=x[(x.index>o-pd.Timedelta(days=28))&(x.index<=o)]
                lyw=x.reindex(win.index-pd.Timedelta(days=364)); lyr=x.reindex(xm.index[d:]-pd.Timedelta(days=364))
                Y=mtd+win.sales.sum()/lyw.sales.sum()*lyr.sales.sum(); a=WZ[d-1]; Z=a*S+(1-a)*Y
            r[trh]=dict(act=act.sum(),mtd=mtd,Ao=Ao,Bo=Bo,C=mtd/d*nd,Z=Z)
        mb=sum(r[t]['mtd'] for t in BIG)
        refA=sum(r[t]['Ao'] for t in BIG)/mb; refB=sum(r[t]['Bo'] for t in BIG)/mb
        tot=dict(act=0,A=0,B=0,C=0,Z=0)
        for trh,v in r.items():
            big=trh in BIG
            for k,val in (('act',v['act']),('A',v['Ao'] if big else v['mtd']*refA),('B',v['Bo'] if big else v['mtd']*refB),('C',v['C']),('Z',v['Z'])): tot[k]+=val
        rows.append(dict(M=Ms,wt=wt,d=d,**tot))
R=pd.DataFrame(rows)
t=R.groupby('d').apply(lambda g: pd.Series({c:np.average((g[c]/g.act-1).abs(),weights=g.wt) for c in 'ABCZ'}))
t.loc[31]=t.loc[30]
t['best']=t[['A','B','C','Z']].idxmin(axis=1)
print((t[['A','B','C','Z']]*100).round(2).assign(best=t.best).to_string())
t[['A','B','C','Z']].round(4).to_json('auto_tab_out.json')
