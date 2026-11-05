# Loňské denní tržby posunuté o 364 dní na letošní kalendář (list „Loni po dnech")
import json,sys,os,datetime as dtm
D=dtm.date; td=dtm.timedelta
d=json.load(open(sys.argv[1]))
CFG=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'config.json')))
MK=['RS CZ','RS SK','SE HU','KS CZ','KS SK']
SH=CFG['podily_so_ne_po']            # so/ne/po při sobotní expedici; HU = podíly RS CZ
SH4=CFG['podily_so_ne_po_ut']        # so/ne/po/út při sobotní expedici, bez svátku
OPEN=set(D.fromisoformat(x) for x in CFG.get('sklad_jede_o_svatku',[]))
def raw0(t,x):
    v=d[t].get(x.isoformat()); return (v[0] or 0) if v else 0
# 0) loňské mimořádné dny (např. start vánoční kampaně): pondělí -> blok so-ne-po = minulý týden ×1,05
FIX={}
for ds,info in CFG.get('loni_mimoradne_dny',{}).items():
    x=D.fromisoformat(ds)
    for t in info.get('trhy',MK):
        if x.weekday()==0:
            prev=sum(raw0(t,x-td(7+i)) for i in range(3))
            FIX[(t,x)]=max(prev*1.05-raw0(t,x-td(2))-raw0(t,x-td(1)),0)
        else:
            FIX[(t,x)]=raw0(t,x-td(7))
def raw(t,x): return FIX.get((t,x),raw0(t,x))
start,end=D(2025,7,1),D(2026,1,31)
ser={t:{} for t in MK}   # klíč = letošní (zarovnané) datum
x=start
while x<=end:
    for t in MK: ser[t][x+td(364)]=raw(t,x)
    x+=td(1)
# 1) víkendy: sobota bez expedice loni -> blok so-ne-po přerozdělit podle podílů při sobotní expedici (letošní data 24.10.-31.12.2026)
x=start
while x<=end:
    if x.weekday()==5:
        a=x+td(364)
        if D(2026,10,24)<=a<=D(2026,12,31):
            cz=[raw('RS CZ',x+td(i)) for i in range(3)]
            if sum(cz)>0 and cz[0]/sum(cz)<=0.18:
                for t in MK:
                    tot=sum(ser[t][a+td(i)] for i in range(3))
                    for i in range(3): ser[t][a+td(i)]=tot*SH[t][i]
    x+=td(1)
# 2) svátek 17.11.: loni pondělí (sklad zavřený, dohánělo se v úterý). Letos úterý.
if D(2026,11,17) in OPEN:
    # sklad letos o svátku jede -> loňský blok so 15.11.-út 18.11.2025 rozložit jako běžný týden (so/ne/po/út)
    a0=D(2026,11,14)
    for t in MK:
        tot=sum(raw(t,D(2025,11,15)+td(i)) for i in range(4))
        for i in range(4): ser[t][a0+td(i)]=tot*SH4[i]
else:
    # sklad zavřený -> letos út 17.11. = loňská normální středa, st 18.11. = loňské doháněcí úterý
    for t in MK:
        a,b=D(2026,11,17),D(2026,11,18)
        ser[t][a],ser[t][b]=ser[t][b],ser[t][a]
rows=[]
for a in sorted(ser['RS CZ']):
    rows.append([a.isoformat(),(a-td(364)).isoformat()]+[round(ser[t][a],2) for t in MK])
json.dump(rows,open(sys.argv[2],'w'))
print(len(rows),rows[0][:2],rows[-1][:2])
