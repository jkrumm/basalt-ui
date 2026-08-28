from core import *
import numpy as np, datetime as dt
A=np.vstack([M[m] for m in METRICS])  # 9 x n
def peer_med(k):
    o=np.delete(A,k,axis=0)
    return np.nanmedian(o,axis=0)
print(f"{'metric':12s} | {'ALL-HISTORY (peer-consensus)':^34s} | {'LAST 4Y':^34s}")
print(f"{'':12s} | {'nTop':>5s} {'aTop':>5s} {'nBot':>5s} {'aBot':>5s} {'pSep':>6s} {'hit':>6s} | {'nTop':>5s} {'aTop':>5s} {'nBot':>5s} {'aBot':>5s} {'pSep':>6s} {'hit':>6s}")
out={}
for k,m in enumerate(METRICS):
    pm=peer_med(k); f=A[k]
    row=[]
    for sl in (slice(0,n), slice(n-1461,n)):
        p=pm[sl]; v=f[sl]
        tm=(p>=0.85)&np.isfinite(v); bm=(p<=0.15)&np.isfinite(v)
        aT=np.nanmean(v[tm]) if tm.sum() else np.nan
        aB=np.nanmean(v[bm]) if bm.sum() else np.nan
        hit=np.nanmean(v[tm]>=0.8) if tm.sum() else np.nan
        row.append((tm.sum(),aT,bm.sum(),aB,aT-aB,hit))
    out[m]=row
    a,b=row
    fmt=lambda r: f"{r[0]:5d} {r[1]:5.2f} {r[2]:5d} {r[3]:5.2f} {r[4]:+6.2f} {r[5]*100 if np.isfinite(r[5]) else float('nan'):5.0f}%"
    print(f"{m:12s} | {fmt(a)} | {fmt(b)}")
print("\n# recommended rule evaluation: flag if aTop(last4y) < 0.80  OR  tail-null >= 2 days")
for k,m in enumerate(METRICS):
    aT4=out[m][1][1]
    f=A[k]; tail=0
    for x in f[::-1]:
        if np.isnan(x): tail+=1
        else: break
    flag = (aT4<0.80) or (tail>=2)
    print(f"  {m:12s} aTop4y={aT4:.2f} tailNull={tail} -> {'FLAG' if flag else 'ok'}{'  (stale-only)' if flag and aT4>=0.80 else ''}")
