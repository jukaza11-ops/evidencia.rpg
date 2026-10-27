import { State, TexKey, TEX_ORDER, FRAME_META, ASPECTS, FONTS, INKS, Adjust, UV, UV_TINTS, NEONS } from './types';

export interface Src { img: CanvasImageSource; w: number; h: number; id: number }
export interface Layout { a: number; side: number; top: number; bottom: number; cwU: number; chU: number; radiusU: number; cropW: number }
export interface TextBox { cx: number; cy: number; w: number; h: number; rot: number }
export interface RenderOut { W: number; H: number; textBox: TextBox | null; secretBox: TextBox | null }

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
type Rn = () => number;

export function layout(st: State, iw: number, ih: number): Layout {
  const asp = ASPECTS.find((x) => x[0] === st.aspect);
  const a = !asp || asp[2] === 0 ? iw / ih : asp[2];
  const f = FRAME_META[st.frame];
  const t = st.thickness;
  const side = f.side * t, top = f.top * t, bottom = f.bottom * (0.5 + 0.5 * t);
  const cropW = iw / ih > a ? ih * a : iw;
  return { a, side, top, bottom, cwU: 1 + 2 * side, chU: 1 / a + top + bottom, radiusU: st.corners === 'soft' ? f.soft : 0, cropW };
}

/** Largest k (px per photo width) allowed for export, honouring native resolution and canvas limits. */
export function exportK(st: State, src: Src, mobile: boolean): number {
  const L = layout(st, src.w, src.h);
  const maxPx = mobile ? 12e6 : 30e6, maxSide = mobile ? 6000 : 9000;
  return Math.max(64, Math.min(L.cropW, Math.sqrt(maxPx / (L.cwU * L.chU)), maxSide / Math.max(L.cwU, L.chU)));
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

/* ---------- Layer 1-3: photo, colour, grain ---------- */
const cache = new Map<string, HTMLCanvasElement>();
function getPhoto(src: Src, st: State, L: Layout, pw: number, ph: number, useCache: boolean): HTMLCanvasElement {
  const g = st.textures.grain;
  const key = JSON.stringify([src.id, st.aspect, st.adjust, g.on, g.intensity, g.opacity, g.variant, g.seed, pw, ph]);
  if (useCache) { const hit = cache.get(key); if (hit) return hit; }
  const c = mk(pw, ph); const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  let sw = src.w, sh = src.h;
  if (src.w / src.h > L.a) sw = src.h * L.a; else sh = src.w / L.a;
  ctx.drawImage(src.img, (src.w - sw) / 2, (src.h - sh) / 2, sw, sh, 0, 0, pw, ph);
  const adj = st.adjust;
  if (adj.soften > 0) {
    const f = 1 / (2 + adj.soften * 9);
    const s = mk(Math.round(pw * f), Math.round(ph * f)); const sc = s.getContext('2d')!; sc.imageSmoothingQuality = 'high';
    sc.drawImage(c, 0, 0, s.width, s.height);
    ctx.save(); ctx.globalAlpha = Math.min(1, 0.25 + adj.soften * 0.65); ctx.drawImage(s, 0, 0, pw, ph); ctx.restore();
  }
  const gs = g.on ? g.intensity * g.opacity : 0;
  process(ctx, pw, ph, adj, gs, [0.9, 1.5, 2.4][g.variant] ?? 1.5, g.seed);
  if (useCache) {
    cache.set(key, c);
    let tot = 0; cache.forEach((v) => (tot += v.width * v.height));
    for (const k of cache.keys()) { if (tot < 24e6 || cache.size <= 1) break; const v = cache.get(k)!; tot -= v.width * v.height; cache.delete(k); }
  }
  return c;
}

function noiseField(w: number, h: number, cell: number, rn: Rn) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2; const a = new Float32Array(gw * gh);
  for (let i = 0; i < a.length; i++) a[i] = (rn() + rn() + rn() - 1.5) * 1.15;
  return { a, gw };
}

function process(ctx: CanvasRenderingContext2D, w: number, h: number, adj: Adjust, gs: number, grainSize: number, seed: number) {
  const id = ctx.getImageData(0, 0, w, h); const d = id.data;
  const ex = Math.pow(2, adj.exposure * 0.9);
  const tr = 1 + adj.temperature * 0.2, tb = 1 - adj.temperature * 0.2, tg = 1 - adj.tint * 0.1 - Math.abs(adj.temperature) * 0.02;
  const tr2 = 1 + adj.tint * 0.04, tb2 = 1 + adj.tint * 0.04;
  const cf = adj.contrast >= 0 ? 1 + adj.contrast * 1.1 : 1 + adj.contrast * 0.75;
  const sf = 1 + adj.saturation * (adj.saturation > 0 ? 1.1 : 1);
  const fade = adj.fade, sep = adj.sepia, mono = adj.mono, vig = adj.vignette;
  const base = w / 1100; const cell1 = Math.max(0.8, grainSize * base), cell2 = cell1 * 2.8;
  const rn = mulberry32(seed * 31 + 5);
  const n1 = gs > 0 ? noiseField(w, h, cell1, rn) : null; const n2 = gs > 0 ? noiseField(w, h, cell2, rn) : null;
  const sample = (n: { a: Float32Array; gw: number }, cell: number, x: number, y: number) => {
    const fx = x / cell, fy = y / cell; const ix = fx | 0, iy = fy | 0; const tx = fx - ix, ty = fy - iy; const o = iy * n.gw + ix;
    const a = n.a; return (a[o] * (1 - tx) + a[o + 1] * tx) * (1 - ty) + (a[o + n.gw] * (1 - tx) + a[o + n.gw + 1] * tx) * ty;
  };
  const hw = w / 2, hh = h / 2;
  for (let y = 0; y < h; y++) {
    const dy = (y - hh) / hh;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = (d[i] / 255) * ex * tr * tr2, g = (d[i + 1] / 255) * ex * tg, b = (d[i + 2] / 255) * ex * tb * tb2;
      r = (r - 0.5) * cf + 0.5; g = (g - 0.5) * cf + 0.5; b = (b - 0.5) * cf + 0.5;
      let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf;
      if (mono > 0) { l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r += (l - r) * mono; g += (l - g) * mono; b += (l - b) * mono; }
      if (sep > 0) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * sep; g += (sg - g) * sep; b += (sb - b) * sep;
      }
      if (fade > 0) {
        r = r * (1 - 0.32 * fade) + 0.14 * fade + 0.02 * fade; g = g * (1 - 0.32 * fade) + 0.13 * fade; b = b * (1 - 0.32 * fade) + 0.11 * fade;
        const l2 = (r + g + b) / 3; const k = 0.25 * fade; r += (l2 - r) * k; g += (l2 - g) * k; b += (l2 - b) * k;
      }
      if (vig > 0) {
        const dx = (x - hw) / hw; const dd = (dx * dx + dy * dy) / 2; const f = 1 - vig * 0.7 * dd * dd * 1.4 - vig * 0.15 * dd;
        r *= f; g *= f; b *= f;
      }
      if (n1) {
        const nz = sample(n1, cell1, x, y) * 0.75 + sample(n2!, cell2, x, y) * 0.45;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b; const wgt = 1 - Math.abs(2 * Math.min(1, Math.max(0, lum)) - 1) * 0.55;
        const add = nz * gs * wgt * 0.2;
        r += add; g += add * 0.97; b += add * 1.03;
      }
      d[i] = r < 0 ? 0 : r > 1 ? 255 : r * 255; d[i + 1] = g < 0 ? 0 : g > 1 ? 255 : g * 255; d[i + 2] = b < 0 ? 0 : b > 1 ? 255 : b * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);
}

