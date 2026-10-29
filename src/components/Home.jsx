import React, { useEffect, useRef } from 'react';
import '../assets/style/Home.css';

// Seeded random number generator (equivalent to numpy default_rng(11))
class SeededRNG {
  constructor(seed = 11) {
    this.s = seed;
  }
  next() {
    this.s = (this.s * 9301 + 49297) % 233280;
    return this.s / 233280;
  }
  random(n = 1) {
    return this.next() * n;
  }
  uniform(min, max, count) {
    if (count === undefined) return min + this.next() * (max - min);
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = min + this.next() * (max - min);
    }
    return arr;
  }
  normal(mean = 0, std = 1, count) {
    if (count === undefined) {
      // Box-Muller transform
      const u1 = Math.max(1e-7, this.next());
      const u2 = this.next();
      return mean + std * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u1 = Math.max(1e-7, this.next());
      const u2 = this.next();
      arr[i] = mean + std * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
    return arr;
  }
}

export default function Home() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = 720;
    const H = 1280;
    canvas.width = W;
    canvas.height = H;

    const T_STEM = 4.0;
    const T_B0 = 5.0;
    const T_B1 = 15.0;
    const LOOP_DURATION = 19.5; // Loops smoothly after full bloom showcase
    const BG = [4, 2, 10];
    const S = W / 720.0;

    const rng = new SeededRNG(11);
    const gx = W / 2;
    const gy = H * 0.82;
    const HS = 380 * S;

    function smooth(x) {
      const clamped = Math.max(0, Math.min(1, x));
      return clamped * clamped * (3 - 2 * clamped);
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    // Midrib generator
    function midrib(L, a0, curl, K = 40) {
      const us = new Float32Array(K + 1);
      const al = new Float32Array(K + 1);
      const r = new Float32Array(K + 1);
      const h = new Float32Array(K + 1);

      for (let i = 0; i <= K; i++) {
        const u = i / K;
        us[i] = u;
        al[i] = a0 + curl * Math.pow(u, 1.6);
      }

      const ds = L / K;
      r[0] = 0;
      h[0] = 0;
      for (let i = 1; i <= K; i++) {
        r[i] = r[i - 1] + Math.sin(al[i]) * ds;
        h[i] = h[i - 1] + Math.cos(al[i]) * ds;
      }
      return { us, r, h };
    }

    // Pre-calculate geometry data
    const NP = 2300;
    const petalsData = [];
    for (let k = 0; k < 6; k++) {
      const outer = (k % 2 === 0);
      const pu = new Float32Array(NP);
      const pv = new Float32Array(NP);
      const prof = new Float32Array(NP);
      const keep = new Uint8Array(NP);
      const baseR = new Float32Array(NP);
      const baseG = new Float32Array(NP);
      const baseB = new Float32Array(NP);

      for (let i = 0; i < NP; i++) {
        pu[i] = Math.pow(rng.random(1), 0.85);
        pv[i] = rng.uniform(-1, 1);
        prof[i] = Math.pow(Math.sin(Math.PI * Math.pow(pu[i], 0.7)), 0.9);
        keep[i] = Math.abs(pv[i]) <= 1 ? 1 : 0;

        // Stops interpolation [0, .35, .7, 1]
        let p = pu[i];
        let r_v, g_v, b_v;
        if (p <= 0.35) {
          const t = p / 0.35;
          r_v = lerp(205, 255, t);
          g_v = lerp(40, 95, t);
          b_v = lerp(125, 165, t);
        } else if (p <= 0.7) {
          const t = (p - 0.35) / 0.35;
          r_v = lerp(255, 255, t);
          g_v = lerp(95, 150, t);
          b_v = lerp(165, 205, t);
        } else {
          const t = (p - 0.7) / 0.3;
          r_v = lerp(255, 255, t);
          g_v = lerp(150, 195, t);
          b_v = lerp(205, 228, t);
        }

        const mid = (Math.abs(pv[i]) < 0.07) && (p < 0.55);
        if (mid) {
          r_v = 235; g_v = 225; b_v = 150;
        }

        const spot = (rng.random(1) < 0.10) && (p < 0.6) && (Math.abs(pv[i]) < 0.75) && !mid;
        if (spot) {
          r_v = 140; g_v = 15; b_v = 80;
        }

        const edge = Math.abs(pv[i]) > 0.88;
        if (edge) {
          r_v *= 1.08; g_v *= 1.08; b_v *= 1.08;
        }

        const randFactor = 0.82 + 0.35 * rng.random(1);
        baseR[i] = r_v * randFactor;
        baseG[i] = g_v * randFactor;
        baseB[i] = b_v * randFactor;
      }

      petalsData.push({
        phi: (k * 60 + 8) * (Math.PI / 180),
        L: (outer ? 300 : 280) * S,
        Wm: (outer ? 64 : 72) * S,
        ac: outer ? 0.10 : 0.05,
        ao: outer ? 1.05 : 0.82,
        curl: outer ? 0.95 : 0.75,
        pu, pv, prof, keep, baseR, baseG, baseB
      });
    }

    const NS = 3200;
    const st_s = rng.uniform(0, 1, NS);
    const st_dx = new Float32Array(NS);
    const st_colR = new Float32Array(NS);
    const st_colG = new Float32Array(NS);
    const st_colB = new Float32Array(NS);
    const normalArr = rng.normal(0, 1, NS);

    for (let i = 0; i < NS; i++) {
      st_dx[i] = normalArr[i] * (3.2 * S) * (1 - 0.5 * st_s[i]);
      const rf = 0.8 + 0.4 * rng.random(1);
      st_colR[i] = lerp(40, 120, st_s[i]) * rf;
      st_colG[i] = lerp(150, 215, st_s[i]) * rf;
      st_colB[i] = lerp(95, 120, st_s[i]) * rf;
    }

    const leavesConfigs = [
      { s0: 0.10, Lf: 190, side: 1 },
      { s0: 0.24, Lf: 175, side: -1 },
      { s0: 0.40, Lf: 150, side: 1 },
      { s0: 0.56, Lf: 120, side: -1 }
    ];

    const leavesData = leavesConfigs.map(cfg => {
      const n = 900;
      const u = new Float32Array(n);
      const v = new Float32Array(n);
      const prof = new Float32Array(n);
      const colR = new Float32Array(n);
      const colG = new Float32Array(n);
      const colB = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        u[i] = Math.pow(rng.random(1), 0.9);
        v[i] = rng.uniform(-1, 1);
        prof[i] = Math.pow(Math.sin(Math.PI * Math.pow(u[i], 0.8)), 0.8);

        let r_v = lerp(40, 140, u[i]);
        let g_v = lerp(160, 235, u[i]);
        let b_v = lerp(100, 140, u[i]);

        if (Math.abs(v[i]) < 0.08) {
          r_v = 190; g_v = 240; b_v = 170;
        }
        const rf = 0.8 + 0.4 * rng.random(1);
        colR[i] = r_v * rf;
        colG[i] = g_v * rf;
        colB[i] = b_v * rf;
      }
      return { ...cfg, L: cfg.Lf * S, u, v, prof, colR, colG, colB };
    });

    const NG = 5000;
    const so_dx = new Float32Array(NG);
    const so_y = new Float32Array(NG);
    const so_colR = new Float32Array(NG);
    const so_colG = new Float32Array(NG);
    const so_colB = new Float32Array(NG);

    for (let i = 0; i < NG; i++) {
      so_dx[i] = rng.uniform(-340, 340) * S;
      const mound = (1 - Math.pow(so_dx[i] / (340 * S), 2)) * 55 * S;
      so_y[i] = gy - mound * Math.sqrt(rng.random(1)) + rng.normal(0, 1.5);
      const rf = 0.8 * 0.8;
      so_colR[i] = lerp(70, 140, rng.random(1)) * rf;
      so_colG[i] = lerp(55, 100, rng.random(1)) * rf;
      so_colB[i] = lerp(80, 120, rng.random(1)) * rf;
    }

    const ND = 450;
    const d_x = rng.uniform(0, W, ND);
    const d_y = rng.uniform(0, H, ND);
    const d_sp = rng.uniform(6, 22, ND) * S;
    const d_ph = rng.uniform(0, 6.28, ND);
    const d_f = rng.uniform(1, 4, ND);

    const ang_ring = rng.uniform(0, 6.28, 1100);
    const ang_c = Array.from({ length: 6 }, () => rng.uniform(0, 6.28, 260));

    const NF = 140;
    const f_off = rng.uniform(0, 1, NF);
    const f_ph = rng.uniform(0, 6.28, NF);
    const f_dr = rng.uniform(-80, 80, NF) * S;
    const f_sp = rng.uniform(0.05, 0.12, NF);

    const stam = Array.from({ length: 6 }, (_, k) => ({
      phi: (k * 60 + 38) * (Math.PI / 180),
      an: Array.from({ length: 35 }, () => [rng.normal(0, 1), rng.normal(0, 1)])
    }));

    function stem_x(s, t) {
      const sway = 10 * S * Math.sin(0.9 * t);
      return gx + 30 * S * Math.sin(2.2 * s) + sway * s * s;
    }

    function stem_y(s) {
      return gy - s * HS;
    }

    // Helper to interpolate array values
    function interpArray(uArr, us, vals) {
      const out = new Float32Array(uArr.length);
      const K = us.length - 1;
      for (let i = 0; i < uArr.length; i++) {
        const u = uArr[i];
        const idxFloat = u * K;
        let idx = Math.floor(idxFloat);
        if (idx >= K) idx = K - 1;
        if (idx < 0) idx = 0;
        const t = idxFloat - idx;
        out[i] = vals[idx] + (vals[idx + 1] - vals[idx]) * t;
      }
      return out;
    }

    let lastTime = performance.now();

    const renderFrame = (currentTime) => {
      const dt = (currentTime - lastTime) / 1000.0;
      timeRef.current += Math.min(dt, 0.1);
      if (timeRef.current >= LOOP_DURATION) {
        timeRef.current = 0.0;
      }
      lastTime = currentTime;
      const t = timeRef.current;

      // Render Pipeline
      const points = []; // Array of {x, y, z, r, g, b}

      const addPoints = (xs, ys, zVal, rArr, gArr, bArr) => {
        const len = xs.length;
        for (let i = 0; i < len; i++) {
          points.push({
            x: xs[i],
            y: ys[i],
            z: zVal,
            r: rArr[i],
            g: gArr[i],
            b: bArr[i]
          });
        }
      };

      const addUniformPoints = (xs, ys, zVal, r, g, b) => {
        const len = xs.length;
        for (let i = 0; i < len; i++) {
          points.push({ x: xs[i], y: ys[i], z: zVal, r, g, b });
        }
      };

      const g = smooth(t / T_STEM);
      const e = smooth((t - T_B0) / (T_B1 - T_B0));
      const rev = smooth((t - T_STEM + 0.3) / 1.6);

      const hx = stem_x(1.0, t);
      const hy = stem_y(1.0);

      // Dust / falling sparks
      const twArr = new Float32Array(ND);
      const yyArr = new Float32Array(ND);
      const dR = new Float32Array(ND);
      const dG = new Float32Array(ND);
      const dB = new Float32Array(ND);
      for (let i = 0; i < ND; i++) {
        const tw = 0.35 + 0.65 * (Math.sin(t * d_f[i] + d_ph[i]) > 0.2 ? 1 : 0);
        twArr[i] = tw;
        yyArr[i] = (d_y[i] - t * d_sp[i]) % H;
        if (yyArr[i] < 0) yyArr[i] += H;
        dR[i] = 255 * tw * 0.55;
        dG[i] = 200 * tw * 0.55;
        dB[i] = 235 * tw * 0.55;
      }
      addPoints(d_x, yyArr, -1000, dR, dG, dB);

      // Ambient background ring
      const ha = smooth((t - T_B0 + 1.5) / 4.0) * 0.9;
      if (ha > 0.01) {
        const cx0 = hx;
        const cy0 = hy - 90 * S;
        const R = 300 * S;
        const rot = t * 0.12;
        const ringLen = ang_ring.length;
        const rx = new Float32Array(ringLen);
        const ry = new Float32Array(ringLen);
        for (let i = 0; i < ringLen; i++) {
          const a = ang_ring[i] + rot;
          rx[i] = cx0 + R * Math.cos(a);
          ry[i] = cy0 + R * Math.sin(a);
        }
        addUniformPoints(rx, ry, -900, 255 * ha * 0.7, 190 * ha * 0.7, 225 * ha * 0.7);

        ang_c.forEach((acArr, k) => {
          const ca = rot * 1.3 + k * (Math.PI / 3);
          const ox = cx0 + R * Math.cos(ca);
          const oy = cy0 + R * Math.sin(ca);
          const cLen = acArr.length;
          const cX = new Float32Array(cLen);
          const cY = new Float32Array(cLen);
          for (let i = 0; i < cLen; i++) {
            const a = acArr[i] + rot;
            cX[i] = ox + R * 0.5 * Math.cos(a);
            cY[i] = oy + R * 0.5 * Math.sin(a);
          }
          addUniformPoints(cX, cY, -900, 255 * ha * 0.45, 170 * ha * 0.45, 215 * ha * 0.45);
        });
      }

      // Soil mound
      const soX = new Float32Array(NG);
      for (let i = 0; i < NG; i++) soX[i] = so_dx[i] + gx;
      addPoints(soX, so_y, -500, so_colR, so_colG, so_colB);

      // Stem growth
      const mIdxs = [];
      for (let i = 0; i < NS; i++) {
        if (st_s[i] <= g) mIdxs.push(i);
      }
      if (mIdxs.length > 0) {
        const sX = new Float32Array(mIdxs.length);
        const sY = new Float32Array(mIdxs.length);
        const sR = new Float32Array(mIdxs.length);
        const sG = new Float32Array(mIdxs.length);
        const sB = new Float32Array(mIdxs.length);
        for (let i = 0; i < mIdxs.length; i++) {
          const idx = mIdxs[i];
          const s = st_s[idx];
          sX[i] = stem_x(s, t) + st_dx[idx];
          sY[i] = stem_y(s);
          sR[i] = st_colR[idx];
          sG[i] = st_colG[idx];
          sB[i] = st_colB[idx];
        }
        addPoints(sX, sY, -100, sR, sG, sB);
      }

      // Leaves
      leavesData.forEach(lf => {
        const lg = Math.max(0, Math.min(1, (g - lf.s0) * 2.5));
        if (lg <= 0.01) return;
        const L = lf.L * lg;
        const { us, r, h } = midrib(L, 0.85, 1.1);
        const rr = interpArray(lf.u, us, r);
        const hh = interpArray(lf.u, us, h);
        const nLen = lf.u.length;
        const lX = new Float32Array(nLen);
        const lY = new Float32Array(nLen);
        const bx = stem_x(lf.s0, t);
        const by = stem_y(lf.s0);
        const sway = Math.sin(t * 1.2 + lf.s0 * 5) * 0.03;

        for (let i = 0; i < nLen; i++) {
          const wid = 15 * S * lf.prof[i] * lg;
          lX[i] = bx + lf.side * (rr[i] + lf.v[i] * wid * 0.35) + sway * hh[i] * lf.side;
          lY[i] = by - hh[i] + lf.v[i] * wid;
        }
        addPoints(lX, lY, -90, lf.colR, lf.colG, lf.colB);
      });

      // Petals
      if (rev > 0.01) {
        const psi = 0.25 + t * 0.22;
        const tau = 0.5;
        const cp = Math.cos(psi), sp = Math.sin(psi);
        const ct = Math.cos(tau), st = Math.sin(tau);
        const sway_t = Math.sin(t * 0.8) * 0.02;

        petalsData.forEach(p => {
          const Ls = p.L * (0.45 + 0.55 * e) * (0.35 + 0.65 * rev);
          const a0 = lerp(p.ac, p.ao, e);
          const curl = (0.12 + 0.88 * e) * p.curl;
          const { us, r, h } = midrib(Ls, a0, curl);

          // Filter keep & pu <= rev
          const activeIdxs = [];
          for (let i = 0; i < NP; i++) {
            if (p.pu[i] <= rev && p.keep[i]) activeIdxs.push(i);
          }
          const activeLen = activeIdxs.length;
          if (activeLen === 0) return;

          const subU = new Float32Array(activeLen);
          const subV = new Float32Array(activeLen);
          const subProf = new Float32Array(activeLen);
          const subBaseR = new Float32Array(activeLen);
          const subBaseG = new Float32Array(activeLen);
          const subBaseB = new Float32Array(activeLen);

          for (let i = 0; i < activeLen; i++) {
            const idx = activeIdxs[i];
            subU[i] = p.pu[idx];
            subV[i] = p.pv[idx];
            subProf[i] = p.prof[idx];
            subBaseR[i] = p.baseR[idx];
            subBaseG[i] = p.baseG[idx];
            subBaseB[i] = p.baseB[idx];
          }

          const rr = interpArray(subU, us, r);
          const hh = interpArray(subU, us, h);
          const ph = p.phi;
          const cosPh = Math.cos(ph), sinPh = Math.sin(ph);

          const finalX = new Float32Array(activeLen);
          const finalY = new Float32Array(activeLen);
          const finalZ = new Float32Array(activeLen);
          const finalR = new Float32Array(activeLen);
          const finalG = new Float32Array(activeLen);
          const finalB = new Float32Array(activeLen);

          for (let i = 0; i < activeLen; i++) {
            const wid = p.Wm * (0.55 + 0.45 * e) * subProf[i] * (0.35 + 0.65 * rev);
            const X = rr[i] * cosPh - subV[i] * wid * sinPh;
            const Z = rr[i] * sinPh + subV[i] * wid * cosPh;
            const Y = hh[i] + (subV[i] * subV[i]) * wid * (0.30 * (1 - e) - 0.25 * e);

            const Xp = X * cp + Z * sp;
            const Zp = -X * sp + Z * cp;
            const sy = Y * ct - Zp * st;

            const shade = 0.55 + 0.45 * Math.max(0, Math.min(1, Zp / p.L * 0.8 + 0.5));
            const tint = (1 - e) * Math.max(0, Math.min(1, subU[i] * 1.3)) * 0.6;

            let cr = subBaseR[i] * (1 - tint) + 135 * tint;
            let cg = subBaseG[i] * (1 - tint) + 205 * tint;
            let cb = subBaseB[i] * (1 - tint) + 125 * tint;

            finalX[i] = hx + Xp + sway_t * sy;
            finalY[i] = hy - sy;
            finalZ[i] = Zp;
            finalR[i] = cr * shade;
            finalG[i] = cg * shade;
            finalB[i] = cb * shade;
          }

          for (let i = 0; i < activeLen; i++) {
            points.push({
              x: finalX[i],
              y: finalY[i],
              z: finalZ[i],
              r: finalR[i],
              g: finalG[i],
              b: finalB[i]
            });
          }
        });

        // Stamens
        if (e > 0.28) {
          const sr = smooth((e - 0.28) / 0.4);
          stam.forEach(sdat => {
            const Ls = 215 * S * (0.4 + 0.6 * e) * sr;
            const { us, r, h } = midrib(Ls, lerp(0.15, 0.62, e), 0.55 * e);
            const sU = new Float32Array(45);
            for (let i = 0; i < 45; i++) sU[i] = rng.random(1);
            const rr = interpArray(sU, us, r);
            const hh = interpArray(sU, us, h);
            const ph = sdat.phi;
            const cosPh = Math.cos(ph), sinPh = Math.sin(ph);

            const sX = new Float32Array(45);
            const sY = new Float32Array(45);
            const sZ = new Float32Array(45);
            for (let i = 0; i < 45; i++) {
              const X = rr[i] * cosPh;
              const Z = rr[i] * sinPh;
              const Y = hh[i];
              const Xp = X * cp + Z * sp;
              const Zp = -X * sp + Z * cp;
              const sy = Y * ct - Zp * st;
              sX[i] = hx + Xp;
              sY[i] = hy - sy;
              sZ[i] = Zp + 5;
            }
            addUniformPoints(sX, sY, 5, 245, 235, 200);

            // Anthers
            const tx = r[r.length - 1] * cosPh;
            const tz = r[r.length - 1] * sinPh;
            const ty = h[h.length - 1];
            const txp = tx * cp + tz * sp;
            const tzp = -tx * sp + tz * cp;
            const tsy = ty * ct - tzp * st;

            const aX = new Float32Array(35);
            const aY = new Float32Array(35);
            const aZ = new Float32Array(35);
            const aR = new Float32Array(35);
            const aG = new Float32Array(35);
            const aB = new Float32Array(35);
            for (let i = 0; i < 35; i++) {
              const anX = sdat.an[i][0] * 5 * S;
              const anY = sdat.an[i][1] * 5 * S;
              aX[i] = hx + txp + anX * 1.6;
              aY[i] = hy - tsy + anY * 0.7;
              aZ[i] = tzp + 6;
              const rf = 0.8 + 0.4 * rng.random(1);
              aR[i] = 255 * rf;
              aG[i] = 150 * rf;
              aB[i] = 40 * rf;
            }
            addPoints(aX, aY, 6, aR, aG, aB);
          });
        }
      }

      // Floating pollen / sparks
      if (e > 0.6) {
        const fa = smooth((e - 0.6) / 0.4);
        const pX = new Float32Array(NF);
        const pY = new Float32Array(NF);
        const pR = new Float32Array(NF);
        const pG = new Float32Array(NF);
        const pB = new Float32Array(NF);

        for (let i = 0; i < NF; i++) {
          const q = (t * f_sp[i] + f_off[i]) % 1.0;
          const fx = hx + f_dr[i] * q + Math.sin(q * 7 + f_ph[i]) * 25 * S;
          const fy = (hy - 110 * S) + q * (gy - hy + 90 * S);
          const fade = (1 - q) * fa;
          const isYellow = f_ph[i] > 3.1;
          pX[i] = fx;
          pY[i] = fy;
          pR[i] = (isYellow ? 255 : 255) * fade;
          pG[i] = (isYellow ? 190 : 150) * fade;
          pB[i] = (isYellow ? 80 : 205) * fade;
        }
        addPoints(pX, pY, 300, pR, pG, pB);
      }

      // Sort points by Z (Painter's algorithm)
      points.sort((a, b) => a.z - b.z);

      // Draw to canvas buffer
      ctx.fillStyle = `rgb(${BG[0]}, ${BG[1]}, ${BG[2]})`;
      ctx.fillRect(0, 0, W, H);

      // Draw pointillism pixels/blobs
      const imgData = ctx.createImageData(W, H);
      const data = imgData.data;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const ix = Math.floor(p.x);
        const iy = Math.floor(p.y);

        if (ix >= 0 && ix < W - 2 && iy >= 0 && iy < H - 2) {
          const r = Math.max(0, Math.min(255, p.r));
          const g = Math.max(0, Math.min(255, p.g));
          const b = Math.max(0, Math.min(255, p.b));

          // Draw pixel + 2 neighbor pixels for richer pointillist brush texture
          const idx0 = (iy * W + ix) * 4;
          data[idx0] = r; data[idx0 + 1] = g; data[idx0 + 2] = b; data[idx0 + 3] = 255;

          const idx1 = (iy * W + (ix + 1)) * 4;
          data[idx1] = r; data[idx1 + 1] = g; data[idx1 + 2] = b; data[idx1 + 3] = 255;

          const idx2 = ((iy + 1) * W + ix) * 4;
          data[idx2] = r; data[idx2 + 1] = g; data[idx2 + 2] = b; data[idx2 + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Glow / Bloom effect via additive blending of downscaled copy
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(16px)';
      ctx.drawImage(canvas, 0, 0, W, H);
      ctx.restore();

      animRef.current = requestAnimationFrame(renderFrame);
    };

    animRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className="lily-container">
      <header className="lily-header">
        <h1 className="lily-title">Pointillism Lily</h1>
        <p className="lily-subtitle">Procedural React Animation & Bloom Simulation</p>
      </header>

      {/* Responsive Canvas Container */}
      <div className="lily-canvas-container">
        <canvas
          ref={canvasRef}
          className="lily-canvas"
        />
      </div>
    </div>
  );
}

