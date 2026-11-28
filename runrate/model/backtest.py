import pandas as pd, numpy as np
from core import *
ORIG=[3,7,10,14,17,21,24]
res=[]; daily=[]
months=pd.period_range('2025-07','2026-10',freq='M')
for trh in MK:
    x=series(trh)
    for M in months:
        start=M.to_timestamp(); end=(M+1).to_timestamp()-pd.Timedelta(days=1)
        xm=x[(x.index>=start)&(x.index<=end)]
        if xm.sales.isna().any() or len(xm)<28: continue
        mdl,cols=fit_shape(trh,start)
        w=month_weights(mdl,cols,xm.index,xm.target.values,trh)
        act=xm.sales.values; tot=act.sum(); T=xm.target.values
        for d in ORIG:
            mtd=act[:d].sum()
            A=mtd*T.sum()/T[:d].sum() if T[:d].sum()>0 else np.nan
            o=start+pd.Timedelta(days=d-1)
            last7=x[(x.index>o-pd.Timedelta(days=7))&(x.index<=o)]
            B=mtd+ (last7.sales.sum()/last7.target.sum())*T[d:].sum() if last7.target.sum()>0 else np.nan
            S=mtd/w[:d].sum()
            # YoY: loňský stejný den v týdnu (−364) × růst za 28 dní do originu
            win=x[(x.index>o-pd.Timedelta(days=28))&(x.index<=o)]
            ly_win=x.reindex(win.index-pd.Timedelta(days=364))
            ly_rest=x.reindex(xm.index[d:]-pd.Timedelta(days=364))
            Y=np.nan
            if ly_win.sales.notna().all() and ly_rest.sales.notna().all() and ly_win.sales.sum()>0:
                g=win.sales.sum()/ly_win.sales.sum(); Y=mtd+g*ly_rest.sales.sum()
            # L28 × tvar: úroveň posledních 28 dní (bez ohledu na měsíc) -> průměrná denní tržba měsíce = L28 / (průměrný tvar těch 28 dní)
            res.append(dict(trh=trh,M=str(M),d=d,act=tot,A=A,B=B,S=S,Y=Y,T=T.sum()))
            # denní přesnost zbytku měsíce (týdenní součty), metoda A vs tvar
            rest=act[d:]; 
            dA=T[d:]*(mtd/T[:d].sum())
            for nm,tt in (('S',S),('A',A)):
                pass
            daily.append(dict(trh=trh,M=str(M),d=d,act_rest=rest,predA=dA,wS=w[d:]/w[d:].sum(),T_rest=T[d:]))
R=pd.DataFrame(res)
for m in ['A','B','S','Y']: R['e'+m]=(R[m]/R.act-1)
R.to_pickle('bt.pkl'); pd.to_pickle(daily,'bt_daily.pkl')
def summ(sub,title):
    print('\n'+title+'  (průměrná absolutní chyba odhadu konce měsíce, %)')
    t=sub.groupby('d')[['eA','eB','eS','eY']].apply(lambda z: z.abs().mean()*100).round(1)
    t['n']=sub.groupby('d').size(); t.columns=['A (MTD×křivka)','B (tempo 7 dní)','Tvar×MTD','Loni×růst','n']; print(t.to_string())
summ(R[R.trh=='RS CZ'],'RS CZ 7/2025–10/2026')
summ(R[(R.trh=='RS CZ')&(R.Y.notna())],'RS CZ jen měsíce s loňskem (2/2026–10/2026)')
summ(R[R.trh=='RS SK'],'RS SK')
summ(R[R.trh.isin(['SE HU','KS CZ','KS SK'])],'malé trhy')