/* ---------- Layer 4: physical textures ---------- */
interface Ctx { W: number; H: number; k: number; px: number; py: number; pw: number; ph: number; I: number; v: number; r: Rn; L: Layout }
type DrawFn = (g: CanvasRenderingContext2D, c: Ctx) => void;

function mkBlob(rn: Rn, rough: number, n = 26) {
  const ph = [rn() * 6.28, rn() * 6.28, rn() * 6.28]; const jit: number[] = [];
  for (let i = 0; i < n; i++) jit.push((rn() - 0.5) * 0.3);
  return { ph, jit, rough, n };
}
function blobPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, b: ReturnType<typeof mkBlob>) {
  const pts: [number, number][] = [];
  for (let i = 0; i < b.n; i++) {
    const a = (i / b.n) * 6.2832;
    const m = 1 + b.rough * (0.5 * Math.sin(a + b.ph[0]) + 0.3 * Math.sin(2 * a + b.ph[1]) + 0.2 * Math.sin(3 * a + b.ph[2]) + b.jit[i]);
    pts.push([cx + Math.cos(a) * r * m, cy + Math.sin(a) * r * m]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  g.beginPath(); const m0 = mid(pts[b.n - 1], pts[0]); g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < b.n; i++) { const m = mid(pts[i], pts[(i + 1) % b.n]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  g.closePath();
}
function rad(g: CanvasRenderingContext2D, x: number, y: number, r: number, c0: string, c1: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr;
}
function perimPoint(W: number, H: number, t: number, inset: number): [number, number] {
  const P = 2 * (W + H); let d = t * P;
  if (d < W) return [d, inset]; d -= W;
  if (d < H) return [W - inset, d]; d -= H;
  if (d < W) return [W - d, H - inset]; d -= W;
  return [inset, H - d];
}

const DRAW: Partial<Record<TexKey, DrawFn>> = {
  dust(g, { W, H, k, I, v, r, L }) {
    const n = Math.round((50 + 520 * I) * L.cwU * L.chU);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, dark = r() < 0.55, A = 0.25 + r() * 0.6;
      const col = dark ? `rgba(25,18,12,${A})` : `rgba(255,252,240,${A})`;
      if (v === 0 || (v === 2 && r() < 0.7)) {
        const rd = k * (0.0006 + Math.pow(r(), 4) * 0.006 * (0.6 + I));
        g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rd, rd * (0.5 + r() * 0.7), r() * 3.14, 0, 6.29); g.fill();
      } else {
        const len = k * (0.01 + r() * 0.05), a = r() * 6.28; g.strokeStyle = col; g.lineWidth = k * 0.0008 * (0.7 + r());
        g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + Math.cos(a) * len * 0.4 + (r() - 0.5) * len * 0.6, y + Math.sin(a) * len * 0.4 + (r() - 0.5) * len * 0.6, x + Math.cos(a) * len * 0.8 + (r() - 0.5) * len * 0.6, y + Math.sin(a) * len * 0.8 + (r() - 0.5) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
  },
  scratches(g, { W, H, k, I, v, r }) {
    g.lineCap = 'round';
    if (v === 0) {
      const n = Math.round(4 + 34 * I);
      for (let i = 0; i < n; i++) {
        let x = r() * W, y = r() * H * 0.6; const len = H * (0.25 + r() * 0.75);
        g.strokeStyle = r() < 0.2 ? `rgba(0,0,0,${0.25 + r() * 0.3})` : `rgba(255,255,255,${0.3 + r() * 0.45})`; g.lineWidth = k * (0.0008 + r() * 0.0016);
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 8; s++) { x += (r() - 0.5) * k * 0.008; y += len / 8; g.lineTo(x, y); }
        g.stroke();
      }
    } else if (v === 1) {
      const n = Math.round(5 + 36 * I);
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * H, a = r() * 6.28, len = k * (0.1 + r() * 0.5);
        g.strokeStyle = r() < 0.25 ? `rgba(0,0,0,${0.2 + r() * 0.3})` : `rgba(255,255,255,${0.3 + r() * 0.4})`; g.lineWidth = k * (0.0008 + r() * 0.0018);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * len * 0.3, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * len * 0.3, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
    } else {
      const n = Math.round(2 + 14 * I);
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * H, a = r() * 6.28, len = k * (0.15 + r() * 0.55), bend = (r() - 0.5) * len * 0.4;
        const path = () => { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len); };
        g.strokeStyle = 'rgba(30,20,10,0.5)'; g.lineWidth = k * 0.0024; path(); g.stroke();
        g.save(); g.translate(k * 0.002, k * 0.002); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = k * 0.0012; path(); g.stroke(); g.restore();
      }
    }
  },
  paper(g, { W, H, k, I, v, r }) {
    const tone = ['#eddcae', '#e0b45c', '#b98a55'][v] ?? '#eddcae';
    g.globalAlpha = 0.25 + 0.55 * I; g.fillStyle = tone; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H, rd = k * (0.15 + r() * 0.4); g.fillStyle = rad(g, x, y, rd, `rgba(140,95,35,${0.16 * I + 0.03})`, 'rgba(140,95,35,0)'); g.fillRect(x - rd, y - rd, rd * 2, rd * 2); }
    const dg = Math.hypot(W, H) / 2;
    g.fillStyle = rad(g, W / 2, H / 2, dg, 'rgba(120,75,25,0)', `rgba(110,70,20,${0.55 * I})`);
    const gr = g.createRadialGradient(W / 2, H / 2, dg * 0.55, W / 2, H / 2, dg); gr.addColorStop(0, 'rgba(110,70,20,0)'); gr.addColorStop(1, `rgba(110,70,20,${0.6 * I})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },
  creases(g, { W, H, k, I, v, r }) {
    const j = () => (r() - 0.5) * 0.12;
    type Ln = { x: number; y: number; a: number; len: number };
    let lines: Ln[] = []; const D = Math.hypot(W, H);
    if (v === 0) lines = [{ x: W * (0.5 + j()), y: H * (0.5 + j()), a: j() * 0.2, len: D }, { x: W * (0.5 + j()), y: H * (0.5 + j()), a: Math.PI / 2 + j() * 0.2, len: D }];
    else if (v === 1) lines = [{ x: W / 2, y: H * (0.5 + j()), a: j() * 0.15, len: D }];
    else if (v === 2) lines = [{ x: W * (0.5 + j()), y: H / 2, a: Math.PI / 2 + j() * 0.15, len: D }];
    else if (v === 3) lines = [{ x: W * (0.5 + j()), y: H * (0.5 + j()), a: 0.6 + j(), len: D }];
    else { const n = 4 + Math.round(4 * I); for (let i = 0; i < n; i++) lines.push({ x: r() * W, y: r() * H, a: r() * Math.PI, len: D * (0.12 + r() * 0.25) }); }
    for (const ln of lines) {
      g.save(); g.translate(ln.x, ln.y); g.rotate(ln.a);
      const w = k * (0.025 + 0.035 * I) * (v === 4 ? 0.5 : 1), a = (0.1 + 0.3 * I) * (v === 4 ? 0.6 : 1), Lh = ln.len;
      const gr = g.createLinearGradient(0, -w, 0, w);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, `rgba(0,0,0,${a * 0.45})`); gr.addColorStop(0.495, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.5, `rgba(255,255,255,${Math.min(0.7, a * 1.5)})`); gr.addColorStop(0.62, `rgba(255,255,255,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(-Lh, -w, Lh * 2, w * 2);
      const seg = 110; let on = true;
      for (let i = 0; i < seg; i++) {
        if (r() < 0.12) on = !on; const x0 = -Lh + (i / seg) * Lh * 2, x1 = x0 + (Lh * 2) / seg + 1;
        if (on) { g.strokeStyle = `rgba(255,255,255,${(0.25 + 0.5 * I) * (0.5 + r() * 0.5)})`; g.lineWidth = k * 0.0014; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.stroke(); }
        g.strokeStyle = `rgba(30,20,10,${0.25 * (0.4 + I) * (0.4 + r() * 0.6)})`; g.lineWidth = k * 0.001; g.beginPath(); g.moveTo(x0, k * 0.0016); g.lineTo(x1, k * 0.0016); g.stroke();
      }
      g.restore();
    }
  },
  edges(g, { W, H, k, I, v, r }) {
    const n = Math.round((200 + 1800 * I) * ((W + H) / (2 * k)));
    for (let i = 0; i < n; i++) {
      const light = v === 0 || (v === 2 && r() < 0.55);
      const [x, y] = perimPoint(W, H, r(), r() * r() * k * 0.02 * (0.5 + I)); const rd = k * (0.002 + r() * r() * 0.012 * (0.5 + I)); const A = 0.2 + r() * 0.6;
      g.fillStyle = rad(g, x, y, rd, light ? `rgba(250,246,232,${A})` : `rgba(85,52,20,${A * 0.7})`, light ? 'rgba(250,246,232,0)' : 'rgba(85,52,20,0)'); g.fillRect(x - rd, y - rd, rd * 2, rd * 2);
    }
    if (v !== 0) {
      const w = k * 0.06 * (0.5 + I), a = 0.35 * I;
      const sides: [number, number, number, number][] = [[0, 0, 0, w], [0, H, 0, H - w], [0, 0, w, 0], [W, 0, W - w, 0]];
      sides.forEach(([x0, y0, x1, y1], i) => {
        const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(70,40,15,${a})`); gr.addColorStop(1, 'rgba(70,40,15,0)'); g.fillStyle = gr;
        if (i < 2) g.fillRect(0, i === 0 ? 0 : H - w, W, w); else g.fillRect(i === 2 ? 0 : W - w, 0, w, H);
      });
    }
  },
  emulsion(g, { k, px, py, pw, ph, I, v, r }) {
    if (v === 0) {
      const n = 2 + Math.round(4 * I);
      for (let i = 0; i < n; i++) {
        const cx = px + r() * pw, cy = py + r() * ph, R = k * (0.02 + r() * 0.06) * (0.6 + I), b = mkBlob(r, 0.5);
        blobPath(g, cx, cy, R, b); g.fillStyle = rad(g, cx, cy, R * 1.3, 'rgba(238,230,208,0.72)', 'rgba(218,208,182,0.55)'); g.fill();
        g.strokeStyle = 'rgba(60,45,30,0.35)'; g.lineWidth = k * 0.002; g.stroke();
        g.save(); g.translate(k * 0.0015, k * 0.0015); blobPath(g, cx, cy, R, b); g.strokeStyle = 'rgba(255,250,235,0.5)'; g.lineWidth = k * 0.0012; g.stroke(); g.restore();
        for (let s = 0; s < 14; s++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.8; g.fillStyle = `rgba(60,45,30,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, k * 0.0012 * (0.5 + r()), 0, 6.29); g.fill(); }
      }
    } else if (v === 1) {
      const segs: [number, number, number, number][] = [];
      const crack = (x: number, y: number, a: number, steps: number, depth: number) => {
        for (let s = 0; s < steps; s++) {
          const na = a + (r() - 0.5) * 0.9, step = k * (0.008 + r() * 0.014); const nx = x + Math.cos(na) * step, ny = y + Math.sin(na) * step;
          segs.push([x, y, nx, ny]); x = nx; y = ny; a = na;
          if (depth < 2 && r() < 0.12) crack(x, y, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), Math.round(steps * 0.5), depth + 1);
        }
      };
      const n = 3 + Math.round(8 * I); for (let i = 0; i < n; i++) crack(px + r() * pw, py + r() * ph, r() * 6.28, 8 + Math.round(r() * 12), 0);
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(30,22,15,0.55)'; g.lineWidth = k * 0.0012; g.beginPath(); segs.forEach(([a, b, c, d]) => { g.moveTo(a, b); g.lineTo(c, d); }); g.stroke();
      g.save(); g.translate(k * 0.0012, k * 0.0012); g.strokeStyle = 'rgba(255,250,235,0.45)'; g.beginPath(); segs.forEach(([a, b, c, d]) => { g.moveTo(a, b); g.lineTo(c, d); }); g.stroke(); g.restore();
    } else {
      const n = Math.round(40 + 260 * I);
      for (let i = 0; i < n; i++) {
        const x = px + r() * pw, y = py + r() * ph, rd = k * (0.002 + Math.pow(r(), 2) * 0.012);
        g.fillStyle = 'rgba(235,228,208,0.8)'; g.beginPath(); g.arc(x, y, rd, 0, 6.29); g.fill();
        g.strokeStyle = 'rgba(40,30,20,0.45)'; g.lineWidth = rd * 0.35; g.beginPath(); g.arc(x, y, rd, 0.2, 2.2); g.stroke();
      }
    }
  },
  coffee(g, { W, H, k, I, v, r }) {
    const ring = (cx: number, cy: number, R: number, strong: boolean) => {
      const b = mkBlob(r, 0.09);
      blobPath(g, cx, cy, R, b); g.fillStyle = rad(g, cx, cy, R, 'rgba(160,110,50,0.07)', 'rgba(130,85,35,0.17)'); g.fill();
      blobPath(g, cx, cy, R, b); g.strokeStyle = 'rgba(120,75,30,0.10)'; g.lineWidth = k * 0.022; g.stroke();
      blobPath(g, cx, cy, R * 1.002, b); g.strokeStyle = `rgba(100,58,22,${strong ? 0.42 : 0.3})`; g.lineWidth = k * (0.007 + r() * 0.008); g.stroke();
      g.save(); g.setLineDash([R * (0.5 + r()), R * 0.15, R * (0.3 + r()), R * 0.2]); blobPath(g, cx, cy, R * 0.985, b); g.strokeStyle = 'rgba(70,38,12,0.5)'; g.lineWidth = k * 0.0022; g.stroke(); g.restore();
    };
    const cx = W * (0.35 + r() * 0.3), cy = H * (0.3 + r() * 0.4), R = k * (0.1 + 0.16 * I);
    if (v === 0) { ring(cx, cy, R, true); if (I > 0.55) ring(cx + R * 0.35, cy + R * 0.25, R * 0.85, false); }
    else if (v === 1) {
      ring(cx, cy, R * 0.9, true); const n = 6 + Math.round(14 * I);
      for (let i = 0; i < n; i++) { const a = r() * 6.28, d = R * (1 + Math.pow(r(), 1.5) * 1.5), rd = k * (0.005 + r() * r() * 0.03), b = mkBlob(r, 0.2, 14), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; blobPath(g, x, y, rd, b); g.fillStyle = 'rgba(120,75,30,0.22)'; g.fill(); g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = k * 0.002; g.stroke(); }
    } else {
      const b = mkBlob(r, 0.22); const BR = R * 1.5;
      blobPath(g, cx, cy, BR, b); g.fillStyle = rad(g, cx, cy, BR, 'rgba(150,100,45,0.09)', 'rgba(125,80,32,0.22)'); g.fill();
      g.strokeStyle = 'rgba(95,55,20,0.42)'; g.lineWidth = k * 0.007; g.stroke();
      for (let i = 0; i < 2 + Math.round(2 * I); i++) { const x = cx + (r() - 0.5) * BR, w = k * (0.006 + r() * 0.01), len = BR * (0.5 + r() * 0.9); g.fillStyle = 'rgba(125,80,32,0.2)'; g.beginPath(); g.ellipse(x, cy + BR * 0.8 + len / 2, w, len / 2, 0, 0, 6.29); g.fill(); g.strokeStyle = 'rgba(95,55,20,0.35)'; g.lineWidth = k * 0.0018; g.stroke(); }
    }
  },
  blood(g, { W, H, k, I, v, r }) {
    const drop = (x: number, y: number, s: number, trail: number) => {
      const b = mkBlob(r, 0.18, 16);
      if (trail > 0) { g.fillStyle = 'rgba(86,8,12,0.8)'; g.beginPath(); g.moveTo(x - s * 0.45, y); g.lineTo(x - s * 0.18, y + trail); g.quadraticCurveTo(x, y + trail + s * 0.3, x + s * 0.18, y + trail); g.lineTo(x + s * 0.45, y); g.closePath(); g.fill(); }
      blobPath(g, x, y, s, b); g.fillStyle = rad(g, x, y, s * 1.1, 'rgba(125,16,20,0.78)', 'rgba(70,6,10,0.9)'); g.fill();
      g.strokeStyle = 'rgba(40,3,6,0.5)'; g.lineWidth = Math.max(0.6, k * 0.0016); g.stroke();
      g.fillStyle = 'rgba(170,50,40,0.22)'; g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.25, s * 0.3, s * 0.18, -0.6, 0, 6.29); g.fill();
    };
    if (v === 0) { const n = 3 + Math.round(7 * I); for (let i = 0; i < n; i++) { const s = k * (0.012 + Math.pow(r(), 2) * 0.05) * (0.6 + I); drop(W * (0.1 + r() * 0.8), H * (0.1 + r() * 0.7), s, r() < 0.5 ? s * (1 + r() * 4) : 0); } }
    else if (v === 1) {
      const ox = W * (0.3 + r() * 0.4), oy = H * (0.3 + r() * 0.4), ang = r() * 6.28, n = 40 + Math.round(160 * I);
      for (let i = 0; i < n; i++) {
        const dist = Math.pow(r(), 1.6) * k * (0.15 + 0.5 * I), a = ang + (r() - 0.5) * 1.6, x = ox + Math.cos(a) * dist, y = oy + Math.sin(a) * dist, sz = k * (0.002 + Math.pow(r(), 3) * 0.014);
        g.fillStyle = `rgba(${80 + r() * 40},8,12,${0.6 + r() * 0.3})`; g.beginPath(); g.ellipse(x, y, sz * (1 + dist / (k * 0.3)), sz * 0.7, a, 0, 6.29); g.fill();
      }
      drop(ox, oy, k * (0.015 + 0.03 * I), 0);
    } else {
      const x0 = W * (0.2 + r() * 0.3), y0 = H * (0.25 + r() * 0.3), x1 = x0 + W * (0.25 + r() * 0.3), y1 = y0 + (r() - 0.3) * H * 0.4;
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(95,8,12,0.88)'); gr.addColorStop(1, 'rgba(95,8,12,0.1)');
      g.lineCap = 'round'; const wd = k * (0.03 + 0.05 * I);
      for (let i = 0; i < 34; i++) { const o = (r() - 0.5) * wd; g.strokeStyle = gr; g.globalAlpha = 0.15 + r() * 0.35; g.lineWidth = wd * (0.05 + r() * 0.14); g.beginPath(); g.moveTo(x0 + o * 0.3, y0 + o); g.bezierCurveTo(x0 + (x1 - x0) * 0.3, y0 + o + (r() - 0.5) * wd * 0.6, x0 + (x1 - x0) * 0.7, y1 + o + (r() - 0.5) * wd * 0.6, x1, y1 + o * 0.5); g.stroke(); }
      g.globalAlpha = 1; drop(x0, y0, k * 0.02 * (0.6 + I), 0);
    }
  },
  mold(g, { W, H, k, I, v, r }) {
    if (v === 0) {
      const n = 3 + Math.round(5 * I);
      for (let i = 0; i < n; i++) {
        const cx = r() * W, cy = r() * H, R = k * (0.12 + 0.25 * r() * (0.5 + I)), b = mkBlob(r, 0.35);
        blobPath(g, cx, cy, R, b); g.fillStyle = rad(g, cx, cy, R, 'rgba(150,120,70,0.10)', 'rgba(120,90,45,0.22)'); g.fill();
        g.strokeStyle = 'rgba(100,70,30,0.32)'; g.lineWidth = k * 0.004; g.stroke();
        blobPath(g, cx, cy, R * 0.86, b); g.strokeStyle = 'rgba(100,70,30,0.14)'; g.lineWidth = k * 0.003; g.stroke();
      }
      for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H, rd = k * (0.1 + r() * 0.2); g.fillStyle = rad(g, x, y, rd, 'rgba(110,95,60,0.12)', 'rgba(110,95,60,0)'); g.fillRect(x - rd, y - rd, rd * 2, rd * 2); }
    } else {
      const n = 4 + Math.round(6 * I);
      for (let c = 0; c < n; c++) {
        const cx = r() * W, cy = r() * H, spread = k * (0.05 + r() * 0.12) * (0.6 + I);
        g.fillStyle = rad(g, cx, cy, spread * 2, 'rgba(85,105,70,0.16)', 'rgba(85,105,70,0)'); g.fillRect(cx - spread * 2, cy - spread * 2, spread * 4, spread * 4);
        const m = 40 + Math.round(70 * I);
        for (let i = 0; i < m; i++) {
          const a = r() * 6.28, d = Math.pow(r(), 1.4) * spread * 1.6, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, rd = k * (0.004 + r() * 0.018);
          g.fillStyle = rad(g, x, y, rd, r() < 0.2 ? 'rgba(15,20,12,0.7)' : 'rgba(40,55,35,0.55)', 'rgba(60,75,50,0)'); g.fillRect(x - rd, y - rd, rd * 2, rd * 2);
          if (r() < 0.25) { g.fillStyle = rad(g, x, y, rd * 1.8, 'rgba(160,170,140,0.22)', 'rgba(160,170,140,0)'); g.fillRect(x - rd * 2, y - rd * 2, rd * 4, rd * 4); }
        }
      }
    }
  },
};
const BLEND: Partial<Record<TexKey, GlobalCompositeOperation>> = { paper: 'multiply', mold: 'multiply', coffee: 'multiply', blood: 'multiply' };

