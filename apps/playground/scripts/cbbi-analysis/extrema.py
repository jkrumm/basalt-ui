from common import *
import numpy as np

ts,dates,price,M = load()
lp = np.log(price)
n = len(lp)

def local_ext(arr, w, kind):
    out=[]
    for i in range(n):
        a=max(0,i-w); b=min(n,i+w+1)
        seg=arr[a:b]
        if kind=="max" and arr[i]==seg.max(): out.append(i)
        if kind=="min" and arr[i]==seg.min(): out.append(i)
    # collapse plateaus / near-duplicates within w
    keep=[]
    for i in out:
        if keep and i-keep[-1] <= w:
            better = arr[i]>arr[keep[-1]] if kind=="max" else arr[i]<arr[keep[-1]]
            if better: keep[-1]=i
        else: keep.append(i)
    return keep

W=180
tops = local_ext(lp,W,"max")
bots = local_ext(lp,W,"min")

def prom_top(i):
    # drop to the lower of the two adjacent troughs (log units)
    l=lp[i]; left=lp[:i+1]; right=lp[i:]
    lm = left.min() if len(left) else l
    rm = right.min() if len(right) else l
    return l - max(lm,rm)
def prom_bot(i):
    l=lp[i]; left=lp[:i+1]; right=lp[i:]
    lM = left.max() if len(left) else l
    rM = right.max() if len(right) else l
    return min(lM,rM) - l

tp = sorted(((prom_top(i),i) for i in tops), reverse=True)
bp = sorted(((prom_bot(i),i) for i in bots), reverse=True)

print("=== ALL local maxima (w=180) with prominence ===")
for p,i in sorted(tp, key=lambda x:x[1]):
    print(f"{dates[i]}  price={price[i]:>10.0f}  prom(log)={p:.3f}")
print("=== ALL local minima (w=180) with prominence ===")
for p,i in sorted(bp, key=lambda x:x[1]):
    print(f"{dates[i]}  price={price[i]:>10.2f}  prom(log)={p:.3f}")
