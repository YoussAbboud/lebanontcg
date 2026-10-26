import json, numpy as np, librosa
d=json.load(open("beat_data.json")); T=0.48385; t0=9.4519
y, sr = librosa.load("../public/audio/bgm.mp3", sr=None, mono=True)
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
for tb in range(-20, 24):
    a=t0+tb*T; m=(rt>=a)&(rt<a+T)
    k = d['kick_at_beat'][tb] if tb>=0 else None
    print(tb, round(a,3), round(float(np.mean(rms[m])),3), k)
