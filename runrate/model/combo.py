import pandas as pd, numpy as np
R=pd.read_pickle('bt.pkl')
big=R[R.trh.isin(['RS CZ','RS SK'])&R.Y.notna()].copy()
print('RS CZ+SK, optimální váha tvaru×MTD (zbytek loni×růst) podle dne měsíce:')
best={}
for d,g in big.groupby('d'):
    errs={a:(np.abs((a*g.S+(1-a)*g.Y)/g.act-1)).mean()*100 for a in np.arange(0,1.01,0.1)}
    a=min(errs,key=errs.get); best[d]=round(a,1)
    print(f' den {d:2d}: váha tvaru {a:.1f} -> chyba {errs[a]:.1f} %  (jen loni {errs[0.0]:.1f} %, jen tvar {errs[1.0]:.1f} %, A {g.eA.abs().mean()*100:.1f} %)')
sm=R[R.trh.isin(['SE HU','KS CZ','KS SK'])].copy()
print('\nmalé trhy: tvar×MTD vs směs s A')
for d,g in sm.groupby('d'):
    errs={a:(np.abs((a*g.S+(1-a)*g.A)/g.act-1)).median()*100 for a in np.arange(0,1.01,0.25)}
    print(f' den {d:2d}: '+'  '.join(f'{a:.2f}:{e:.1f}' for a,e in errs.items()),' (medián chyby; váha tvaru)')
# bias
print('\nzkreslení (průměrná chyba se znaménkem, RS CZ+SK, %):')
print(big.groupby('d')[['eA','eS','eY']].mean().mul(100).round(1).to_string())
