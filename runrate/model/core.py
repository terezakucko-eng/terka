import pandas as pd, numpy as np
from sklearn.linear_model import Ridge
from feats import calendar
df=pd.read_pickle('daily.pkl')
BIG=['RS CZ','RS SK']; MK=['RS CZ','RS SK','SE HU','KS CZ','KS SK']
def series(trh):
    x=df[df.trh==trh].set_index('d').sort_index().copy()
    if trh=='KS CZ': x.loc[x.index<'2025-10-01','sales']=np.nan
    return x
def shape_rows(trh, until):
    x=series(trh); x=x[(x.index<until)&x.sales.notna()].copy()
    x['ym']=x.index.to_period('M')
    # jen celé měsíce
    cnt=x.groupby('ym').sales.transform('size'); x=x[cnt>=28]
    m=x.groupby('ym').sales.transform('mean'); off=0.05*x.sales.clip(lower=0).mean()
    y=np.log((x.sales.clip(lower=0)+off)/(m+off))
    tm=x.groupby('ym').target.transform('mean')
    plan=np.where((x.target>0)&(tm>0),np.log((x.target+1)/(tm+1)),0.0)
    X=calendar(x.index); X['plan']=plan
    X['ly_prof']=ly_profile(trh,x.index)
    age=(pd.Timestamp(until)-x.index).days.values
    return X,y.clip(y.quantile(0.01),y.quantile(0.99)),0.5**(age/270)
def ly_profile(trh, dates):
    # loňský průběh uvnitř měsíce: 7denní průměr loňského zarovnaného dne / průměr loňských zarovnaných dnů celého měsíce
    if trh not in MK: return np.zeros(len(dates))
    x=series(trh).sales.clip(lower=0)
    s7=x.rolling(7,center=True,min_periods=5).mean()
    dates=pd.DatetimeIndex(dates); ly=dates-pd.Timedelta(days=364)
    v=s7.reindex(ly).values
    out=np.zeros(len(dates))
    per=dates.to_period('M')
    for p in np.unique(per):
        m=(per==p); vv=v[m]
        if np.isnan(vv).any() or np.nanmean(vv)<=0: continue
        out[m]=np.log(np.clip(vv,1e-9,None)/vv.mean())
    return out
def fit_shape(trh, until):
    # malé trhy: tvar z RS CZ+SK (vlastní data jsou moc zašuměná)
    src=[trh] if trh in BIG else BIG
    Xs,ys,ws=[],[],[]
    for t in src:
        X,y,w=shape_rows(t,until); Xs.append(X); ys.append(y); ws.append(w)
    X=pd.concat(Xs); y=pd.concat(ys); w=np.concatenate(ws)
    return Ridge(alpha=3.0).fit(X,y,sample_weight=w), list(X.columns)
def month_weights(mdl, cols, dates, target, trh=None):
    X=calendar(dates); tm=np.mean(target) if np.mean(target)>0 else 0
    X['plan']=np.log((np.asarray(target)+1)/(tm+1)) if tm>0 else 0.0
    X['ly_prof']=ly_profile(trh,dates) if trh else 0.0
    w=np.exp(mdl.predict(X[cols])); return w/w.sum()
