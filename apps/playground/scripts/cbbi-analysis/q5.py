from core import *
import numpy as np
C=M['Confidence']
def fwd(k):
    r=np.full(n,np.nan)
    r[:n-k]=price[k:]/price[:n-k]-1
    return r
F90,F180,F365=fwd(90),fwd(180),fwd(365)
def episodes(mask):
    eps=[];cur=None
    for i,b in enumerate(mask):
        if b and cur is None: cur=i
        if not b and cur is not None: eps.append((cur,i-1)); cur=None
    if cur is not None: eps.append((cur,n-1))
    return eps
def rep(name,mask,exclude_today=True):
    m=mask.copy()
    ev=m & np.isfinite(F90)
    eps=episodes(m)
    def q(f):
        v=f[m & np.isfinite(f)]
        return (len(v),np.median(v)*100,np.mean(v>0)*100) if len(v) else (0,float('nan'),float('nan'))
    n90,md90,p90=q(F90); n180,md180,p180=q(F180); n365,md365,p365=q(F365)
    print(f"{name}")
    print(f"   days={m.sum():4d}  episodes={len(eps):2d}  {[f'{dates[a]}..{dates[b]}' for a,b in eps]}")
    print(f"   fwd90:  n={n90:4d} median={md90:+7.1f}% pos={p90:5.1f}%   fwd180: n={n180:4d} median={md180:+7.1f}% pos={p180:5.1f}%   fwd365: n={n365:4d} median={md365:+7.1f}% pos={p365:5.1f}%")
base=np.isfinite(F90)
print("BASE RATE (all days)")
print(f"   fwd90 median={np.nanmedian(F90)*100:+.1f}% pos={np.nanmean(F90[np.isfinite(F90)]>0)*100:.1f}% | fwd180 median={np.nanmedian(F180)*100:+.1f}% pos={np.nanmean(F180[np.isfinite(F180)]>0)*100:.1f}% | fwd365 median={np.nanmedian(F365)*100:+.1f}% pos={np.nanmean(F365[np.isfinite(F365)]>0)*100:.1f}%\n")
rep("A) Puell>=0.90 AND Confidence<=0.50   (today: Puell 0.93, Conf 0.41)", (M['Puell']>=0.90)&(C<=0.50))
rep("B) Puell>=0.90 (any regime)", M['Puell']>=0.90)
rep("C) MVRV<=0.15 AND Confidence in [0.35,0.50]  (today: MVRV 0.13, Conf 0.41)", (M['MVRV']<=0.15)&(C>=0.35)&(C<=0.50))
rep("D) MVRV<=0.15 (any regime)", M['MVRV']<=0.15)
rep("E) Puell-MVRV spread >=0.70  (today 0.80)", (M['Puell']-M['MVRV'])>=0.70)
rep("F) Confidence in [0.35,0.45]  (today 0.408)", (C>=0.35)&(C<=0.45))
rep("G) Conf in [0.35,0.45] AND falling (Conf 90d ago higher by >=0.15)", (C>=0.35)&(C<=0.45)&(np.concatenate([np.full(90,np.nan),C[:-90]])-C>=0.15))
rep("H) ReserveRisk<=0.20 AND MVRV<=0.15 (today 0.19 / 0.13)", (M['ReserveRisk']<=0.20)&(M['MVRV']<=0.15))
i25=[i for i in TOPS if dates[i].year==2025][0]
dd=price/np.maximum.accumulate(price)-1
print(f"\n# drawdown context: ATH={price[:i25+1].max():.0f} on {dates[i25]}, today={price[-1]:.0f}, dd={dd[-1]*100:.1f}%, days since top={ (dates[-1]-dates[i25]).days }")
print("# historical: drawdown at each cycle bottom and days from top to bottom")
for b in BOTS:
    pr=[t for t in TOPS if t<b]
    if pr: print(f"   {dates[b]} dd={dd[b]*100:6.1f}%  days_from_top={(dates[b]-dates[pr[-1]]).days:4d}  Conf@bottom={C[b]:.2f}")
print(f"\n# how often has Confidence been <=0.41 this far (>=300d) after a cycle top? and fwd returns")
m=np.zeros(n,bool)
for i in range(n):
    pr=[t for t in TOPS if t<i]
    if pr and (dates[i]-dates[pr[-1]]).days>=300 and C[i]<=0.45: m[i]=True
rep("I) >=300d past a cycle top AND Conf<=0.45", m)
