from core import *
import numpy as np
today=dates[-1]
def last(k): return slice(n-k,n)
S90,S365,S730,S1461=last(90),last(365),last(730),last(1461)

print(f"{'metric':12s} {'nullS90':>8s} {'nullS365':>9s} {'flat365':>8s} {'tailNull':>8s} {'max4y':>6s} {'ATmaxTop':>8s} {'collapse':>8s} {'2yMean':>7s} {'allMean':>7s} {'drift':>7s} {'corr2y':>7s} {'corrAll':>7s} {'dCorr':>7s} {'d>0.8':>6s} {'d<0.2':>6s} {'today':>6s}")
res={}
C=M['Confidence']
for m in METRICS:
    f=M[m]
    n90=np.isnan(f[S90]).mean(); n365=np.isnan(f[S365]).mean()
    d=np.diff(f[S365]); flat=np.mean(np.abs(d)<1e-9) if len(d) else np.nan
    tail=0
    for x in f[::-1]:
        if np.isnan(x): tail+=1
        else: break
    max4y=np.nanmax(f[S1461]); 
    topmax=np.nanmean([np.nanmax(w30(i,f)) for i in TOPS])
    collapse=max4y/topmax
    m2=np.nanmean(f[S730]); ma=np.nanmean(f); drift=m2-ma
    def cc(sl):
        a,b=f[sl],C[sl]; ok=np.isfinite(a)&np.isfinite(b)
        return np.corrcoef(a[ok],b[ok])[0,1] if ok.sum()>30 else np.nan
    c2,ca=cc(S730),cc(slice(0,n))
    idx8=np.where(f>0.8)[0]; idx2=np.where(f<0.2)[0]
    d8=(n-1-idx8[-1]) if len(idx8) else 99999
    d2=(n-1-idx2[-1]) if len(idx2) else 99999
    tv=f[-1] if np.isfinite(f[-1]) else np.nan
    res[m]=dict(n90=n90,n365=n365,flat=flat,tail=tail,max4y=max4y,topmax=topmax,collapse=collapse,m2=m2,ma=ma,drift=drift,c2=c2,ca=ca,dc=c2-ca,d8=d8,d2=d2,today=tv)
    print(f"{m:12s} {n90:8.3f} {n365:9.3f} {flat:8.3f} {tail:8d} {max4y:6.2f} {topmax:8.2f} {collapse:8.2f} {m2:7.3f} {ma:7.3f} {drift:+7.3f} {c2:7.3f} {ca:7.3f} {c2-ca:+7.3f} {d8:6d} {d2:6d} {tv:6.2f}" if np.isfinite(tv) else f"{m:12s} {n90:8.3f} {n365:9.3f} {flat:8.3f} {tail:8d} {max4y:6.2f} {topmax:8.2f} {collapse:8.2f} {m2:7.3f} {ma:7.3f} {drift:+7.3f} {c2:7.3f} {ca:7.3f} {c2-ca:+7.3f} {d8:6d} {d2:6d} {'null':>6s}")

print("\n# value at 2025-10 top vs mean of the four 2013-2021 tops (top-range reach, latest cycle)")
i25=[i for i in TOPS if dates[i].year==2025][0]
for m in METRICS:
    f=M[m]; cur=np.nanmax(w30(i25,f)); prior=np.nanmean([np.nanmax(w30(i,f)) for i in TOPS if i!=i25])
    print(f"{m:12s} 2025top30={cur:.2f} prior4={prior:.2f} ratio={cur/prior:.2f}")

print("\n# amplitude: rolling 365d (max-min) now vs historical median of that stat")
for m in METRICS:
    f=M[m]
    rng=np.array([np.nanmax(f[max(0,i-364):i+1])-np.nanmin(f[max(0,i-364):i+1]) if np.isfinite(f[max(0,i-364):i+1]).sum()>100 else np.nan for i in range(364,n)])
    print(f"{m:12s} rng365_now={rng[-1]:.2f} median={np.nanmedian(rng):.2f} ratio={rng[-1]/np.nanmedian(rng):.2f}")
import pickle; pickle.dump(res,open(cache('q3.pkl'),'wb'))