let paperTile: HTMLCanvasElement | null = null;
function getPaperTile() {
  if (paperTile) return paperTile;
  const c = mk(256, 256), g = c.getContext('2d')!, id = g.createImageData(256, 256), rn = mulberry32(99);
  for (let i = 0; i < 256 * 256; i++) { const v = rn() * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return (paperTile = c);
}

/* ---------- Layer 6: handwriting ---------- */
function drawText(ctx: CanvasRenderingContext2D, st: State, W: number, H: number, k: number): TextBox | null {
  const t = st.text; if (!t.value.trim()) return null;
  const px = t.size / 100 * k; const font = `${Math.round(px)}px "${FONTS[t.font]}", "Segoe Script", cursive`;
  ctx.save(); ctx.font = font; ctx.textBaseline = 'alphabetic';
  const sp = t.spacing * px; const lh = px * 1.12; const maxW = W * 0.9;
  const wOf = (str: string) => { let w = 0; for (const ch of str) w += ctx.measureText(ch).width + sp; return Math.max(0, w - sp); };
  const lines: string[] = [];
  t.value.split('\n').forEach((para) => {
    let cur = '';
    for (const word of para.split(' ')) { const test = cur ? cur + ' ' + word : word; if (cur && wOf(test) > maxW) { lines.push(cur); cur = word; } else cur = test; }
    lines.push(cur);
  });
  const widths = lines.map(wOf);
  const bw = Math.max(...widths, px * 0.5), bh = lh * lines.length;
  const cx = t.x * W, cy = t.y * H; const rot = (t.rot * Math.PI) / 180; const rn = mulberry32(t.seed * 13 + 3);
  ctx.translate(cx, cy); ctx.rotate(rot);
  const ink = INKS[t.color]?.color ?? INKS[0].color; ctx.fillStyle = ink; ctx.shadowColor = ink; ctx.shadowBlur = px * 0.035;
  let idx = 0;
  lines.forEach((ln, li) => {
    let x = -widths[li] / 2; const y = -bh / 2 + lh * li + px * 0.85;
    for (const ch of ln) {
      const w = ctx.measureText(ch).width; idx++;
      ctx.save(); ctx.globalAlpha = t.opacity * (0.84 + rn() * 0.16);
      ctx.translate(x + w / 2, y + (rn() - 0.5) * px * 0.025); ctx.rotate((rn() - 0.5) * 0.025);
      ctx.fillText(ch, -w / 2, 0); ctx.restore(); x += w + sp;
    }
  });
  ctx.restore();
  return { cx, cy, w: bw, h: bh, rot };
}

/* ---------- ultraviolet light ---------- */
const hex3 = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); const n = m ? parseInt(m[1], 16) : 0x4a5cff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix3 = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const uvColor = (uv: UV) => (uv.tint >= UV_TINTS.length ? uv.custom : UV_TINTS[uv.tint]?.color ?? UV_TINTS[0].color);

