import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  State, TexKey, Tex, TEX_ORDER, TEX_META, FRAME_META, FrameKey, ASPECTS, FONTS, INKS, UV_TINTS, NEONS, ADJ_META, PRESETS,
  baseState, applyPreset, newSeed, Preset,
} from './types';
import { Src, TextBox, layout, render, exportK, sampleScene } from './engine';

type Tab = 'presets' | 'texturas' | 'molduras' | 'texto';
const TABS: [Tab, string][] = [['presets', 'Presets'], ['texturas', 'Texturas'], ['molduras', 'Molduras'], ['texto', 'Texto']];
const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
let srcCounter = 1;

function anchorText(s: State, src: Src): State {
  const L = layout(s, src.w, src.h);
  const y = L.bottom >= 0.12 ? (L.top + 1 / L.a + L.bottom / 2) / L.chU : (L.top + (1 / L.a) * 0.9) / L.chU;
  return { ...s, text: { ...s.text, x: 0.5, y, anchored: true } };
}
const clean = (s: State): State => ({ ...s, text: { ...s.text, value: '' } });

function Thumb({ src, st, side }: { src: Src; st: State; side: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(st);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const L = layout(st, src.w, src.h);
    render(c, src, st, Math.min(side / Math.max(L.cwU, L.chU), L.cropW));
  }, [src, key, side]);
  return <canvas ref={ref} className="thumb" aria-hidden="true" />;
}

const ICON: Record<string, string> = {
  upload: 'M12 15V4m0 0L8 8m4-4l4 4M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M4 19h16',
  restore: 'M4 12a8 8 0 108-8 8 8 0 00-5.7 2.4L4 9m0-5v5h5',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  waves: 'M3 7c2-2 3-2 5 0s3 2 5 0 3-2 5 0 2 1 3 0M3 12c2-2 3-2 5 0s3 2 5 0 3-2 5 0 2 1 3 0M3 17c2-2 3-2 5 0s3 2 5 0 3-2 5 0 2 1 3 0',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19',
  frame: 'M4 4h16v16H4zM8 8h8v8H8z',
  ratio: 'M3 7h18v10H3zM7 11h4',
  pen: 'M4 20l4-1 11-11a2 2 0 00-3-3L5 16l-1 4zM14 7l3 3',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  chevron: 'M6 9l6 6 6-6',
  logo: 'M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zM6 17l4.5-7 3 4 2-2.5L19 17z',
  compass: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5zM12 3v2m0 14v2M3 12h2m14 0h2',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z',
};
function Ic({ n, s = 18 }: { n: string; s?: number }) {
  return (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[n]} /></svg>);
}
function Group({ icon, title, open, children }: { icon: string; title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="grp" open={open}>
      <summary><Ic n={icon} /><span>{title}</span><i className="chev"><Ic n="chevron" s={16} /></i></summary>
      {children}
    </details>
  );
}
function Slider({ id, label, value, min, max, step = 0.01, onChange, fmt }: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="ctl">
      <label htmlFor={id}><span>{label}</span><output>{fmt ? fmt(value) : `${Math.round(value * 100)}%`}</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}
function Seg<T extends string | number>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([v, l]) => (<button key={String(v)} type="button" className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>))}
    </div>
  );
}

