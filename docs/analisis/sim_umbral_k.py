"""Simulación del umbral de k-anonimato para Río Gallegos (DESIGN.md §7.2).

No es código del producto: es el análisis que respalda la decisión de umbrales.
Uso: python3 docs/analisis/sim_umbral_k.py
"""
import random
from collections import defaultdict
def run(N, C, V, s=1.0, trials=300, kr=5, ku=3):
    w=[1/(i+1)**s for i in range(C)]
    res_orig=0; res_users=0
    for _ in range(trials):
        users=defaultdict(set); recs=defaultdict(int)
        for u in range(N):
            # V varies per user: geometric-ish heavy tail, mean V
            v=max(0,int(random.expovariate(1/V)+0.5))
            for c in random.choices(range(C),weights=w,k=v):
                users[c].add(u); recs[c]+=1
        res_orig+=sum(1 for c in range(C) if recs[c]>=kr and len(users[c])>=ku)
        res_users+=sum(1 for c in range(C) if len(users[c])>=ku)
    return res_orig/trials, res_users/trials
print("H3 res8, C=40 celdas, Zipf s=1, V=visitas publicables por usuario en la ventana")
for V in (2,4):
  for N in (10,20,50,100,150,300):
    a,b=run(N,40,V)
    print(f"V={V} N={N:4d}: 5reg/3us={a:5.1f}/40   solo3us={b:5.1f}/40")
print("Zonas por domicilio (opt-in), uniforme, 1 contribuyente = 1, k=5 usuarios")
import math
def uni(N,B,k=5,trials=500):
    t=0
    for _ in range(trials):
        cnt=[0]*B
        for u in range(N): cnt[random.randrange(B)]+=1
        t+=sum(1 for x in cnt if x>=k)
    return t/trials
for B in (40,10):
  for N in (20,50,100,200,400):
    print(f"B={B} N={N}: {uni(N,B):.1f}/{B}")