/** Black-light grading of everything drawn so far: luminance → UV colour ramp, blended with the original, plus a fluorescent bloom. */
function applyUV(ctx: CanvasRenderingContext2D, W: number, H: number, uv: UV) {
  const id = ctx.getImageData(0, 0, W, H), d = id.data;
  let t0 = hex3(uvColor(uv));
  const lum0 = 0.3 * t0[0] + 0.59 * t0[1] + 0.11 * t0[2], sat = 0.25 + uv.sat * 1.25;
  t0 = t0.map((c) => Math.max(0, Math.min(255, lum0 + (c - lum0) * sat))) as [number, number, number];
  const dark = t0.map((c) => c * 0.07 + 2), midC = t0, light = mix3(t0, [236, 232, 255], 0.62);
  const con = 0.7 + uv.contrast * 1.1, br = 0.55 + uv.bright * 0.9, amt = uv.intensity;
  // 256-step ramp
  const ramp = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const y = i / 255; let c: number[];
    if (y < 0.5) c = mix3(dark, midC, Math.pow(y / 0.5, 0.9)); else c = mix3(midC, light, Math.pow((y - 0.5) / 0.5, 1.15));
    ramp[i * 3] = c[0] * br; ramp[i * 3 + 1] = c[1] * br; ramp[i * 3 + 2] = c[2] * br;
  }
  const keep = 0.12 * (1 - amt) + 0.1; // a hint of the original colour survives
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let y = (0.28 * r + 0.58 * g + 0.14 * b) / 255; y = (y - 0.5) * con + 0.5 + (uv.bright - 0.5) * 0.12;
    y = y < 0 ? 0 : y > 1 ? 1 : y; const o = ((y * 255) | 0) * 3;
    // fluorescent paper/highlights lean toward light blue-white; warm mid-tones drop out like under black light
    const rr = ramp[o] + (r * 0.35 - ramp[o]) * keep * 0.4, gg = ramp[o + 1] + (g * 0.35 - ramp[o + 1]) * keep * 0.4, bb = ramp[o + 2] + (b * 0.5 - ramp[o + 2]) * keep * 0.4;
    d[i] = r + (rr - r) * amt; d[i + 1] = g + (gg - g) * amt; d[i + 2] = b + (bb - b) * amt;
  }
  ctx.putImageData(id, 0, 0);
  // fluorescent bloom: downsample, keep only the highlights, upsample additively
  if (uv.fluor > 0.01) {
    const s = Math.max(4, Math.round(Math.max(W, H) / 220)), sw = Math.max(2, Math.round(W / s)), sh = Math.max(2, Math.round(H / s));
    const sm = mk(sw, sh), sg = sm.getContext('2d')!; sg.imageSmoothingQuality = 'high'; sg.drawImage(ctx.canvas, 0, 0, sw, sh);
    const sd = sg.getImageData(0, 0, sw, sh), a = sd.data;
    for (let i = 0; i < a.length; i += 4) { const y = (a[i] + a[i + 1] + a[i + 2]) / 765, k = Math.max(0, y - 0.38) * 1.9; a[i] *= k; a[i + 1] *= k; a[i + 2] *= k; }
    sg.putImageData(sd, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, uv.fluor * amt * 0.9); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sm, 0, 0, W, H); ctx.restore();
  }
}

