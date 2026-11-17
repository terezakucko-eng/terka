# Krok 1: tvar uvnitř měsíce — log(tržba dne / průměr měsíce) ~ kalendář + plán + spend
import pandas as pd, numpy as np, sys
from sklearn.linear_model import Ridge
from feats import calendar
df=pd.read_pickle('daily.pkl')
def prep(trh, df=df):
    x=df[df.trh==trh].set_index('d').sort_index().copy()
    x['ym']=x.index.to_period('M')
    if trh=='KS CZ': x=x[x.index>='2025-10-01']
    m=x.groupby('ym').sales.transform('mean')
    off=0.05*x.sales.clip(lower=0).mean()
    x['y']=np.log((x.sales.clip(lower=0)+off)/(m+off))
    tm=x.groupby('ym').target.transform('mean')
    x['plan']=np.where((x.target>0)&(tm>0),np.log((x.target+1)/(tm+1)),0.0)
    x['ma_plan']=((x.target>0)&(tm>0)).astype(float)
    sp=x.spend.rolling(7,center=True,min_periods=4).mean(); spm=x.groupby('ym').spend.transform('mean')
    x['spend_dev']=np.where(x.spend.notna()&(spm>0),np.log((sp+1)/(spm+1)),0.0)
    return x
def design(x):
    f=calendar(x.index)
    f['plan']=x['plan'].values; f['spend_dev']=x['spend_dev'].values
    return f
if __name__=='__main__':
    for trh in ['RS CZ','RS SK','SE HU','KS CZ','KS SK']:
        x=prep(trh); X=design(x); y=x.y
        # váha: novější data víc (poločas 9 měsíců), winsorizace odlehlých dnů
        age=(x.index.max()-x.index).days.values
        w=0.5**(age/270)
        yc=y.clip(y.quantile(0.01),y.quantile(0.99))
        mdl=Ridge(alpha=3.0).fit(X,yc,sample_weight=w)
        co=pd.Series(mdl.coef_,index=X.columns)
        pred=mdl.predict(X); r2=1-np.average((yc-pred)**2,weights=w)/np.average((yc-np.average(yc,weights=w))**2,weights=w)
        print(f'\n== {trh}  R2 (vážené)={r2:.2f}')
        pick=['dom1_3','dom4_7','dom8_10','dom11_13','dom14_16','dom17_19','dom20_22','dom23_25','dom26_28','dom29_31','svatek','po_svatku','bf_tyden_pred','bf_den','bf_vikend','cyber_po','vanoce_nakup','vanoce_po','valentyn','plan','spend_dev']
        print(' '.join(f'{k}:{np.expm1(co[k])*100:+.0f}%' if k not in ('plan','spend_dev') else f'{k}:{co[k]:.2f}' for k in pick))
        dows=['po','út','st','čt','pá','so','ne']
        print(' bez sob.exp: '+' '.join(f'{dows[k]}:{np.expm1(co[f"dow{k}"])*100:+.0f}%' for k in range(7)))
        print(' se sob.exp.: '+' '.join(f'{dows[k]}:{np.expm1(co[f"dow{k}"]+co[f"dow{k}_sobexp"])*100:+.0f}%' for k in range(7)))
