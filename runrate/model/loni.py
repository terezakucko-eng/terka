import json,sys,os,datetime as dtm
D=dtm.date; td=dtm.timedelta
d=json.load(open(sys.argv[1]))
MK=['RS CZ','RS SK','SE HU','KS CZ','KS SK']
# podíly so/ne/po při sobotní expedici (config.json); HU = podíly RS CZ
SH=json.load(open(os.path.join(os.path.dirname(__file__),'config.json')))['podily_so_ne_po']
def raw(t,x):
    v=d[t].get(x.isoformat()); return (v[0] or 0) if v else 0
start,end=D(2025,7,1),D(2026,1,31)
ser={t:{} for t in MK}   # klíč = letošní (zarovnané) datum
x=start
while x<=end:
    for t in MK: ser[t][x+td(364)]=raw(t,x)
    x+=td(1)
# 1) víkendy: sobota bez expedice loni -> přerozdělit blok so-ne-po podle podílů se sobotní expedicí (jen pro letošní data 24.10.-31.12.2026)
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
# 2) svátek 17.11.: loni pondělí (dohánělo se v úterý), letos úterý -> letos út 17.11. = loňská normální středa, st 18.11. = loňské doháněcí úterý
for t in MK:
    a,b=D(2026,11,17),D(2026,11,18)
    ser[t][a],ser[t][b]=ser[t][b],ser[t][a]
rows=[]
for a in sorted(ser['RS CZ']):
    rows.append([a.isoformat(),(a-td(364)).isoformat()]+[round(ser[t][a],2) for t in MK])
json.dump(rows,open(sys.argv[2],'w'))
print(len(rows),rows[0][:2],rows[-1][:2])
