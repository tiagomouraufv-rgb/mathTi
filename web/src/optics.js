/* Folha de Cálculo — biblioteca de óptica
   Feixe gaussiano, modos LG/HG/Bessel, óptica de Fourier, Jones/Stokes, pinças (Rayleigh) e Richards–Wolf.
   Convenção de tempo: exp(-iωt), ondas planas exp(+i k·r) (como em Novotny & Hecht). */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;
  // grandezas com unidade entram em SI (m, W, ...); os resultados saem em SI
  const num = (v) => (M.isUnit(v) ? (v.value == null ? 1 : v.value) : FC.num(v));
  const C0 = 299792458, EPS0 = 8.8541878128e-12;
  const cx = (re, im) => M.complex(re, im || 0);
  const re = (v) => (M.isComplex(v) ? v.re : num(v));
  const im = (v) => (M.isComplex(v) ? v.im : 0);
  const optN = (v, d) => (v === undefined || v === null ? d : num(v));

  /* ================= Feixe gaussiano (paraxial) ================= */
  const zR = (w0, lam, n) => (Math.PI * num(w0) ** 2 * optN(n, 1)) / num(lam);
  function wz(z, w0, lam, n) { const r = zR(w0, lam, n); return num(w0) * Math.sqrt(1 + (num(z) / r) ** 2); }
  function Rz(z, w0, lam, n) { z = num(z); if (z === 0) return Infinity; const r = zR(w0, lam, n); return z * (1 + (r / z) ** 2); }
  function gouy(z, w0, lam, n) { return Math.atan(num(z) / zR(w0, lam, n)); }
  function Egauss(rho, z, w0, lam, n) {
    rho = num(rho); z = num(z); w0 = num(w0); lam = num(lam); n = optN(n, 1);
    const k = (2 * Math.PI * n) / lam, w = wz(z, w0, lam, n), R = Rz(z, w0, lam, n), eta = gouy(z, w0, lam, n);
    const amp = (w0 / w) * Math.exp(-(rho * rho) / (w * w));
    const ph = k * z - eta + (isFinite(R) ? (k * rho * rho) / (2 * R) : 0);
    return cx(amp * Math.cos(ph), amp * Math.sin(ph));
  }
  function Igauss(rho, z, w0, lam, n) { const w = wz(z, w0, lam, n); return (num(w0) / w) ** 2 * Math.exp((-2 * num(rho) ** 2) / (w * w)); }
  // intensidade com potência P (W/m² se as distâncias estiverem em m)
  function Ifeixe(rho, z, w0, lam, P, n) { const w = wz(z, w0, lam, n); return ((2 * num(P)) / (Math.PI * w * w)) * Math.exp((-2 * num(rho) ** 2) / (w * w)); }

  /* ================= Modos ================= */
  const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
  function genLag(p, a, x) { let L0 = 1; if (p === 0) return L0; let L1 = 1 + a - x; for (let k = 1; k < p; k++) { const L2 = ((2 * k + 1 + a - x) * L1 - (k + a) * L0) / (k + 1); L0 = L1; L1 = L2; } return L1; }
  function herm(nn, x) { let a = 1; if (nn === 0) return a; let b = 2 * x; for (let k = 1; k < nn; k++) { const c = 2 * x * b - 2 * k * a; a = b; b = c; } return b; }
  // LG_p^l normalizado: ∫|u|² dA = 1
  function LG(p, l, rho, phi, z, w0, lam, n) {
    p = Math.round(num(p)); l = Math.round(num(l)); rho = num(rho); phi = num(phi); z = num(z); w0 = num(w0); lam = num(lam); n = optN(n, 1);
    const al = Math.abs(l), k = (2 * Math.PI * n) / lam, w = wz(z, w0, lam, n), R = Rz(z, w0, lam, n), eta = gouy(z, w0, lam, n);
    const Cn = Math.sqrt((2 * fact(p)) / (Math.PI * fact(p + al)));
    const s = (Math.SQRT2 * rho) / w;
    const amp = (Cn / w) * s ** al * genLag(p, al, s * s) * Math.exp(-(rho * rho) / (w * w));
    const ph = l * phi + k * z + (isFinite(R) ? (k * rho * rho) / (2 * R) : 0) - (2 * p + al + 1) * eta;
    return cx(amp * Math.cos(ph), amp * Math.sin(ph));
  }
  function HG(m, nn, x, y, z, w0, lam, n) {
    m = Math.round(num(m)); nn = Math.round(num(nn)); x = num(x); y = num(y); z = num(z); w0 = num(w0); lam = num(lam); n = optN(n, 1);
    const k = (2 * Math.PI * n) / lam, w = wz(z, w0, lam, n), R = Rz(z, w0, lam, n), eta = gouy(z, w0, lam, n), r2 = x * x + y * y;
    const Cn = Math.sqrt(2 / (Math.PI * 2 ** (m + nn) * fact(m) * fact(nn)));
    const amp = (Cn / w) * herm(m, (Math.SQRT2 * x) / w) * herm(nn, (Math.SQRT2 * y) / w) * Math.exp(-r2 / (w * w));
    const ph = k * z + (isFinite(R) ? (k * r2) / (2 * R) : 0) - (m + nn + 1) * eta;
    return cx(amp * Math.cos(ph), amp * Math.sin(ph));
  }
  // feixe de Bessel ideal: J_l(k sinθ ρ) e^{ilφ} e^{i k cosθ z}
  function besselBeam(l, rho, phi, z, theta, lam, n) {
    l = Math.round(num(l)); const k = (2 * Math.PI * optN(n, 1)) / num(lam), th = num(theta);
    const J = besselSet(Math.abs(l), k * Math.sin(th) * num(rho));
    let a = J[Math.abs(l)]; if (l < 0 && Math.abs(l) % 2) a = -a;
    const ph = l * num(phi) + k * Math.cos(th) * num(z);
    return cx(a * Math.cos(ph), a * Math.sin(ph));
  }

  /* J_0..J_M(x) por recorrência de Miller (estável) */
  function besselSet(Mx, x) {
    const out = new Float64Array(Mx + 1);
    const ax = Math.abs(x);
    if (ax < 1e-12) { out[0] = 1; return out; }
    const start = 2 * Math.floor((Math.max(Mx, ax) + 15 + Math.sqrt(40 * Math.max(Mx, ax, 1))) / 2);
    let jp = 0, j = 1e-30, sum = 0;
    const tmp = new Float64Array(start + 2);
    for (let k = start; k > 0; k--) {
      const jm = ((2 * k) / ax) * j - jp;
      jp = j; j = jm; tmp[k - 1] = j;
      if (Math.abs(j) > 1e250) { j *= 1e-250; jp *= 1e-250; for (let q = k - 1; q <= start; q++) tmp[q] *= 1e-250; }
    }
    // normalização: J0 + 2 Σ J_{2k} = 1
    sum = tmp[0]; for (let k = 2; k <= start; k += 2) sum += 2 * tmp[k];
    for (let m = 0; m <= Mx; m++) out[m] = tmp[m] / sum;
    if (x < 0) for (let m = 1; m <= Mx; m += 2) out[m] = -out[m];
    return out;
  }
  FC.besselSet = besselSet;

  /* ================= Óptica de Fourier ================= */
  function toRI(U) {
    const a = FC.toArr(U); const R = a.length, C = Array.isArray(a[0]) ? a[0].length : 1;
    const rr = new Float64Array(R * C), ii = new Float64Array(R * C);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const v = C === 1 && !Array.isArray(a[i]) ? a[i] : a[i][j]; rr[i * C + j] = re(v); ii[i * C + j] = im(v); }
    return { re: rr, im: ii, R, C };
  }
  function fromRI(F) {
    const out = [];
    for (let i = 0; i < F.R; i++) { const row = new Array(F.C); for (let j = 0; j < F.C; j++) { const a = F.re[i * F.C + j], b = F.im[i * F.C + j]; row[j] = b === 0 ? a : cx(a, b); } out.push(row); }
    return M.matrix(out);
  }
  function fft1(rr, ii, inv) {
    const n = rr.length;
    if (n <= 1) return;
    if ((n & (n - 1)) === 0) {
      for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = rr[i]; rr[i] = rr[j]; rr[j] = t; t = ii[i]; ii[i] = ii[j]; ii[j] = t; } }
      for (let len = 2; len <= n; len <<= 1) {
        const ang = ((inv ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
          let cr = 1, ci = 0;
          for (let k = 0; k < len / 2; k++) {
            const a = i + k, b = a + len / 2;
            const tr = rr[b] * cr - ii[b] * ci, ti = rr[b] * ci + ii[b] * cr;
            rr[b] = rr[a] - tr; ii[b] = ii[a] - ti; rr[a] += tr; ii[a] += ti;
            const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
          }
        }
      }
      return;
    }
    // Bluestein para tamanhos que não são potência de 2
    let m = 1; while (m < 2 * n - 1) m <<= 1;
    const sg = inv ? 1 : -1;
    const wr = new Float64Array(n), wi = new Float64Array(n);
    for (let k = 0; k < n; k++) { const a = (sg * Math.PI * ((k * k) % (2 * n))) / n; wr[k] = Math.cos(a); wi[k] = Math.sin(a); }
    const ar = new Float64Array(m), ai = new Float64Array(m), br = new Float64Array(m), bi = new Float64Array(m);
    for (let k = 0; k < n; k++) { ar[k] = rr[k] * wr[k] - ii[k] * wi[k]; ai[k] = rr[k] * wi[k] + ii[k] * wr[k]; }
    br[0] = wr[0]; bi[0] = -wi[0];
    for (let k = 1; k < n; k++) { br[k] = br[m - k] = wr[k]; bi[k] = bi[m - k] = -wi[k]; }
    fft1(ar, ai, false); fft1(br, bi, false);
    for (let k = 0; k < m; k++) { const t = ar[k] * br[k] - ai[k] * bi[k]; ai[k] = ar[k] * bi[k] + ai[k] * br[k]; ar[k] = t; }
    fft1(ar, ai, true);
    for (let k = 0; k < n; k++) { const xr = ar[k] / m, xi = ai[k] / m; rr[k] = xr * wr[k] - xi * wi[k]; ii[k] = xr * wi[k] + xi * wr[k]; }
  }
  function fft2(F, inv) {
    const { R, C } = F;
    const rr = new Float64Array(Math.max(R, C)), ii = new Float64Array(Math.max(R, C));
    for (let i = 0; i < R; i++) {
      const a = rr.subarray(0, C), b = ii.subarray(0, C);
      for (let j = 0; j < C; j++) { a[j] = F.re[i * C + j]; b[j] = F.im[i * C + j]; }
      fft1(a, b, inv);
      for (let j = 0; j < C; j++) { F.re[i * C + j] = a[j]; F.im[i * C + j] = b[j]; }
    }
    for (let j = 0; j < C; j++) {
      const a = rr.subarray(0, R), b = ii.subarray(0, R);
      for (let i = 0; i < R; i++) { a[i] = F.re[i * C + j]; b[i] = F.im[i * C + j]; }
      fft1(a, b, inv);
      for (let i = 0; i < R; i++) { F.re[i * C + j] = a[i]; F.im[i * C + j] = b[i]; }
    }
    if (inv) { const s = 1 / (R * C); for (let q = 0; q < R * C; q++) { F.re[q] *= s; F.im[q] *= s; } }
  }
  function shift(F, back) {
    const { R, C } = F, o = { re: new Float64Array(R * C), im: new Float64Array(R * C), R, C };
    const sr = back ? Math.ceil(R / 2) : Math.floor(R / 2), sc = back ? Math.ceil(C / 2) : Math.floor(C / 2);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const ti = (i + sr) % R, tj = (j + sc) % C; o.re[ti * C + tj] = F.re[i * C + j]; o.im[ti * C + tj] = F.im[i * C + j]; }
    return o;
  }
  // transformadas centradas: o centro da matriz é a origem
  function fft2c(U) { let F = shift(toRI(U), true); fft2(F, false); return fromRI(shift(F, false)); }
  function ifft2c(U) { let F = shift(toRI(U), true); fft2(F, true); return fromRI(shift(F, false)); }
  function coords(L, N) { L = num(L); N = Math.round(num(N)); const o = []; for (let j = 0; j < N; j++) o.push(((j - Math.floor(N / 2)) * L) / N); return o; }
  function grade(L, N) { return M.matrix(coords(L, N)); }
  function campo(f, L, N) {
    if (typeof f !== 'function') throw new Error('campo(f, L, N): f deve ser uma função f(x, y).');
    const xs = coords(L, N), out = [];
    for (const y of xs) { const row = []; for (const x of xs) row.push(f(x, y)); out.push(row); }
    return M.matrix(out);
  }
  function applyH(U, L, Hfun) {
    const F = shift(toRI(U), true); fft2(F, false);
    const { R, C } = F, Lx = num(L);
    for (let i = 0; i < R; i++) {
      const fy = (i < Math.ceil(R / 2) ? i : i - R) / Lx;
      for (let j = 0; j < C; j++) {
        const fx = (j < Math.ceil(C / 2) ? j : j - C) / Lx;
        const [hr, hi] = Hfun(fx, fy), q = i * C + j, a = F.re[q], b = F.im[q];
        F.re[q] = a * hr - b * hi; F.im[q] = a * hi + b * hr;
      }
    }
    fft2(F, true);
    return fromRI(shift(F, false));
  }
  function propEA(U, L, lam, z, n) {
    const k = (2 * Math.PI * optN(n, 1)) / num(lam), zz = num(z);
    return applyH(U, L, (fx, fy) => {
      const kt2 = (2 * Math.PI) ** 2 * (fx * fx + fy * fy), d = k * k - kt2;
      if (d >= 0) { const kz = Math.sqrt(d); return [Math.cos(kz * zz), Math.sin(kz * zz)]; }
      return [Math.exp(-Math.sqrt(-d) * Math.abs(zz)), 0];
    });
  }
  function fresnel(U, L, lam, z, n) {
    const nn = optN(n, 1), lm = num(lam) / nn, k = (2 * Math.PI) / lm, zz = num(z);
    return applyH(U, L, (fx, fy) => { const ph = k * zz - Math.PI * lm * zz * (fx * fx + fy * fy); return [Math.cos(ph), Math.sin(ph)]; });
  }
  function fraunL(L, lam, z, N, n) { return (num(lam) / optN(n, 1)) * num(z) * Math.round(num(N)) / num(L); }
  function fraunhofer(U, L, lam, z, n) {
    const F0 = toRI(U), N = F0.C, lm = num(lam) / optN(n, 1), k = (2 * Math.PI) / lm, zz = num(z), dx = num(L) / N;
    const S = toRI(fft2c(U)), L2 = (lm * zz * N) / num(L), x2 = coords(L2, N);
    for (let i = 0; i < S.R; i++) for (let j = 0; j < S.C; j++) {
      const q = i * S.C + j, ph = k * zz + (k * (x2[j] ** 2 + x2[i] ** 2)) / (2 * zz);
      // fator e^{ikz} e^{ik r²/2z} / (iλz) · dx²
      const fr = Math.cos(ph), fi = Math.sin(ph), s = (dx * dx) / (lm * zz);
      const gr = fi * s, gi = -fr * s; // (fr + i fi)/i = fi - i fr
      const a = S.re[q], b = S.im[q];
      S.re[q] = a * gr - b * gi; S.im[q] = a * gi + b * gr;
    }
    return fromRI(S);
  }
  function lente(U, L, lam, f, n) {
    const F = toRI(U), xs = coords(L, F.C), ys = coords(L, F.R), k = (2 * Math.PI * optN(n, 1)) / num(lam), ff = num(f);
    for (let i = 0; i < F.R; i++) for (let j = 0; j < F.C; j++) {
      const q = i * F.C + j, ph = (-k * (xs[j] ** 2 + ys[i] ** 2)) / (2 * ff), c = Math.cos(ph), s = Math.sin(ph), a = F.re[q], b = F.im[q];
      F.re[q] = a * c - b * s; F.im[q] = a * s + b * c;
    }
    return fromRI(F);
  }
  const ampCache = new WeakMap();
  function amostra(U, L, x, y) {
    let F = typeof U === 'object' ? ampCache.get(U) : null;
    if (!F) { F = toRI(U); if (typeof U === 'object') ampCache.set(U, F); }
    const Ln = num(L), N = F.C, dx = Ln / N, x0 = -Math.floor(N / 2) * dx;
    const fx = (num(x) - x0) / dx, fy = (num(y) - x0) / dx;
    const i0 = Math.floor(fy), j0 = Math.floor(fx);
    if (i0 < 0 || j0 < 0 || i0 >= F.R - 1 || j0 >= F.C - 1) return 0;
    const tx = fx - j0, ty = fy - i0, q = (i, j) => i * F.C + j;
    const w = [[(1 - tx) * (1 - ty), q(i0, j0)], [tx * (1 - ty), q(i0, j0 + 1)], [(1 - tx) * ty, q(i0 + 1, j0)], [tx * ty, q(i0 + 1, j0 + 1)]];
    let a = 0, b = 0; for (const [ww, k] of w) { a += ww * F.re[k]; b += ww * F.im[k]; }
    return b === 0 ? a : cx(a, b);
  }
  const intensidade = (U) => M.map(U, (v) => re(v) ** 2 + im(v) ** 2);
  const fase = (U) => M.map(U, (v) => Math.atan2(im(v), re(v)));
  const circ = (x, y, R) => (num(x) ** 2 + num(y) ** 2 <= num(R) ** 2 ? 1 : 0);
  const rect = (x, a) => (Math.abs(num(x)) <= num(a) / 2 ? 1 : 0);

  /* ================= Polarização (Jones e Stokes) ================= */
  const s2 = Math.SQRT1_2;
  function jones(name) {
    const t = String(name || '').trim().toUpperCase();
    const V = { H: [1, 0], X: [1, 0], V: [0, 1], Y: [0, 1], D: [s2, s2], A: [s2, -s2], '+': [s2, cx(0, s2)], '-': [s2, cx(0, -s2)] }[t];
    if (!V) throw new Error('jones("H"), jones("V"), jones("D"), jones("A"), jones("+") (S₃ = +1) ou jones("-") (S₃ = −1)');
    return M.matrix([[V[0]], [V[1]]]);
  }
  function rotacao(th) { th = num(th); const c = Math.cos(th), s = Math.sin(th); return M.matrix([[c, -s], [s, c]]); }
  function polarizador(th) { th = num(th); const c = Math.cos(th), s = Math.sin(th); return M.matrix([[c * c, c * s], [c * s, s * s]]); }
  // retardador de fase Γ com eixo rápido em θ (fase global descartada)
  function lamina(G, th) {
    G = num(G); th = num(th);
    const c = Math.cos(th), s = Math.sin(th), e = cx(Math.cos(G), Math.sin(G));
    const a = M.add(c * c, M.multiply(s * s, e)), b = M.multiply(c * s, M.subtract(1, e)), d = M.add(s * s, M.multiply(c * c, e));
    return M.matrix([[a, b], [b, d]]);
  }
  function stokes(J) {
    const a = M.flatten(FC.toArr(J)); const ex = a[0], ey = a[1];
    const xr = re(ex), xi = im(ex), yr = re(ey), yi = im(ey);
    const Ix = xr * xr + xi * xi, Iy = yr * yr + yi * yi;
    const pr = xr * yr + xi * yi, pi = xr * yi - xi * yr; // ex* · ey
    return M.matrix([[Ix + Iy], [Ix - Iy], [2 * pr], [2 * pi]]);
  }
  function elipse(J) { const S = M.flatten(stokes(J).toArray()); return M.matrix([[0.5 * Math.atan2(S[2], S[1])], [0.5 * Math.asin(Math.max(-1, Math.min(1, S[3] / S[0])))]]); }

  /* ================= Pinças no regime de Rayleigh (SI) ================= */
  const CM = (ep, em) => M.divide(M.subtract(ep, em), M.add(ep, M.multiply(2, em)));
  const alfaCM = (a, ep, em) => M.multiply(4 * Math.PI * EPS0 * num(a) ** 3, M.multiply(em, CM(ep, em)));
  function alfaRad(alpha, lam, em) {
    if (M.isUnit(alpha)) alpha = alpha.value;
    const nm = Math.sqrt(re(em)), k = (2 * Math.PI * nm) / num(lam), f = (k ** 3) / (6 * Math.PI * EPS0 * re(em));
    return M.divide(alpha, M.subtract(1, M.multiply(cx(0, f), alpha)));
  }
  function sigmaScat(alpha, lam, em) { const k = (2 * Math.PI * Math.sqrt(re(em))) / num(lam); return (k ** 4 * (re(alpha) ** 2 + im(alpha) ** 2)) / (6 * Math.PI * EPS0 ** 2 * re(em) ** 2); }
  function sigmaAbs(alpha, lam, em) { const k = (2 * Math.PI * Math.sqrt(re(em))) / num(lam); return (k * im(alpha)) / (EPS0 * re(em)); }
  const Fgrad = (alpha, dI, nm) => (re(alpha) * num(dI)) / (2 * C0 * num(nm) * EPS0);
  const Fscat = (alpha, I, lam, nm) => (num(nm) / C0) * (sigmaScat(alpha, lam, num(nm) ** 2) + sigmaAbs(alpha, lam, num(nm) ** 2)) * num(I);
  const Uarm = (alpha, I, nm) => (-re(alpha) * num(I)) / (2 * C0 * num(nm) * EPS0);

  /* ================= Richards–Wolf (integral vetorial de Debye) =================
     E(ρ,ϕ,z) ∝ ∫₀^θmax ∫₀^2π E∞(θ,φ) e^{ik z cosθ} e^{ik ρ sinθ cos(φ−ϕ)} sinθ dφ dθ
     E∞ = A(θ)·√cosθ·[t_s (E_inc·n_φ) n_φ + t_p (E_inc·n_ρ) n_θ].  A integral em φ é feita por harmônicos:
     ∫ e^{imφ} e^{ia cos(φ−ϕ)} dφ = 2π i^m J_m(a) e^{imϕ}.  */
  function gaussLegendre(n) {
    const x = new Float64Array(n), w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) {
        let p1 = 1, p2 = 0;
        for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1); }
        pp = (n * (z * p1 - p2)) / (z * z - 1);
        const z1 = z; z = z1 - p1 / pp;
        if (Math.abs(z - z1) < 1e-15) break;
      }
      x[i] = -z; w[i] = 2 / ((1 - z * z) * pp * pp);
    }
    return { x, w };
  }
  const GL = gaussLegendre(96);
  const rwCache = new Map();
  function rwSetup(o) {
    const key = JSON.stringify(o);
    let S = rwCache.get(key);
    if (S) return S;
    if (rwCache.size > 40) rwCache.clear();
    const { NA, n1, n2, lam, f0, pol, l, d } = o;
    if (!(NA > 0) || NA >= n1 * 0.9999999) throw new Error('Richards–Wolf: a abertura numérica deve ser menor que o índice de refração (NA < n).');
    const k0 = (2 * Math.PI) / lam, th1 = Math.asin(NA / n1), smax = Math.sin(th1);
    const doughnut = /radial|azimut/.test(pol) ? Math.max(1, Math.abs(l)) : Math.abs(l);
    const Mh = Math.abs(l) + 3, Nphi = 4 * (Mh + 2);
    const nodes = [];
    for (let g = 0; g < GL.x.length; g++) {
      const t = 0.5 * th1 * (GL.x[g] + 1), wt = 0.5 * th1 * GL.w[g];
      const s1 = Math.sin(t), c1 = Math.cos(t);
      // meio 2 (Snell); cosθ2 pode ser complexo (reflexão interna total)
      const st2 = (n1 * s1) / n2, q = 1 - st2 * st2;
      const c2r = q >= 0 ? Math.sqrt(q) : 0, c2i = q >= 0 ? 0 : Math.sqrt(-q);
      // Fresnel t_s, t_p (n1 → n2), complexos se c2 for complexo
      const cdiv = (ar, ai, br, bi) => { const dd = br * br + bi * bi; return [(ar * br + ai * bi) / dd, (ai * br - ar * bi) / dd]; };
      const ts = n1 === n2 ? [1, 0] : cdiv(2 * n1 * c1, 0, n1 * c1 + n2 * c2r, n2 * c2i);
      const tp = n1 === n2 ? [1, 0] : cdiv(2 * n1 * c1, 0, n2 * c1 + n1 * c2r, n1 * c2i);
      const u = isFinite(f0) ? s1 / (f0 * smax) : s1 / smax;
      const A = (doughnut ? u ** doughnut : 1) * (isFinite(f0) ? Math.exp(-u * u) : 1) * Math.sqrt(c1);
      // amostra E∞ em φ e calcula os harmônicos c_m para cada componente
      const cm = [[], [], []].map(() => ({ r: new Float64Array(2 * Mh + 1), i: new Float64Array(2 * Mh + 1) }));
      for (let j = 0; j < Nphi; j++) {
        const ph = (2 * Math.PI * j) / Nphi, cp = Math.cos(ph), sp = Math.sin(ph);
        let exr, exi, eyr, eyi;
        if (pol === 'x') { exr = 1; exi = 0; eyr = 0; eyi = 0; }
        else if (pol === 'y') { exr = 0; exi = 0; eyr = 1; eyi = 0; }
        else if (pol === 'circ+') { exr = s2; exi = 0; eyr = 0; eyi = s2; }
        else if (pol === 'circ-') { exr = s2; exi = 0; eyr = 0; eyi = -s2; }
        else if (pol === 'radial') { exr = cp; exi = 0; eyr = sp; eyi = 0; }
        else if (pol === 'azimutal') { exr = -sp; exi = 0; eyr = cp; eyi = 0; }
        else throw new Error('Polarização desconhecida: ' + pol + ' (use "x", "y", "circ+", "circ-", "radial" ou "azimutal").');
        if (l) { const vr = Math.cos(l * ph), vi = Math.sin(l * ph); [exr, exi] = [exr * vr - exi * vi, exr * vi + exi * vr]; [eyr, eyi] = [eyr * vr - eyi * vi, eyr * vi + eyi * vr]; }
        const Ephr = -exr * sp + eyr * cp, Ephi = -exi * sp + eyi * cp; // E_inc · n_φ
        const Erhr = exr * cp + eyr * sp, Erhi = exi * cp + eyi * sp;    // E_inc · n_ρ
        // termos s e p (complexos)
        const sr = ts[0] * Ephr - ts[1] * Ephi, si = ts[0] * Ephi + ts[1] * Ephr;
        const pr = tp[0] * Erhr - tp[1] * Erhi, pi = tp[0] * Erhi + tp[1] * Erhr;
        // n_θ2 = (cosθ2 cosφ, cosθ2 sinφ, −sinθ2), cosθ2 = c2r + i c2i
        const E = [
          [A * (-sr * sp + (pr * c2r - pi * c2i) * cp), A * (-si * sp + (pr * c2i + pi * c2r) * cp)],
          [A * (sr * cp + (pr * c2r - pi * c2i) * sp), A * (si * cp + (pr * c2i + pi * c2r) * sp)],
          [A * (-pr * st2), A * (-pi * st2)]
        ];
        for (let m = -Mh; m <= Mh; m++) {
          const a = -m * ph, c = Math.cos(a) / Nphi, s = Math.sin(a) / Nphi;
          for (let comp = 0; comp < 3; comp++) { const [er, ei] = E[comp]; cm[comp].r[m + Mh] += er * c - ei * s; cm[comp].i[m + Mh] += er * s + ei * c; }
        }
      }
      nodes.push({ wt: wt * s1, kt: k0 * n1 * s1, kzr: k0 * n2 * c2r, kzi: k0 * n2 * c2i, ph0: -k0 * n1 * d * c1, cm });
    }
    S = { nodes, Mh };
    rwCache.set(key, S);
    return S;
  }
  // i^m
  const IPOW = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function rwField(S, x, y, z) {
    const rho = Math.hypot(x, y), vp = Math.atan2(y, x), Mh = S.Mh;
    const out = [0, 0, 0, 0, 0, 0];
    const eim = []; for (let m = -Mh; m <= Mh; m++) eim.push([Math.cos(m * vp), Math.sin(m * vp)]);
    for (const nd of S.nodes) {
      const J = besselSet(Mh, nd.kt * rho);
      // e^{i(kz z + ph0)} com kz possivelmente complexo
      const dmp = Math.exp(-nd.kzi * z), a = nd.kzr * z + nd.ph0;
      const er = nd.wt * dmp * Math.cos(a), ei = nd.wt * dmp * Math.sin(a);
      for (let m = -Mh; m <= Mh; m++) {
        const am = Math.abs(m); let jm = J[am]; if (m < 0 && am % 2) jm = -jm;
        const ip = IPOW[((m % 4) + 4) % 4], e = eim[m + Mh];
        // fator = 2π i^m J_m e^{imϕ} · e^{iΦ}
        let fr = ip[0] * e[0] - ip[1] * e[1], fi = ip[0] * e[1] + ip[1] * e[0];
        [fr, fi] = [(fr * er - fi * ei) * jm, (fr * ei + fi * er) * jm];
        for (let comp = 0; comp < 3; comp++) {
          const c = nd.cm[comp], cr = c.r[m + Mh], ci = c.i[m + Mh];
          out[2 * comp] += cr * fr - ci * fi; out[2 * comp + 1] += cr * fi + ci * fr;
        }
      }
    }
    return out.map((v) => v * 2 * Math.PI);
  }
  const normCache = new Map();
  function rwNorm(o) {
    const ref = Object.assign({}, o, { pol: 'x', l: 0, d: 0 });
    const key = JSON.stringify(ref);
    if (!normCache.has(key)) { const f = rwField(rwSetup(ref), 0, 0, 0); normCache.set(key, f[0] * f[0] + f[1] * f[1]); }
    return normCache.get(key);
  }
  function rwOpts(NA, n1, n2, lam, f0, pol, l, d) {
    const F0 = f0 === undefined || f0 === null ? Infinity : num(f0);
    return { NA: num(NA), n1: num(n1), n2: num(n2), lam: num(lam), f0: F0 > 1e6 ? Infinity : F0, pol: String(pol || 'x').toLowerCase().replace('azimuthal', 'azimutal'), l: Math.round(num(l || 0)), d: num(d || 0) };
  }
  function vecOut(F, nrm) {
    const s = 1 / Math.sqrt(nrm);
    return M.matrix([[cx(F[0] * s, F[1] * s)], [cx(F[2] * s, F[3] * s)], [cx(F[4] * s, F[5] * s)]]);
  }
  const RW_campo = (x, y, z, NA, n, lam, f0, pol, l) => { const o = rwOpts(NA, n, n, lam, f0, pol, l, 0); return vecOut(rwField(rwSetup(o), num(x), num(y), num(z)), rwNorm(o)); };
  const RW_I = (x, y, z, NA, n, lam, f0, pol, l) => { const o = rwOpts(NA, n, n, lam, f0, pol, l, 0); const F = rwField(rwSetup(o), num(x), num(y), num(z)); return F.reduce((s, v) => s + v * v, 0) / rwNorm(o); };
  const RWi_campo = (x, y, z, NA, n1, n2, lam, d, f0, pol, l) => { const o = rwOpts(NA, n1, n2, lam, f0, pol, l, d); return vecOut(rwField(rwSetup(o), num(x), num(y), num(z)), rwNorm(o)); };
  const RWi_I = (x, y, z, NA, n1, n2, lam, d, f0, pol, l) => { const o = rwOpts(NA, n1, n2, lam, f0, pol, l, d); const F = rwField(rwSetup(o), num(x), num(y), num(z)); return F.reduce((s, v) => s + v * v, 0) / rwNorm(o); };
  // fórmulas fechadas de Novotny & Hecht (polarização x, sem interface) — para conferência
  function RW_I0x(rho, z, NA, n, lam, f0, which) {
    const o = rwOpts(NA, n, n, lam, f0, 'x', 0, 0), k = (2 * Math.PI * o.n2) / o.lam, th = Math.asin(o.NA / o.n2), sm = Math.sin(th);
    const which2 = Math.round(num(which));
    let r = 0, i = 0;
    for (let g = 0; g < GL.x.length; g++) {
      const t = 0.5 * th * (GL.x[g] + 1), w = 0.5 * th * GL.w[g], s = Math.sin(t), c = Math.cos(t);
      const fw = isFinite(o.f0) ? Math.exp(-((s / (o.f0 * sm)) ** 2)) : 1;
      const J = besselSet(2, k * num(rho) * s);
      const g0 = which2 === 0 ? s * (1 + c) * J[0] : which2 === 1 ? s * s * J[1] : s * (1 - c) * J[2];
      const a = k * num(z) * c, f = w * fw * Math.sqrt(c) * g0;
      r += f * Math.cos(a); i += f * Math.sin(a);
    }
    return cx(r, i);
  }

  // com argumentos em unidades, o resultado volta com a unidade SI correspondente
  const withUnit = (fn, u) => function () { const v = fn.apply(null, arguments); return [...arguments].some((a) => M.isUnit(a)) && typeof v === 'number' && isFinite(v) ? M.unit(v, u) : v; };
  M.import({
    zR: withUnit(zR, 'm'), wz: withUnit(wz, 'm'), Rz: withUnit(Rz, 'm'), gouy, Egauss, Igauss, Ifeixe: withUnit(Ifeixe, 'W/m^2'), LG, HG, besselBeam,
    fft2c, ifft2c, grade, campo, propEA, fresnel, fraunhofer, fraunL: withUnit(fraunL, 'm'), lente, amostra, intensidade, fase, circ, rect,
    jones, rotacao, polarizador, lamina, stokes, elipse,
    CM, alfaCM: withUnit(alfaCM, 'F m^2'), alfaRad, sigmaScat: withUnit(sigmaScat, 'm^2'), sigmaAbs: withUnit(sigmaAbs, 'm^2'), Fgrad: withUnit(Fgrad, 'N'), Fscat: withUnit(Fscat, 'N'), Uarm: withUnit(Uarm, 'J'),
    RW_campo, RW_I, RWi_campo, RWi_I, RW_I0x
  }, { override: true });
  FC.OPTICS_FNS = ['zR', 'wz', 'Rz', 'gouy', 'Egauss', 'Igauss', 'Ifeixe', 'LG', 'HG', 'besselBeam', 'fft2c', 'ifft2c', 'grade', 'campo', 'propEA', 'fresnel', 'fraunhofer', 'fraunL', 'lente', 'amostra', 'intensidade', 'fase', 'circ', 'rect', 'jones', 'rotacao', 'polarizador', 'lamina', 'stokes', 'elipse', 'CM', 'alfaCM', 'alfaRad', 'sigmaScat', 'sigmaAbs', 'Fgrad', 'Fscat', 'Uarm', 'RW_campo', 'RW_I', 'RWi_campo', 'RWi_I'];
})();
