from core import *
import numpy as np
print("# PiCycle max within +-30d of each top")
for i in TOPS: print(f"  {dates[i]}  picycle30={np.nanmax(w30(i,M['PiCycle'])):.2f}  raw={M['PiCycle'][i]:.2f}")
print("\n# last date each metric exceeded 0.8 / fell below 0.2")
for m in METRICS:
    f=M[m]
    i8=np.where(f>0.8)[0]; i2=np.where(f<0.2)[0]
    print(f"  {m:12s} last>0.8={dates[i8[-1]] if len(i8) else 'never'}  last<0.2={dates[i2[-1]] if len(i2) else 'never'}")
print("\n# historical distribution of 'days since last >0.8' (excl. first 2y), p50/p90/max, and today")
for m in METRICS:
    f=M[m]; g=[]; lastok=-1
    for i in range(n):
        if np.isfinite(f[i]) and f[i]>0.8: lastok=i
        g.append(i-lastok if lastok>=0 else np.nan)
    g=np.array(g,dtype=float)[730:]
    print(f"  {m:12s} p50={np.nanmedian(g):6.0f} p90={np.nanpercentile(g,90):6.0f} max={np.nanmax(g):6.0f} today={g[-1]:6.0f} pct-rank={np.nanmean(g<=g[-1])*100:5.1f}%")
print("\n# ReserveRisk: share of days >0.8 by cycle epoch (folklore check: 'sat low for years')")
import datetime as dt
eps=[(dt.date(2011,6,27),dt.date(2015,1,14)),(dt.date(2015,1,15),dt.date(2018,12,15)),(dt.date(2018,12,16),dt.date(2022,11,9)),(dt.date(2022,11,10),dt.date(2026,8,27))]
for a,b in eps:
    sel=np.array([a<=d<=b for d in dates])
    print(f"  {a}..{b}: ", " ".join(f"{m}={np.nanmean(M[m][sel]>0.8)*100:4.1f}%" for m in ['PiCycle','ReserveRisk','Trolololo','Woobull','MVRV']))
