import json, numpy as np, librosa
d = json.load(open("beat_data.json"))
y, sr = librosa.load("../public/audio/bgm.mp3", sr=None, mono=True)
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
print("rms per second 0-20:", [round(float(np.mean(rms[(rt>=s)&(rt<s+1)])),3) for s in range(0,20)])
b = np.array(d["beats"]); on = np.array(d["onsets"])
print("first beats:", np.round(b[:12],3).tolist())
print("first kick onsets:", np.round(on[:20],3).tolist())
for lo, hi in ((0,60),(9,60)):
    w = b[(b>=lo)&(b<hi)]; i=np.arange(len(w)); A=np.vstack([i,np.ones_like(i)]).T
    (T,t0),*_=np.linalg.lstsq(A,w,rcond=None); r=w-(t0+i*T)
    grid=t0+np.arange(len(w))*T
    dd=np.array([np.min(np.abs(on-g)) for g in grid]); m=dd<0.035
    print(f"window {lo}-{hi}: BPM={60/T:.3f} t0={t0:.4f} maxres={np.abs(r).max()*1000:.1f}ms match={m.mean():.3f} mae={dd[m].mean()*1000:.1f}ms")
