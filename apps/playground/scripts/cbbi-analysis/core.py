from common import *
import numpy as np

ts,dates,price,M = load()
lp=np.log(price); n=len(lp)

def local_ext(arr,w,kind):
    out=[]
    for i in range(n):
        a=max(0,i-w); b=min(n,i+w+1); seg=arr[a:b]
        if (kind=="max" and arr[i]==seg.max()) or (kind=="min" and arr[i]==seg.min()): out.append(i)
    keep=[]
    for i in out:
        if keep and i-keep[-1]<=w:
            better = arr[i]>arr[keep[-1]] if kind=="max" else arr[i]<arr[keep[-1]]
            if better: keep[-1]=i
        else: keep.append(i)
    return keep
def prom(i,kind):
    if kind=="max": return lp[i]-max(lp[:i+1].min(), lp[i:].min())
    return min(lp[:i+1].max(), lp[i:].max())-lp[i]

W=180
raw_tops=[i for i in local_ext(lp,W,"max") if prom(i,"max")>=0.7]
raw_bots=[i for i in local_ext(lp,W,"min") if prom(i,"min")>=1.3]
# cycle top = prominent local max that is a running all-time high
TOPS=[i for i in raw_tops if lp[i]>=lp[:i+1].max()-1e-12]
# cycle bottom = prominent local min that is the lowest close since the preceding top
BOTS=[]
for i in raw_bots:
    prev=[t for t in TOPS if t<i]
    start=prev[-1] if prev else 0
    if lp[i]<=lp[start:i+1].min()+1e-12: BOTS.append(i)
PROV_BOT=[i for i in local_ext(lp,W,"min") if dates[i].year>=2026]

def w30(i,f):
    a=max(0,i-30); b=min(n,i+31)
    s=f[a:b]
    return s if np.isfinite(s).any() else np.array([np.nan])
