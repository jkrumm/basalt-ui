import json, datetime as dt
import numpy as np

METRICS = ["PiCycle","RUPL","RHODL","Puell","2YMA","Trolololo","MVRV","ReserveRisk","Woobull"]

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
