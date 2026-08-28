from core import *
import numpy as np, pickle, datetime as dt
ALL,LAST,L2T,L2B=pickle.load(open(cache('q2.pkl'),'rb'))
A=np.vstack([M[m] for m in METRICS])
def grid(x): return float(np.clip(round(x*4)/4,0,2))
def scale(s):
    s=np.array([max(0.0,v) for v in s]); mx=s.max()
    return [grid(2*v/mx) for v in s]
# runtime stats (last 4y peer-consensus)
aT4={};aB4={}
for k,m in enumerate(METRICS):
    pm=np.nanmedian(np.delete(A,k,axis=0),axis=0)[n-1461:]; v=A[k][n-1461:]
    aT4[m]=np.nanmean(v[(pm>=0.85)&np.isfinite(v)]); aB4[m]=np.nanmean(v[(pm<=0.15)&np.isfinite(v)])
BROKEN={"PiCycle","Trolololo"}
OWNER={"RUPL","RHODL","Puell","2YMA","MVRV"}
W={}
W["i official equal (9)"]      ={m:1.0 for m in METRICS}
W["ii owner 5"]                ={m:(1.0 if m in OWNER else 0.0) for m in METRICS}
dd=scale([LAST[m]['sep30'] for m in METRICS])
W["iii data-driven sep30"]     ={m:(0.0 if m in BROKEN else dd[k]) for k,m in enumerate(METRICS)}
pk=scale([aT4[m]-0.70 for m in METRICS])
W["iv peak-sensitive"]         ={m:pk[k] for k,m in enumerate(METRICS)}
bt=scale([0.30-aB4[m] for m in METRICS])
W["v bottom-sensitive"]        ={m:bt[k] for k,m in enumerate(METRICS)}

def comp(w):
    wv=np.array([w[m] for m in METRICS])[:,None]
    ok=np.isfinite(A); X=np.where(ok,A,0.0)
    den=(wv*ok).sum(0); num=(wv*X).sum(0)
    return np.where(den>0,num/np.where(den==0,1,den),np.nan)
def firstcross(c,i,thr,up,win=365):
    a=max(0,i-win)
    for j in range(a,i+1):
        if np.isfinite(c[j]) and ((c[j]>=thr) if up else (c[j]<=thr)): return i-j
    return None
print("### weight vectors (0..2, 0.25 grid)")
print(f"{'composition':24s} "+" ".join(f"{m[:7]:>7s}" for m in METRICS))
for k,w in W.items(): print(f"{k:24s} "+" ".join(f"{w[m]:7.2f}" for m in METRICS))
print("\n### scorecard  (peakT = mean peak composite within +-30d of tops; troughB likewise)")
print(f"{'composition':24s} {'mTop':>5s} {'peakT':>6s} {'mBot':>5s} {'trghB':>6s} {'sep':>6s} | {'lag@.9':>22s} | {'lag@.1':>16s} | {'today':>6s}")
for k,w in W.items():
    c=comp(w)
    mt=np.nanmean([c[i] for i in TOPS]); pt=np.nanmean([np.nanmax(w30(i,c)) for i in TOPS])
    mb=np.nanmean([c[i] for i in BOTS]); tb=np.nanmean([np.nanmin(w30(i,c)) for i in BOTS])
    l9=[firstcross(c,i,0.9,True) for i in TOPS]; l1=[firstcross(c,i,0.1,False) for i in BOTS]
    s9=" ".join("na" if x is None else str(x) for x in l9); s1=" ".join("na" if x is None else str(x) for x in l1)
    hit9=sum(1 for x in l9 if x is not None); hit1=sum(1 for x in l1 if x is not None)
    med9=np.median([x for x in l9 if x is not None]) if hit9 else float('nan')
    med1=np.median([x for x in l1 if x is not None]) if hit1 else float('nan')
    print(f"{k:24s} {mt:5.2f} {pt:6.2f} {mb:5.2f} {tb:6.2f} {mt-mb:+6.2f} | {hit9}/6 med={med9:5.1f} [{s9}] | {hit1}/4 med={med1:5.1f} [{s1}] | {c[-1]:6.3f}")
print("\n# sanity: official-equal composite vs published Confidence, max abs diff =",
      f"{np.nanmax(np.abs(comp(W['i official equal (9)'])-M['Confidence'])):.4f}")
pickle.dump({k:{m:w[m] for m in METRICS} for k,w in W.items()},open(cache('w.pkl'),'wb'))