/** Secret fluorescent message: bright core + soft halo + tighter outer glow. Drawn above the UV grade. */
function drawSecret(ctx: CanvasRenderingContext2D, st: State, W: number, H: number, k: number): TextBox | null {
  const t = st.secret; if (!t.value.trim()) return null;
  const px = t.size / 100 * k; ctx.save(); ctx.font = `${Math.round(px)}px "${FONTS[t.font]}", "Segoe Script", cursive`; ctx.textBaseline = 'alphabetic';
  const lh = px * 1.15, maxW = W * 0.9, sp = 0.01 * px;
  const wOf = (str: string) => { let w = 0; for (const ch of str) w += ctx.measureText(ch).width + sp; return Math.max(0, w - sp); };
  const lines: string[] = [];
  t.value.split('\n').forEach((para) => { let cur = ''; for (const word of para.split(' ')) { const test = cur ? cur + ' ' + word : word; if (cur && wOf(test) > maxW) { lines.push(cur); cur = word; } else cur = test; } lines.push(cur); });
  const widths = lines.map(wOf), bw = Math.max(...widths, px * 0.5), bh = lh * lines.length;
  const cx = t.x * W, cy = t.y * H, rot = (t.rot * Math.PI) / 180;
  const col = t.color >= NEONS.length ? t.custom : NEONS[t.color]?.color ?? NEONS[0].color;
  const core = mix3(hex3(col), [255, 255, 255], 0.38), coreS = `rgb(${core.map((c) => Math.round(c)).join(',')})`;
  const pass = (fill: string, blur: number, alpha: number, op: GlobalCompositeOperation) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalCompositeOperation = op; ctx.globalAlpha = Math.min(1, alpha) * t.opacity;
    ctx.fillStyle = fill; ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    lines.forEach((ln, li) => {
      let x = t.align === 'left' ? -bw / 2 : t.align === 'right' ? bw / 2 - widths[li] : -widths[li] / 2; const y = -bh / 2 + lh * li + px * 0.85;
      for (const ch of ln) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; }
    });
    ctx.restore();
  };
  if (t.halo > 0.01) { pass(col, px * (0.5 + t.halo * 1.6), 0.55 + t.halo * 0.45, 'screen'); pass(col, px * (0.25 + t.halo * 0.8), 0.6, 'screen'); }
  if (t.glow > 0.01) { pass(col, px * (0.06 + t.glow * 0.3), 0.5 + t.glow * 0.5, 'screen'); pass(col, px * 0.05 * (0.5 + t.glow), t.glow, 'screen'); }
  pass(col, 0, 1, 'source-over'); pass(coreS, px * 0.02, 0.9, 'source-over');
  ctx.restore();
  return { cx, cy, w: bw, h: bh, rot };
}

