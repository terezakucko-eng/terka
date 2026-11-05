# Měsíční přepočet parametrů modelu pro list „Model váhy" (spouštět při založení měsíce / při přetrénování)
import pandas as pd, numpy as np, json, sys
from core import *
MONTH=pd.Period(sys.argv[1] if len(sys.argv)>1 else '2026-11','M')
ALL=['RS CZ','RS SK','SE HU','SE RO','SE BG','SE HR','SE SI','KS CZ','KS SK']
# denní targety BI pro měsíc (Křivky B6:J35), kvůli plánu aktivit — jen RS CZ a RS SK (u malých trhů je target zašuměný)
tg=json.load(open('targets_month.json'))
start=MONTH.to_timestamp(); dates=pd.date_range(start,(MONTH+1).to_timestamp()-pd.Timedelta(days=1))
W={}; EFF={}
for t in ALL:
    mdl,cols=fit_shape(t if t in MK else 'SE HU', start)   # SE HU a menší -> tvar RS CZ+SK
    T=np.array(tg[t],float) if t in BIG else np.ones(len(dates))
    W[t]=month_weights(mdl,cols,dates,T,t if t in MK else None)
    if t in BIG: EFF[t]=pd.Series(mdl.coef_,index=cols)
# alfa (váha tvaru×MTD vs loni×růst) a chyby z backtestu
R=pd.read_pickle('bt.pkl')
anch={1:0.3,3:0.4,7:0.5,14:0.5,17:0.6,21:0.8,24:1.0,31:1.0}
alpha=np.interp(range(1,32),list(anch),list(anch.values()))
big=R[R.trh.isin(BIG)&R.Y.notna()].copy()
def blend(g):
    a=np.interp(g.d,list(anch),list(anch.values())); return a*g.S+(1-a)*g.Y
big['eC']=blend(big)/big.act-1
sdb=big.groupby('d').eC.apply(lambda e: np.sqrt(np.mean(np.log1p(e)**2)))
sm=R[R.trh.isin(['SE HU','KS CZ','KS SK'])]
sds=sm.groupby('d').eS.apply(lambda e: np.sqrt(np.median(np.log1p(e.clip(-0.9))**2))*1.25)
ds=list(sdb.index)
sd_big=np.interp(range(1,32),ds,sdb.values); sd_small=np.interp(range(1,32),ds,sds.values)
# spend: ln(plán / loňský stejný měsíc) a ln(spend posl. 28 dní letos / loni) k originu
from feats import CFG
plan=CFG['plan_spendu']
o=pd.Timestamp(sys.argv[2] if len(sys.argv)>2 else '2026-11-03')
spend={}
for t in BIG:
    x=series(t)
    s28=x.spend[(x.index>o-pd.Timedelta(days=28))&(x.index<=o)].sum(); s28ly=x.spend[(x.index>o-pd.Timedelta(days=392))&(x.index<=o-pd.Timedelta(days=364))].sum()
    lym=x.spend[(x.index>=dates[0]-pd.Timedelta(days=364))&(x.index<=dates[-1]-pd.Timedelta(days=364))].sum()
    spend[t]=(float(np.log(plan[t]/lym)),float(np.log(s28/s28ly)))
out=dict(weights={t:[float(v) for v in W[t]] for t in ALL},alpha=[float(a) for a in alpha],sd_big=[float(v) for v in sd_big],sd_small=[float(v) for v in sd_small],spend=spend,
         eff={t:{k:float(v) for k,v in EFF[t].items()} for t in EFF})
json.dump(out,open('params_out.json','w'))
print('alfa',np.round(alpha,2)); print('sigma RS',np.round(sd_big,3)); print('sigma malé',np.round(sd_small,3)); print('spend',spend)
for t in ['RS CZ','SE RO']: print(t,'váhy ×30:',np.round(np.array(W[t])*len(dates),2))
