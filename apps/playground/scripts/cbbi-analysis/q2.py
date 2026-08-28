from core import *
import numpy as np

def scorecard(tops,bots,label):
    print(f"\n##### {label}  tops={[str(dates[i]) for i in tops]}  bots={[str(dates[i]) for i in bots]}")
    hdr=["metric"]+[f"T{dates[i]:%y-%m}" for i in tops]+["mTop","mTop30","fl>=.85"]+[f"B{dates[i]:%y-%m}" for i in bots]+["mBot","mBot30","fl<=.15","sep","sep30"]
    print(" | ".join(f"{h:>8s}" for h in hdr))
    rows={}
    for m in METRICS:
        f=M[m]
        tv=[f[i] for i in tops]; tm=[np.nanmax(w30(i,f)) for i in tops]
        bv=[f[i] for i in bots]; bm=[np.nanmin(w30(i,f)) for i in bots]
        mt=np.nanmean(tv); mt30=np.nanmean(tm); mb=np.nanmean(bv); mb30=np.nanmean(bm)
        ft=sum(1 for x in tm if np.isfinite(x) and x>=0.85); fb=sum(1 for x in bm if np.isfinite(x) and x<=0.15)
        cells=[m]+[f"{x:.2f}" if np.isfinite(x) else "  -" for x in tv]+[f"{mt:.2f}",f"{mt30:.2f}",f"{ft}/{len(tops)}"]
        cells+=[f"{x:.2f}" if np.isfinite(x) else "  -" for x in bv]+[f"{mb:.2f}",f"{mb30:.2f}",f"{fb}/{len(bots)}",f"{mt-mb:+.2f}",f"{mt30-mb30:+.2f}"]
        print(" | ".join(f"{c:>8s}" for c in cells))
        rows[m]=dict(mt=mt,mt30=mt30,mb=mb,mb30=mb30,ft=ft,fb=fb,sep=mt-mb,sep30=mt30-mb30)
    return rows

ALL=scorecard(TOPS,BOTS,"ALL CYCLES")
L2T=[i for i in TOPS if dates[i]>=__import__('datetime').date(2018,12,15)]
L2B=[i for i in BOTS if dates[i]>=__import__('datetime').date(2018,12,15)]
LAST=scorecard(L2T,L2B,"LAST TWO CYCLES (>=2018-12-15)")

print("\n##### divergence: sep(all) -> sep(last2)")
for m in METRICS:
    print(f"{m:12s} all={ALL[m]['sep']:+.3f}  last2={LAST[m]['sep']:+.3f}  delta={LAST[m]['sep']-ALL[m]['sep']:+.3f}   sep30 all={ALL[m]['sep30']:+.3f} last2={LAST[m]['sep30']:+.3f}")
import pickle; pickle.dump((ALL,LAST,[int(i) for i in L2T],[int(i) for i in L2B]),open('/tmp/cbbi-analysis/q2.pkl','wb'))