/* ---------- torn edges ---------- */
function fractal1D(rn: Rn, n: number, rough: number) {
  let size = 1; while (size < n) size *= 2;
  const a = new Float32Array(size + 1); a[0] = rn(); a[size] = rn();
  let step = size, amp = 1;
  while (step > 1) { const half = step / 2; for (let i = half; i < size; i += step) a[i] = (a[i - half] + a[i + half]) / 2 + (rn() - 0.5) * amp; amp *= rough; step = half; }
  let mn = Infinity, mx = -Infinity; for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const out = new Float32Array(n + 1); for (let i = 0; i <= n; i++) out[i] = (a[Math.round((i / n) * size)] - mn) / (mx - mn || 1);
  return out;
}
function tornPoly(W: number, H: number, k: number, I: number, v: number, sc: number, rn: Rn): [number, number][] {
  const A = k * (0.012 + 0.075 * I) * sc; const poly: [number, number][] = [];
  if (v === 2) {
    const S = k * (0.08 + 0.3 * I) * sc; const order = [0, 1, 2, 3].sort(() => rn() - 0.5); const cut = new Set(order.slice(0, I > 0.5 ? 2 : 1));
    const corners: [number, number][] = [[0, 0], [W, 0], [W, H], [0, H]];
    const chains: [[number, number], [number, number]][] = [[[0, S], [S, 0]], [[W - S, 0], [W, S]], [[W, H - S], [W - S, H]], [[S, H], [0, H - S]]];
    for (let c = 0; c < 4; c++) {
      if (!cut.has(c)) { poly.push(corners[c]); continue; }
      const [p0, p1] = chains[c]; const f = fractal1D(rn, 28, 0.6);
      const nx = (p1[1] - p0[1]), ny = -(p1[0] - p0[0]); const nl = Math.hypot(nx, ny) || 1;
      const sgn = c === 0 || c === 2 ? -1 : 1;
      for (let i = 0; i <= 28; i++) { const t = i / 28, o = (f[i] - 0.5) * S * 0.5 * Math.sin(Math.PI * t * 0.9 + 0.15); poly.push([p0[0] + (p1[0] - p0[0]) * t + (sgn * nx / nl) * o, p0[1] + (p1[1] - p0[1]) * t + (sgn * ny / nl) * o]); }
    }
    return poly;
  }
  const enabled = (side: number) => v === 0 || v === 1 || (v === 3 && side === 2) || (v === 4 && side === 0);
  const depths = (side: number, len: number) => {
    const n = Math.max(60, Math.min(900, Math.round(len / (k * 0.004)))); const d = new Float32Array(n + 1);
    if (!enabled(side)) return d;
    if (v === 1) { const p = k * 0.035 * sc; for (let i = 0; i <= n; i++) d[i] = A * 0.55 * (1 - Math.pow(Math.abs(Math.sin((Math.PI * (i / n) * len) / p)), 0.6)) + rn() * A * 0.06; }
    else { const f = fractal1D(rn, n, 0.56); for (let i = 0; i <= n; i++) d[i] = A * (0.12 + 0.88 * f[i]) + (rn() - 0.5) * A * 0.14; }
    return d;
  };
  const top = depths(0, W), right = depths(1, H), bottom = depths(2, W), left = depths(3, H);
  top.forEach((d, i) => poly.push([(i / (top.length - 1)) * W, d]));
  right.forEach((d, i) => poly.push([W - d, (i / (right.length - 1)) * H]));
  bottom.forEach((d, i) => poly.push([W - (i / (bottom.length - 1)) * W, H - d]));
  left.forEach((d, i) => poly.push([d, H - (i / (left.length - 1)) * H]));
  return poly;
}
function polyPath(c: CanvasRenderingContext2D, poly: [number, number][]) { c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }

