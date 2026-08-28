import json, os, datetime as dt
import numpy as np

METRICS = ["PiCycle","RUPL","RHODL","Puell","2YMA","Trolololo","MVRV","ReserveRisk","Woobull"]

# Every intermediate this suite writes lands here; the input JSON is fetched to /tmp/cbbi.json.
OUT = "/tmp/cbbi-analysis"
os.makedirs(OUT, exist_ok=True)

def cache(name):
    return os.path.join(OUT, name)

def load(path="/tmp/cbbi.json"):
    raw = json.load(open(path))
    ts = sorted(int(k) for k in raw["Price"])
    dates = np.array([dt.date.fromtimestamp(t) for t in ts])
    price = np.array([raw["Price"][str(t)] for t in ts], dtype=float)
    M = {}
    for m in METRICS + ["Confidence"]:
        d = raw[m]
        M[m] = np.array([ (float(d[str(t)]) if d.get(str(t)) is not None else np.nan) for t in ts ])
    return ts, dates, price, M