export default function App() {
  const [src, setSrc] = useState<Src | null>(null);
  const [thumbSrc, setThumbSrc] = useState<Src | null>(null);
  const [fileName, setFileName] = useState('');
  const [st, setSt] = useState<State>(() => applyPreset(baseState(), PRESETS[0]));
  const [tab, setTab] = useState<Tab>('presets');
  const [zoom, setZoom] = useState(1);
  const [avail, setAvail] = useState({ w: 600, h: 500 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [toastAct, setToastAct] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [tick, setTick] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [coarse] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  const [moveMode, setMoveMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [tab]);
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggleFull = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else bookRef.current?.requestFullscreen?.().catch(() => flash('Tela cheia indisponível aqui.')); } catch { flash('Tela cheia indisponível aqui.'); } };
  const boxRef = useRef<TextBox | null>(null);
  const secBoxRef = useRef<TextBox | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ dx: number; dy: number; which: 'text' | 'secret' } | null>(null);
  const sample = useMemo(() => { const c = sampleScene(); return { img: c, w: c.width, h: c.height, id: 0 } as Src; }, []);

  const flash = useCallback((m: string, act = false) => { setToast(m); setToastAct(act); window.setTimeout(() => setToast(''), act ? 10000 : 3800); }, []);

  const upd = useCallback((fn: (s: State) => State, reanchor = false) => {
    setSt((prev) => { let n = fn(prev); if (reanchor && n.text.anchored && src) n = anchorText(n, src); return n; });
  }, [src]);
  const setTex = (k: TexKey, p: Partial<Tex>) => upd((s) => ({ ...s, presetId: s.presetId, textures: { ...s.textures, [k]: { ...s.textures[k], ...p } } }));
  const setAdj = (k: string, v: number) => upd((s) => ({ ...s, adjust: { ...s.adjust, [k]: v } }));
  const setText = (p: Partial<State['text']>) => upd((s) => ({ ...s, text: { ...s.text, ...p } }));
  const setUV = (p: Partial<State['uv']>) => upd((s) => ({ ...s, uv: { ...s.uv, ...p } }));
  const setSecret = (p: Partial<State['secret']>) => upd((s) => ({ ...s, secret: { ...s.secret, ...p }, ...(p.on ? { uv: { ...s.uv, on: true } } : {}) }));

  /* ---- loading ---- */
  const loadBitmap = useCallback((img: CanvasImageSource, w: number, h: number, name: string) => {
    const s: Src = { img, w, h, id: srcCounter++ };
    const f = Math.min(1, 360 / Math.max(w, h)); const tc = document.createElement('canvas'); tc.width = Math.round(w * f); tc.height = Math.round(h * f);
    const g = tc.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, tc.width, tc.height);
    setThumbSrc({ img: tc, w: tc.width, h: tc.height, id: s.id + 100000 });
    setSrc(s); setFileName(name); setZoom(1);
    setSt((prev) => anchorText(prev, s));
  }, []);
  const loadFile = useCallback(async (file: File | undefined | null) => {
    if (!file || !file.type.startsWith('image/')) { if (file) flash('Esse arquivo não é uma imagem.'); return; }
    try {
      let bmp: ImageBitmap | HTMLImageElement;
      try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); }
      catch { bmp = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); }); }
      const w = (bmp as ImageBitmap).width || (bmp as HTMLImageElement).naturalWidth, h = (bmp as ImageBitmap).height || (bmp as HTMLImageElement).naturalHeight;
      loadBitmap(bmp, w, h, file.name);
    } catch { flash('Não foi possível abrir essa imagem.'); }
  }, [loadBitmap, flash]);
  const loadSample = () => loadBitmap(sample.img, sample.w, sample.h, 'cena-de-exemplo.png');

  useEffect(() => {
    const over = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const leave = (e: DragEvent) => { if (e.relatedTarget === null) setDragOver(false); };
    const drop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer?.files?.[0]); };
    const paste = (e: ClipboardEvent) => { const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith('image/')); if (f) loadFile(f); };
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('paste', paste); };
  }, [loadFile]);

  /* ---- stage size ---- */
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: Math.max(120, el.clientWidth - 40), h: Math.max(120, el.clientHeight - 40) }));
    ro.observe(el); return () => ro.disconnect();
  }, [src]);

  /* ---- fonts ---- */
  useEffect(() => {
    const f = FONTS[st.text.font];
    Promise.all([document.fonts.load(`40px "${f}"`, st.text.value || 'Aa'), document.fonts.ready]).then(() => setTick((t) => t + 1)).catch(() => {});
  }, [st.text.font, st.text.value === '']);
  useEffect(() => {
    if (!st.secret.on) return;
    Promise.all([document.fonts.load(`40px "${FONTS[st.secret.font]}"`, st.secret.value || 'Aa'), document.fonts.ready]).then(() => setTick((t) => t + 1)).catch(() => {});
  }, [st.secret.on, st.secret.font, st.secret.value === '']);

  /* ---- preview render ---- */
  const L = useMemo(() => (src ? layout(st, src.w, src.h) : null), [src, st.aspect, st.frame, st.thickness, st.corners]);
  const asp = L ? L.cwU / L.chU : 1;
  const fitW = Math.min(avail.w, avail.h * asp);
  useEffect(() => {
    if (!src || !L) return;
    const raf = requestAnimationFrame(() => {
      const c = canvasRef.current; if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const target = clamp(fitW * dpr * Math.ceil(Math.min(zoom, 3)), 500, 2400);
      const out = render(c, src, st, Math.min(target / L.cwU, L.cropW), { cache: true });
      boxRef.current = out.textBox; secBoxRef.current = out.secretBox; setDims((d) => (d.w === out.W && d.h === out.H ? d : { w: out.W, h: out.H }));
    });
    return () => cancelAnimationFrame(raf);
  }, [src, st, L, fitW, zoom, tick]);

  /* ---- drag text ---- */
  const toNorm = (e: React.PointerEvent) => { const c = canvasRef.current!; const r = c.getBoundingClientRect(); return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height, r }; };
  const hit = (e: React.PointerEvent): 'text' | 'secret' | null => {
    const c = canvasRef.current; if (!c) return null;
    const { u, v, r } = toNorm(e); const k = c.width / r.width; const pad = 16 * k;
    const inside = (b: TextBox | null) => {
      if (!b) return false;
      const dx = u * c.width - b.cx, dy = v * c.height - b.cy; const cs = Math.cos(-b.rot), sn = Math.sin(-b.rot);
      const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
      return Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad;
    };
    if (inside(secBoxRef.current)) return 'secret';
    return inside(boxRef.current) ? 'text' : null;
  };
  const onDown = (e: React.PointerEvent) => {
    if (coarse && !moveMode) return;
    const which = hit(e); if (!which) return; const { u, v } = toNorm(e); const o = which === 'secret' ? st.secret : st.text;
    drag.current = { dx: u - o.x, dy: v - o.y, which };
    canvasRef.current!.setPointerCapture(e.pointerId); canvasRef.current!.style.cursor = 'grabbing'; e.preventDefault();
  };
  const onMove = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    if (!drag.current) { c.style.cursor = hit(e) ? 'grab' : 'default'; return; }
    const { u, v } = toNorm(e); const d = drag.current;
    if (d.which === 'secret') setSecret({ x: clamp(u - d.dx, 0, 1), y: clamp(v - d.dy, 0, 1) });
    else setText({ x: clamp(u - d.dx, 0, 1), y: clamp(v - d.dy, 0, 1), anchored: false });
  };
  const onUp = (e: React.PointerEvent) => { if (drag.current) { drag.current = null; canvasRef.current!.releasePointerCapture(e.pointerId); canvasRef.current!.style.cursor = 'grab'; } };

  /* ---- export ---- */
  const doExport = async () => {
    if (!src || busy) return; setBusy(true);
    try {
      await Promise.all([document.fonts.load(`60px "${FONTS[st.text.font]}"`, st.text.value || 'Aa'), document.fonts.load(`60px "${FONTS[st.secret.font]}"`, st.secret.value || 'Aa'), document.fonts.ready]);
      await new Promise((r) => setTimeout(r, 40));
      let k = exportK(st, src, isMobile()); let blob: Blob | null = null; const c = document.createElement('canvas');
      for (let i = 0; i < 3 && !blob; i++) { render(c, src, st, k, { cache: false }); blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png')); k *= 0.7; }
      if (!blob) throw new Error('blob');
      const shown = URL.createObjectURL(blob); setLastUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return shown; });
      const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
      const filename = `evidencia-rpg-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
      const dl = await (window as any).claude?.use?.('downloads');
      if (dl) { try { await dl.save({ filename, data: blob }); flash(`PNG com transparência: ${c.width}×${c.height}px`, true); } catch (err: any) { if (err?.code !== 'declined') flash('Não foi possível salvar o arquivo aqui.'); } }
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); flash(`PNG com transparência: ${c.width}×${c.height}px`, true); }
    } catch { flash('Falha ao gerar o PNG. Tente uma imagem menor.'); }
    setBusy(false);
  };
  const exportDims = useMemo(() => { if (!src || !L) return ''; const k = exportK(st, src, isMobile()); return `${Math.round(L.cwU * k)}×${Math.round(L.chU * k)} px`; }, [src, L, st.aspect, st.frame, st.thickness]);

  const reset = () => { const s = applyPreset(baseState(), PRESETS[0]); setSt(src ? anchorText(s, src) : s); setZoom(1); flash('Edição restaurada.'); };

  /* ---- thumbnails ---- */
  const presetStates = useMemo(() => PRESETS.map((p) => clean(applyPreset(baseState(), p))), []);
  const frameStates = useMemo(() => (['polaroid', 'square', 'rect', 'worn', 'none'] as FrameKey[]).map((f) => {
    const b = clean(baseState()); const soft = f === 'polaroid' || f === 'square';
    return { f, s: { ...b, frame: f, corners: soft ? 'soft' : 'straight', wear: f === 'worn' ? 0.6 : 0, paper: st.paper, aspect: f === 'square' ? '1:1' : st.aspect } as State };
  }), [st.paper, st.aspect]);
  const texThumb = (k: TexKey, variant: number): State => { const b = clean(baseState()); return { ...b, frame: 'none', corners: 'straight', textures: { ...b.textures, [k]: { ...b.textures[k], on: true, intensity: 0.8, opacity: 0.95, variant } } }; };

  const pickPreset = (p: Preset) => upd((s) => applyPreset(s, p), true);
  const pickFrame = (f: FrameKey) => upd((s) => {
    const soft = f === 'polaroid' || f === 'square';
    return { ...s, frame: f, corners: soft ? 'soft' : 'straight', wear: f === 'worn' ? Math.max(s.wear, 0.55) : s.wear, aspect: f === 'square' ? '1:1' : s.aspect };
  }, true);

  const cssW = fitW * zoom, cssH = cssW / asp;
  const caseNo = String(src ? (src.id % 9000) + 1 : 0).padStart(4, '0');

  return (
    <div className={'app' + (src ? '' : ' empty')} ref={bookRef}>
      <header className="top">
        <div className="brand">
          <span className="logo-ic"><Ic n="logo" s={26} /></span>
          <div>
            <h1>evidencia<span>.rpg</span></h1>
            <p>LABORATÓRIO DE EVIDÊNCIAS FOTOGRÁFICAS</p>
          </div>
        </div>
        <div className="stamp" aria-hidden="true"><span>EVIDÊNCIA</span><b>Nº {caseNo}</b></div>
        <div className="acts">
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()} aria-label="Carregar outra imagem" title="Carregar outra imagem"><Ic n="upload" s={16} /><span>Carregar outra imagem</span></button>
          <button type="button" className="ghost dsk" onClick={reset} aria-label="Restaurar edição" title="Restaurar edição"><Ic n="restore" s={16} /><span>Restaurar edição</span></button>
          {canFull && <button type="button" className="ghost dsk sq" onClick={toggleFull} aria-label="Tela cheia" title="Tela cheia"><Ic n="full" s={16} /></button>}
          <button type="button" className="dl dsk" onClick={doExport} disabled={!src || busy}><Ic n="download" s={16} />{busy ? 'Renderizando…' : 'Baixar PNG'}</button>
        </div>
        <input ref={fileRef} id="file-input" type="file" accept="image/*" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
      </header>

      <main className="work">
        <section className="left" aria-label="Pré-visualização">
          <div className="stage">
            {!src ? (
              <div className={'drop' + (dragOver ? ' over' : '')}>
                <span className="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="M21 15l-4.5-4.5L6 21" /></svg></span>
                <h2>Enviar Evidência</h2>
                <p className="sub"></p>
                <button type="button" className="dl" onClick={() => fileRef.current?.click()}><Ic n="folder" s={16} />Selecionar Arquivo</button>
                <button type="button" className="lnk" onClick={loadSample}>ou testar com uma cena de exemplo</button>
              </div>
            ) : (
              <div className="scroll" ref={stageRef}>
                <div className="plate" style={{ width: cssW, height: cssH }}>
                  <canvas ref={canvasRef} className="photo" style={{ width: cssW, height: cssH, touchAction: st.text.value && (!coarse || moveMode) ? 'none' : 'auto' }}
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="img" aria-label="Fotografia editada" />
                </div>
              </div>
            )}
          </div>
          {src && (
            <div className="bar">
              <div className="zoom">
                <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((z) => clamp(+(z - 0.25).toFixed(2), 0.25, 4))}>−</button>
                <input id="zoom" aria-label="Zoom" type="range" min={0.25} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
                <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((z) => clamp(+(z + 0.25).toFixed(2), 0.25, 4))}>+</button>
                <button type="button" className="fit" title="Ajustar à tela" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              </div>
              {coarse && st.text.value.trim() && (<button type="button" className={'mv' + (moveMode ? ' on' : '')} aria-pressed={moveMode} onClick={() => setMoveMode((m) => !m)}>{moveMode ? 'Mover texto: ligado' : 'Mover texto'}</button>)}
              <span className="cat meta">{fileName.length > 24 ? fileName.slice(0, 22) + '…' : fileName} · EXPORTA {exportDims} · PNG ALFA</span>
            </div>
          )}
        </section>

        <aside className="panel" aria-label="Ferramentas de edição">
          <div className="tabs" role="tablist">
            {TABS.map(([k, l], i) => (<button key={k} role="tab" aria-selected={tab === k} className={'tab t-' + k + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><b>{String(i + 1).padStart(2, '0')}</b>{l}</button>))}
          </div>
          <div className="sheet-in">
            <div className="body" role="tabpanel" ref={bodyRef}>
              {!src && <p className="hint">Carregue uma fotografia para liberar as ferramentas. Os presets, as texturas e as molduras aparecem aqui já aplicados sobre a sua imagem.</p>}

              {tab === 'presets' && (
                <>
                  <Group icon="layers" title="Presets" open>
                    <div className="grid">
                      {PRESETS.map((p, i) => (
                        <button key={p.id} type="button" className={'card' + (st.presetId === p.id ? ' on' : '')} onClick={() => src && pickPreset(p)} disabled={!src} aria-pressed={st.presetId === p.id}>
                          <span className="tw">{thumbSrc ? <Thumb src={thumbSrc} st={presetStates[i]} side={150} /> : <span className="ph" />}<i className="dot" /></span>
                          <span className="lb"><em>{String(i + 1).padStart(2, '0')}</em>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </Group>
                  <Group icon="sun" title="Ajustes finos" open>
                    <div className="stack">
                      {ADJ_META.map((a) => (<Slider key={a.key} id={'adj-' + a.key} label={a.label} min={a.min} max={a.max} value={st.adjust[a.key]} onChange={(v) => setAdj(a.key, v)} />))}
                    </div>
                  </Group>
                </>
              )}

              {tab === 'texturas' && (
                <Group icon="waves" title="Texturas" open>
                  <div className="texlist">
                    {TEX_ORDER.map((k) => {
                      const m = TEX_META[k], t = st.textures[k];
                      return (
                        <details key={k} className={'tex' + (t.on ? ' active' : '')}>
                          <summary>
                            <span className="sw"><Thumb src={sample} st={texThumb(k, t.variant)} side={72} /></span>
                            <span className="nm">{m.label}<small>{m.hint}</small></span>
                            <label className="sw-toggle" onClick={(e) => e.stopPropagation()}>
                              <input id={'tex-on-' + k} type="checkbox" checked={t.on} aria-label={`Ativar ${m.label}`} onChange={(e) => setTex(k, { on: e.target.checked })} />
                              <span aria-hidden="true" />
                            </label>
                          </summary>
                          <div className="stack">
                            <Slider id={`tex-i-${k}`} label="Intensidade" min={0} max={1} value={t.intensity} onChange={(v) => setTex(k, { intensity: v, on: true })} />
                            <Slider id={`tex-o-${k}`} label="Opacidade" min={0} max={1} value={t.opacity} onChange={(v) => setTex(k, { opacity: v, on: true })} />
                            <div className="ctl"><label><span>Padrão</span></label><Seg label="Padrão" items={m.variants.map((v, i) => [i, v] as [number, string])} value={t.variant} onChange={(v) => setTex(k, { variant: v, on: true })} /></div>
                            {m.scaleOnly && (<Slider id={`tex-s-${k}`} label="Escala do rasgo" min={0.4} max={2.2} value={t.scale} onChange={(v) => setTex(k, { scale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />)}
                            {m.transform && (<>
                              <Slider id={`tex-x-${k}`} label="Posição horizontal" min={-0.5} max={0.5} value={t.x} onChange={(v) => setTex(k, { x: v })} fmt={(v) => `${Math.round(v * 100)}`} />
                              <Slider id={`tex-y-${k}`} label="Posição vertical" min={-0.5} max={0.5} value={t.y} onChange={(v) => setTex(k, { y: v })} fmt={(v) => `${Math.round(v * 100)}`} />
                              <Slider id={`tex-s-${k}`} label="Escala" min={0.4} max={2.2} value={t.scale} onChange={(v) => setTex(k, { scale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                              <Slider id={`tex-r-${k}`} label="Rotação" min={-180} max={180} step={1} value={t.rot} onChange={(v) => setTex(k, { rot: v })} fmt={(v) => `${Math.round(v)}°`} />
                            </>)}
                            <button type="button" className="ghost sm" onClick={() => setTex(k, { seed: newSeed(), on: true })}>Gerar nova variação</button>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </Group>
              )}

              {tab === 'molduras' && (
                <>
                  <Group icon="frame" title="Moldura" open>
                    <div className="grid">
                      {frameStates.map(({ f, s }) => (
                        <button key={f} type="button" className={'card' + (st.frame === f ? ' on' : '')} onClick={() => src && pickFrame(f)} disabled={!src} aria-pressed={st.frame === f}>
                          <span className="tw">{thumbSrc ? <Thumb src={thumbSrc} st={s} side={150} /> : <span className="ph" />}<i className="dot" /></span>
                          <span className="lb">{FRAME_META[f].label}</span>
                        </button>
                      ))}
                    </div>
                  </Group>
                  <Group icon="ratio" title="Proporção da fotografia" open>
                    <div className="stack"><Seg label="Proporção" items={ASPECTS.map(([k, l]) => [k, l] as [string, string])} value={st.aspect} onChange={(v) => upd((s) => ({ ...s, aspect: v }), true)} /></div>
                  </Group>
                  <Group icon="sun" title="Papel e bordas" open>
                    <div className="stack">
                      <div className="ctl"><label htmlFor="paper-color"><span>Cor do papel</span><output>{st.paper}</output></label>
                        <div className="swatches">
                          {['#f4efe2', '#f7f4ec', '#efe3c6', '#e6d4a5', '#e2d6b6', '#d9d4c6', '#cfc7b4', '#1e1f21'].map((c) => (<button key={c} type="button" aria-label={`Papel ${c}`} aria-pressed={st.paper === c} className={st.paper === c ? 'on' : ''} style={{ background: c }} onClick={() => upd((s) => ({ ...s, paper: c }))} />))}
                          <input id="paper-color" type="color" value={st.paper} onChange={(e) => upd((s) => ({ ...s, paper: e.target.value }))} />
                        </div>
                      </div>
                      <Slider id="thickness" label="Espessura das bordas" min={0.4} max={2} value={st.thickness} onChange={(v) => upd((s) => ({ ...s, thickness: v }), true)} fmt={(v) => `${Math.round(v * 100)}%`} />
                      <Slider id="wear" label="Desgaste das bordas" min={0} max={1} value={st.wear} onChange={(v) => upd((s) => ({ ...s, wear: v }))} />
                      <button type="button" className="ghost sm" onClick={() => upd((s) => ({ ...s, frameSeed: newSeed() }))}>Gerar novo desgaste</button>
                      <div className="ctl"><label><span>Cantos</span></label><Seg label="Cantos" items={[['straight', 'Retos'], ['soft', 'Levemente arredondados']]} value={st.corners} onChange={(v) => upd((s) => ({ ...s, corners: v }))} /></div>
                    </div>
                  </Group>
                </>
              )}

              {tab === 'texto' && (
                <>
                  <Group icon="pen" title="Anotação manuscrita" open>
                    <div className="stack">
                      <div className="ctl"><label htmlFor="note"><span>Texto</span><output>{st.text.value.length}</output></label>
                        <textarea id="note" rows={3} value={st.text.value} placeholder="CASO 017 — Encontrada próximo à residência." onChange={(e) => setText({ value: e.target.value })} /></div>
                      <label className={'integ' + (st.text.integrated ? ' on' : '')} htmlFor="t-integ">
                        <span className="nm">Integrar à foto<small>{st.text.integrated ? 'Ativo: o texto fica sob as texturas, como se já estivesse na foto antes do desgaste.' : 'Desativado: o texto fica por cima de tudo.'}</small></span>
                        <span className="sw-toggle">
                          <input id="t-integ" type="checkbox" checked={st.text.integrated} aria-label="Integrar texto à foto" onChange={(e) => setText({ integrated: e.target.checked })} />
                          <span aria-hidden="true" />
                        </span>
                      </label>
                      <p className="hint">Arraste o texto diretamente sobre a fotografia. Apague o campo para remover a anotação.</p>
                      <div className="ctl"><label><span>Fonte</span></label>
                        <div className="fonts">{FONTS.map((f, i) => (<button key={f} type="button" aria-pressed={st.text.font === i} className={st.text.font === i ? 'on' : ''} style={{ fontFamily: `"${f}", cursive` }} onClick={() => setText({ font: i })}>{f}</button>))}</div></div>
                      <div className="ctl"><label><span>Cor da tinta</span></label>
                        <div className="inks">{INKS.map((c, i) => (<button key={c.name} type="button" aria-pressed={st.text.color === i} className={st.text.color === i ? 'on' : ''} onClick={() => setText({ color: i })}><i style={{ background: c.color }} />{c.name}</button>))}</div></div>
                    </div>
                  </Group>
                  <Group icon="sun" title="Traço e posição" open>
                    <div className="stack">
                      <Slider id="t-size" label="Tamanho da fonte" min={2} max={18} step={0.1} value={st.text.size} onChange={(v) => setText({ size: v })} fmt={(v) => v.toFixed(1)} />
                      <Slider id="t-rot" label="Rotação" min={-30} max={30} step={0.5} value={st.text.rot} onChange={(v) => setText({ rot: v })} fmt={(v) => `${v.toFixed(1)}°`} />
                      <Slider id="t-op" label="Opacidade da tinta" min={0.3} max={1} value={st.text.opacity} onChange={(v) => setText({ opacity: v })} />
                      <Slider id="t-sp" label="Espaçamento entre letras" min={-0.05} max={0.3} value={st.text.spacing} onChange={(v) => setText({ spacing: v })} fmt={(v) => `${Math.round(v * 100)}`} />
                      <Slider id="t-x" label="Posição horizontal" min={0} max={1} value={st.text.x} onChange={(v) => setText({ x: v, anchored: false })} fmt={(v) => `${Math.round(v * 100)}`} />
                      <Slider id="t-y" label="Posição vertical" min={0} max={1} value={st.text.y} onChange={(v) => setText({ y: v, anchored: false })} fmt={(v) => `${Math.round(v * 100)}`} />
                      <button type="button" className="ghost sm" onClick={() => src && upd((s) => anchorText(s, src))} disabled={!src}>{st.frame === 'polaroid' || st.frame === 'square' ? 'Posicionar na borda inferior' : 'Posicionar na base da foto'}</button>
                    </div>
                  </Group>
                  <Group icon="sun" title="Luz ultravioleta (UV)">
                    <div className="stack">
                      <label className={'integ' + (st.uv.on ? ' on' : '')} htmlFor="uv-on">
                        <span className="nm">Ativar luz UV<small>{st.uv.on ? 'Ativa: a composição inteira é vista sob luz negra.' : 'Desativada: a composição aparece normal. Seus ajustes ficam guardados.'}</small></span>
                        <span className="sw-toggle">
                          <input id="uv-on" type="checkbox" checked={st.uv.on} aria-label="Ativar luz ultravioleta" onChange={(e) => setUV({ on: e.target.checked })} />
                          <span aria-hidden="true" />
                        </span>
                      </label>
                      <div className="ctl"><label><span>Cor da iluminação</span></label>
                        <div className="inks">
                          {UV_TINTS.map((c, i) => (<button key={c.name} type="button" aria-pressed={st.uv.tint === i} className={st.uv.tint === i ? 'on' : ''} onClick={() => setUV({ tint: i, on: true })}><i style={{ background: c.color }} />{c.name}</button>))}
                          <button type="button" aria-pressed={st.uv.tint >= UV_TINTS.length} className={'cust' + (st.uv.tint >= UV_TINTS.length ? ' on' : '')} onClick={() => setUV({ tint: UV_TINTS.length, on: true })}><i style={{ background: st.uv.custom }} />Personalizada
                            <input type="color" aria-label="Cor UV personalizada" value={st.uv.custom} onClick={(e) => e.stopPropagation()} onChange={(e) => setUV({ custom: e.target.value, tint: UV_TINTS.length, on: true })} /></button>
                        </div></div>
                      <Slider id="uv-i" label="Intensidade da iluminação" min={0} max={1} value={st.uv.intensity} onChange={(v) => setUV({ intensity: v })} />
                      <Slider id="uv-s" label="Saturação da tonalidade" min={0} max={1} value={st.uv.sat} onChange={(v) => setUV({ sat: v })} />
                      <Slider id="uv-b" label="Brilho da iluminação" min={0} max={1} value={st.uv.bright} onChange={(v) => setUV({ bright: v })} />
                      <Slider id="uv-c" label="Contraste da composição" min={0} max={1} value={st.uv.contrast} onChange={(v) => setUV({ contrast: v })} />
                      <Slider id="uv-f" label="Efeito fluorescente" min={0} max={1} value={st.uv.fluor} onChange={(v) => setUV({ fluor: v })} />
                    </div>
                  </Group>
                  <Group icon="pen" title="Texto UV secreto">
                    <div className="stack">
                      <label className={'integ' + (st.secret.on ? ' on' : '')} htmlFor="sec-on">
                        <span className="nm">Ativar texto UV secreto<small>Mensagem fluorescente que só aparece com a luz UV ligada (ativar liga a luz UV).</small></span>
                        <span className="sw-toggle">
                          <input id="sec-on" type="checkbox" checked={st.secret.on} aria-label="Ativar texto UV secreto" onChange={(e) => setSecret({ on: e.target.checked })} />
                          <span aria-hidden="true" />
                        </span>
                      </label>
                      {st.secret.on && (<>
                        <div className="ctl"><label htmlFor="secret"><span>Mensagem secreta</span><output>{st.secret.value.length}</output></label>
                          <textarea id="secret" rows={3} value={st.secret.value} placeholder="ELES ESTÃO AQUI" onChange={(e) => setSecret({ value: e.target.value })} /></div>
                        {!st.uv.on && <p className="hint">A luz UV está desligada: a mensagem fica oculta até você ativá-la.</p>}
                        <p className="hint">Arraste a mensagem sobre a fotografia (ela fica acima do texto normal).</p>
                        <div className="ctl"><label><span>Fonte</span></label>
                          <div className="fonts">{FONTS.map((f, i) => (<button key={f} type="button" aria-pressed={st.secret.font === i} className={st.secret.font === i ? 'on' : ''} style={{ fontFamily: `"${f}", cursive` }} onClick={() => setSecret({ font: i })}>{f}</button>))}</div></div>
                        <div className="ctl"><label><span>Cor fluorescente</span></label>
                          <div className="inks">
                            {NEONS.map((c, i) => (<button key={c.name} type="button" aria-pressed={st.secret.color === i} className={st.secret.color === i ? 'on' : ''} onClick={() => setSecret({ color: i })}><i style={{ background: c.color }} />{c.name}</button>))}
                            <button type="button" aria-pressed={st.secret.color >= NEONS.length} className={'cust' + (st.secret.color >= NEONS.length ? ' on' : '')} onClick={() => setSecret({ color: NEONS.length })}><i style={{ background: st.secret.custom }} />Personalizada
                              <input type="color" aria-label="Cor neon personalizada" value={st.secret.custom} onClick={(e) => e.stopPropagation()} onChange={(e) => setSecret({ custom: e.target.value, color: NEONS.length })} /></button>
                          </div></div>
                        <div className="ctl"><label><span>Alinhamento</span></label><Seg label="Alinhamento" items={[['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']] as ['left' | 'center' | 'right', string][]} value={st.secret.align} onChange={(v) => setSecret({ align: v })} /></div>
                        <Slider id="s-size" label="Tamanho da fonte" min={2} max={18} step={0.1} value={st.secret.size} onChange={(v) => setSecret({ size: v })} fmt={(v) => v.toFixed(1)} />
                        <Slider id="s-op" label="Opacidade" min={0.2} max={1} value={st.secret.opacity} onChange={(v) => setSecret({ opacity: v })} />
                        <Slider id="s-glow" label="Intensidade do brilho" min={0} max={1} value={st.secret.glow} onChange={(v) => setSecret({ glow: v })} />
                        <Slider id="s-halo" label="Intensidade do halo luminoso" min={0} max={1} value={st.secret.halo} onChange={(v) => setSecret({ halo: v })} />
                        <Slider id="s-rot" label="Rotação" min={-45} max={45} step={0.5} value={st.secret.rot} onChange={(v) => setSecret({ rot: v })} fmt={(v) => `${v.toFixed(1)}°`} />
                        <Slider id="s-x" label="Posição horizontal" min={0} max={1} value={st.secret.x} onChange={(v) => setSecret({ x: v })} fmt={(v) => `${Math.round(v * 100)}`} />
                        <Slider id="s-y" label="Posição vertical" min={0} max={1} value={st.secret.y} onChange={(v) => setSecret({ y: v })} fmt={(v) => `${Math.round(v * 100)}`} />
                      </>)}
                    </div>
                  </Group>
                </>
              )}
            </div>
            <div className="foot">
              <button type="button" className="ghost rst" onClick={reset} aria-label="Restaurar edição" title="Restaurar edição"><Ic n="restore" s={16} />Restaurar</button>
              <button type="button" className="dl" onClick={doExport} disabled={!src || busy}><Ic n="download" s={16} />{busy ? 'Renderizando…' : 'Baixar PNG'}</button>
            </div>
          </div>
        </aside>
      </main>

      {toast && <div className="toast" role="status"><span>{toast}</span>{toastAct && lastUrl && <button type="button" onClick={() => { setModal(true); setToast(''); }}>Não baixou? Ver imagem</button>}</div>}
      {modal && lastUrl && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Imagem exportada" onClick={() => setModal(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p>Se o download não iniciou (alguns sites bloqueiam), clique com o botão direito na imagem e escolha <b>Salvar imagem como…</b>. No celular, pressione e segure a imagem.</p>
            <div className="mimg"><img src={lastUrl} alt="Fotografia exportada em PNG com fundo transparente" /></div>
            <div className="row"><a className="ghost" href={lastUrl} download="evidencia-rpg.png" target="_blank" rel="noopener">Tentar baixar de novo</a><button type="button" className="dl" onClick={() => setModal(false)}>Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