/* ---------- Composition ---------- */
export function render(canvas: HTMLCanvasElement, src: Src, st: State, k: number, opt: { cache?: boolean } = {}): RenderOut {
  const L = layout(st, src.w, src.h);
  const pw = Math.max(8, Math.round(k)), ph = Math.max(8, Math.round(k / L.a));
  const px = Math.round(L.side * k), py = Math.round(L.top * k), pb = Math.round(L.bottom * k);
  const W = 2 * px + pw, H = py + ph + pb;
  canvas.width = W; canvas.height = H; // real alpha canvas, cleared transparent
  const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, W, H);
  const radius = L.radiusU * k;

  // frame / paper
  ctx.save(); rr(ctx, 0, 0, W, H, radius); ctx.clip();
  ctx.fillStyle = st.paper; ctx.fillRect(0, 0, W, H);
  ctx.save(); const sc = Math.max(0.5, k / 900); ctx.scale(sc, sc); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(getPaperTile(), 'repeat')!; ctx.fillRect(0, 0, W / sc, H / sc); ctx.restore();

  // photo (layers 1-3)
  const photo = getPhoto(src, st, L, pw, ph, !!opt.cache);
  ctx.drawImage(photo, px, py);
  if (L.side + L.top + L.bottom > 0) {
    const e = Math.max(2, k * 0.012); ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    const edges: [number, number, number, number, number, number, number, number][] = [[px, py, px, py + e, px, py, pw, e], [px, py + ph, px, py + ph - e, px, py + ph - e, pw, e], [px, py, px + e, py, px, py, e, ph], [px + pw, py, px + pw - e, py, px + pw - e, py, e, ph]];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(rx, ry, rw, rh); }
    ctx.restore();
  }

  // integrated text: sits under the textures, as if printed/written before the aging
  let textBox: TextBox | null = null;
  if (st.text.integrated) textBox = drawText(ctx, st, W, H, k);

  // physical textures (layer 4)
  const layer = mk(W, H), g = layer.getContext('2d')!;
  TEX_ORDER.forEach((key, idx) => {
    const t = st.textures[key]; const fn = DRAW[key]; if (!t.on || !fn) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1; g.setLineDash([]); g.save();
    g.translate(W / 2 + t.x * W, H / 2 + t.y * H); g.rotate((t.rot * Math.PI) / 180); g.scale(t.scale, t.scale); g.translate(-W / 2, -H / 2);
    fn(g, { W, H, k, px, py, pw, ph, I: t.intensity, v: t.variant, r: mulberry32(t.seed * 131 + idx * 17), L });
    g.restore();
    ctx.save();
    if (key === 'emulsion') { ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip(); }
    ctx.globalAlpha = t.opacity; ctx.globalCompositeOperation = BLEND[key] ?? 'source-over'; ctx.drawImage(layer, 0, 0); ctx.restore();
  });
  // paper edge shade
  rr(ctx, 0, 0, W, H, radius); ctx.strokeStyle = 'rgba(0,0,0,0.09)'; ctx.lineWidth = Math.max(1, k * 0.006); ctx.stroke();

  // torn edges: fibrous white rim (erase happens after the clip is released)
  const tt = st.textures.torn; let tornHole: [number, number][] | null = null;
  if (tt.on) {
    tornHole = tornPoly(W, H, k, tt.intensity, tt.variant, Math.max(0.3, tt.scale), mulberry32(tt.seed * 211 + 9));
    const fr = mulberry32(tt.seed * 53 + 1);
    ctx.save(); ctx.globalAlpha = tt.opacity; polyPath(ctx, tornHole); ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = k * (0.012 + 0.012 * tt.intensity); ctx.stroke();
    ctx.strokeStyle = 'rgba(247,244,235,0.97)'; ctx.lineWidth = k * (0.006 + 0.012 * tt.intensity); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,253,246,0.75)'; ctx.lineWidth = Math.max(0.6, k * 0.0009);
    for (let i = 0; i < tornHole.length; i += 2) {
      const [x, y] = tornHole[i], dx = W / 2 - x, dy = H / 2 - y, dl = Math.hypot(dx, dy) || 1, len = k * (0.004 + fr() * 0.016);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (dx / dl) * len + (fr() - 0.5) * len, y + (dy / dl) * len + (fr() - 0.5) * len); ctx.stroke();
    }
    ctx.restore();
  }

  // handwriting (layer 6)
  if (!st.text.integrated) textBox = drawText(ctx, st, W, H, k);

  // ultraviolet light (layer 7) grades everything above; the secret message (layer 8) glows on top of it
  let secretBox: TextBox | null = null;
  if (st.uv.on) {
    applyUV(ctx, W, H, st.uv);
    if (st.secret.on) secretBox = drawSecret(ctx, st, W, H, k);
  }
  ctx.restore();

  if (tornHole) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.rect(-8, -8, W + 16, H + 16); tornHole.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill('evenodd'); ctx.restore();
  }
  // frame wear: chips eat the alpha channel at the outline
  if (st.wear > 0) {
    const rn = mulberry32(st.frameSeed * 7 + 1), wr = st.wear;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    const n = Math.round(wr * 160);
    for (let i = 0; i < n; i++) {
      const rd = k * (0.002 + Math.pow(rn(), 2.6) * 0.012 * wr + 0.002 * wr * rn());
      const [x, y] = perimPoint(W, H, rn(), rn() * rd * 0.6);
      const b = mkBlob(rn, 0.45, 9); blobPath(ctx, x, y, rd, b); ctx.fill();
    }
    for (let c = 0; c < 4; c++) if (rn() < 0.4 + wr * 0.6) {
      const cxp = c % 2 ? W : 0, cyp = c < 2 ? 0 : H, rd = k * 0.02 * wr * (0.5 + rn());
      const b = mkBlob(rn, 0.5, 10); blobPath(ctx, cxp, cyp, rd, b); ctx.fill();
    }
    ctx.restore();
  }
  return { W, H, textBox, secretBox };
}

export function sampleScene(): HTMLCanvasElement {
  const c = mk(1200, 900), g = c.getContext('2d')!, rn = mulberry32(5);
  const sky = g.createLinearGradient(0, 0, 0, 560); sky.addColorStop(0, '#2a3a5c'); sky.addColorStop(0.55, '#a77b6a'); sky.addColorStop(1, '#e0b27a');
  g.fillStyle = sky; g.fillRect(0, 0, 1200, 900);
  g.fillStyle = rad(g, 880, 190, 110, 'rgba(255,240,210,0.95)', 'rgba(255,240,210,0)'); g.fillRect(700, 0, 400, 400);
  g.fillStyle = '#f6ecd0'; g.beginPath(); g.arc(880, 190, 34, 0, 6.29); g.fill();
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${rn() * 0.7})`; g.fillRect(rn() * 1200, rn() * 280, 2, 2); }
  g.fillStyle = '#1d2418'; g.beginPath(); g.moveTo(0, 560); for (let x = 0; x <= 1200; x += 60) g.lineTo(x, 540 + Math.sin(x * 0.01) * 30 + rn() * 10); g.lineTo(1200, 900); g.lineTo(0, 900); g.fill();
  g.fillStyle = '#2d3524'; g.fillRect(0, 640, 1200, 260);
  g.fillStyle = '#16140f'; g.fillRect(300, 380, 360, 270); g.beginPath(); g.moveTo(270, 390); g.lineTo(480, 270); g.lineTo(690, 390); g.fill();
  g.fillRect(560, 300, 40, 90);
  g.fillStyle = '#f2c46d'; g.fillRect(350, 460, 70, 90); g.fillRect(540, 460, 70, 90);
  g.fillStyle = rad(g, 385, 505, 140, 'rgba(255,200,110,0.4)', 'rgba(255,200,110,0)'); g.fillRect(240, 360, 300, 300);
  g.fillStyle = '#0d0c09'; g.fillRect(455, 520, 50, 130);
  g.strokeStyle = '#0d0c09'; g.lineWidth = 14; g.beginPath(); g.moveTo(130, 700); g.lineTo(130, 450); g.stroke();
  for (let i = 0; i < 40; i++) { g.fillStyle = '#10150d'; g.beginPath(); g.arc(130 + (rn() - 0.5) * 170, 420 + (rn() - 0.5) * 120, 22 + rn() * 26, 0, 6.29); g.fill(); }
  g.fillStyle = '#0d0c09'; for (let x = 720; x < 1180; x += 46) { g.fillRect(x, 610, 10, 80); } g.fillRect(715, 630, 470, 8); g.fillRect(715, 665, 470, 8);
  g.fillStyle = 'rgba(30,30,24,0.9)'; g.beginPath(); g.moveTo(470, 900); g.lineTo(500, 650); g.lineTo(520, 650); g.lineTo(640, 900); g.fill();
  return c;
}
