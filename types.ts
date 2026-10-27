export type TexKey = 'grain' | 'dust' | 'scratches' | 'paper' | 'creases' | 'edges' | 'torn' | 'emulsion' | 'coffee' | 'blood' | 'mold';
export type FrameKey = 'polaroid' | 'square' | 'rect' | 'worn' | 'none';

export interface Tex { on: boolean; intensity: number; opacity: number; variant: number; seed: number; x: number; y: number; scale: number; rot: number }
export interface Adjust { exposure: number; contrast: number; saturation: number; temperature: number; tint: number; fade: number; sepia: number; mono: number; vignette: number; soften: number }
export interface TextState { value: string; font: number; size: number; color: number; rot: number; opacity: number; spacing: number; x: number; y: number; seed: number; anchored: boolean; integrated: boolean }
export interface UV { on: boolean; tint: number; custom: string; intensity: number; sat: number; bright: number; contrast: number; fluor: number }
export interface Secret { on: boolean; value: string; font: number; size: number; color: number; custom: string; opacity: number; x: number; y: number; rot: number; align: 'left' | 'center' | 'right'; glow: number; halo: number }
export interface State {
  aspect: string; frame: FrameKey; paper: string; thickness: number; wear: number; corners: 'straight' | 'soft'; frameSeed: number;
  adjust: Adjust; textures: Record<TexKey, Tex>; text: TextState; presetId: string | null; uv: UV; secret: Secret;
}

export const TEX_ORDER: TexKey[] = ['grain', 'paper', 'mold', 'emulsion', 'coffee', 'blood', 'dust', 'scratches', 'creases', 'edges', 'torn'];

export const TEX_META: Record<TexKey, { label: string; variants: string[]; transform: boolean; scaleOnly?: boolean; hint: string }> = {
  grain: { label: 'Grão de filme', variants: ['fino', 'médio', 'grosso'], transform: false, hint: 'Ruído orgânico, mais forte nos tons médios.' },
  dust: { label: 'Poeira', variants: ['pontos', 'fibras', 'mista'], transform: false, hint: 'Partículas claras e escuras, fibras soltas.' },
  scratches: { label: 'Arranhões', variants: ['verticais', 'aleatórios', 'profundos'], transform: false, hint: 'Riscos de manuseio e de película.' },
  paper: { label: 'Papel amarelado', variants: ['creme', 'âmbar', 'sépia'], transform: false, hint: 'Envelhecimento do suporte, mais escuro nas bordas.' },
  creases: { label: 'Dobras e vincos', variants: ['cruz', 'horizontal', 'vertical', 'diagonal', 'amassada'], transform: true, hint: 'Sombra e realce suaves ao longo da dobra.' },
  edges: { label: 'Bordas desgastadas', variants: ['clareadas', 'escurecidas', 'ambas'], transform: false, hint: 'Abrasão e queima ao longo do contorno.' },
  torn: { label: 'Bordas rasgadas', variants: ['todas as bordas', 'serrilhado', 'cantos arrancados', 'só inferior', 'só superior'], transform: false, scaleOnly: true, hint: 'Rasga o contorno. A opacidade controla a fibra branca exposta.' },
  emulsion: { label: 'Falhas de emulsão', variants: ['manchas', 'rachaduras', 'bolhas'], transform: true, hint: 'Áreas onde a imagem se soltou do papel.' },
  coffee: { label: 'Manchas de café', variants: ['anel', 'respingos', 'derramado'], transform: true, hint: 'Anéis irregulares e respingos translúcidos.' },
  blood: { label: 'Mancha avermelhada', variants: ['gotas', 'respingo', 'rastro'], transform: true, hint: 'Sangue seco cenográfico, tom escurecido.' },
  mold: { label: 'Umidade e mofo', variants: ['umidade', 'mofo'], transform: true, hint: 'Marcas de infiltração e colônias esverdeadas.' },
};

export const FRAME_META: Record<FrameKey, { label: string; side: number; top: number; bottom: number; soft: number }> = {
  polaroid: { label: 'Polaroid clássica', side: 0.075, top: 0.075, bottom: 0.32, soft: 0.012 },
  square: { label: 'Instantânea quadrada', side: 0.06, top: 0.06, bottom: 0.2, soft: 0.035 },
  rect: { label: 'Retangular tradicional', side: 0.045, top: 0.045, bottom: 0.045, soft: 0.01 },
  worn: { label: 'Bordas desgastadas', side: 0.05, top: 0.05, bottom: 0.05, soft: 0.008 },
  none: { label: 'Sem moldura', side: 0, top: 0, bottom: 0, soft: 0.02 },
};

export const ASPECTS: [string, string, number][] = [
  ['original', 'Original', 0], ['1:1', '1:1', 1], ['4:3', '4:3', 4 / 3], ['3:4', '3:4', 3 / 4],
  ['3:2', '3:2', 1.5], ['2:3', '2:3', 2 / 3], ['4:5', '4:5', 0.8], ['16:9', '16:9', 16 / 9],
];

export const FONTS = ['Caveat', 'Grape Nuts', 'The Girl Next Door', 'Kalam', 'Nothing You Could Do', 'Marck Script'];
export const INKS: { name: string; color: string }[] = [
  { name: 'Azul', color: '#1c2f78' }, { name: 'Preta', color: '#141416' }, { name: 'Vermelha escura', color: '#6e1212' }, { name: 'Branca', color: '#f4f1e8' },
];

export const ADJ0: Adjust = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, fade: 0, sepia: 0, mono: 0, vignette: 0, soften: 0 };
export const ADJ_META: { key: keyof Adjust; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'Exposição', min: -1, max: 1 }, { key: 'contrast', label: 'Contraste', min: -1, max: 1 },
  { key: 'saturation', label: 'Saturação', min: -1, max: 1 }, { key: 'temperature', label: 'Temperatura', min: -1, max: 1 },
  { key: 'tint', label: 'Matiz (verde/magenta)', min: -1, max: 1 }, { key: 'fade', label: 'Desbotamento', min: 0, max: 1 },
  { key: 'sepia', label: 'Sépia', min: 0, max: 1 }, { key: 'mono', label: 'Preto e branco', min: 0, max: 1 },
  { key: 'vignette', label: 'Vinheta', min: 0, max: 1 }, { key: 'soften', label: 'Foco suave', min: 0, max: 1 },
];

const rs = () => Math.floor(Math.random() * 1e6);
export const TEX0 = (i: number): Tex => ({ on: false, intensity: 0.5, opacity: 0.8, variant: 0, seed: 1000 + i * 77, x: 0, y: 0, scale: 1, rot: 0 });

export const defaultText = (): TextState => ({ value: 'CASO 017 — Encontrada próximo à residência.', font: 0, size: 6.5, color: 0, rot: -2, opacity: 0.92, spacing: 0.01, x: 0.5, y: 0.88, seed: 7, anchored: true, integrated: false });

export const UV_TINTS: { name: string; color: string }[] = [
  { name: 'Azul elétrico', color: '#2f55ff' }, { name: 'Azul profundo', color: '#1a2fb0' }, { name: 'Violeta', color: '#7b3cff' },
  { name: 'Roxo', color: '#5a1f9a' }, { name: 'Ciano azulado', color: '#1f9bff' },
];
export const NEONS: { name: string; color: string }[] = [
  { name: 'Verde-limão', color: '#b6ff1a' }, { name: 'Ciano neon', color: '#19f2ff' }, { name: 'Amarelo', color: '#fff53a' },
  { name: 'Magenta', color: '#ff2bd6' }, { name: 'Laranja', color: '#ff8a1f' },
];
export const defaultUV = (): UV => ({ on: false, tint: 0, custom: '#4a5cff', intensity: 0.8, sat: 0.7, bright: 0.5, contrast: 0.5, fluor: 0.5 });
export const defaultSecret = (): Secret => ({ on: false, value: 'ELES ESTÃO AQUI', font: 1, size: 7, color: 0, custom: '#b6ff1a', opacity: 1, x: 0.5, y: 0.2, rot: -3, align: 'center', glow: 0.6, halo: 0.5 });

export function baseState(): State {
  const textures = {} as Record<TexKey, Tex>;
  TEX_ORDER.forEach((k, i) => (textures[k] = TEX0(i)));
  return { aspect: 'original', frame: 'polaroid', paper: '#f3eee0', thickness: 1, wear: 0, corners: 'soft', frameSeed: 11, adjust: { ...ADJ0 }, textures, text: defaultText(), presetId: null, uv: defaultUV(), secret: defaultSecret() };
}

export interface Preset {
  id: string; label: string; frame?: FrameKey; paper?: string; wear?: number;
  adjust: Partial<Adjust>; tex: Partial<Record<TexKey, Partial<Tex>>>;
}
const T = (intensity: number, variant = 0, opacity = 0.85): Partial<Tex> => ({ on: true, intensity, variant, opacity });

export const PRESETS: Preset[] = [
  { id: 'polaroid', label: 'Polaroid clássica', frame: 'polaroid', paper: '#f4efe2', adjust: { exposure: 0.05, contrast: 0.12, saturation: -0.12, temperature: 0.18, tint: 0.05, fade: 0.22, vignette: 0.25, soften: 0.08 }, tex: { grain: T(0.45, 1), paper: T(0.25, 0, 0.7), dust: T(0.2, 2), edges: T(0.2, 0, 0.7) } },
  { id: 'f70', label: 'Foto analógica dos anos 1970', frame: 'rect', paper: '#efe3c6', adjust: { exposure: 0.08, contrast: 0.1, saturation: 0.18, temperature: 0.38, tint: 0.12, fade: 0.28, sepia: 0.15, vignette: 0.3, soften: 0.12 }, tex: { grain: T(0.6, 2), paper: T(0.4, 1, 0.75), dust: T(0.3, 2), scratches: T(0.15, 1) } },
  { id: 'f90', label: 'Foto de família dos anos 1990', frame: 'rect', paper: '#f7f4ec', adjust: { exposure: 0.12, contrast: 0.15, saturation: 0.12, temperature: 0.1, tint: -0.1, fade: 0.1, vignette: 0.15 }, tex: { grain: T(0.3, 0), dust: T(0.15, 0) } },
  { id: 'faded', label: 'Fotografia desbotada', frame: 'rect', paper: '#f1ece0', adjust: { exposure: 0.15, contrast: -0.25, saturation: -0.45, temperature: 0.12, fade: 0.55, vignette: 0.1 }, tex: { grain: T(0.3, 1), paper: T(0.25, 0, 0.7), dust: T(0.15, 0) } },
  { id: 'yellow', label: 'Fotografia antiga amarelada', frame: 'rect', paper: '#e6d4a5', adjust: { exposure: -0.02, contrast: 0.05, saturation: -0.2, temperature: 0.45, fade: 0.3, sepia: 0.55, vignette: 0.45, soften: 0.1 }, tex: { grain: T(0.4, 1), paper: T(0.7, 1, 0.8), dust: T(0.35, 2), edges: T(0.45, 2), creases: T(0.25, 1, 0.7) } },
  { id: 'archive', label: 'Arquivo investigativo', frame: 'rect', paper: '#e9e5d8', adjust: { contrast: 0.3, saturation: -0.55, temperature: -0.05, fade: 0.15, vignette: 0.35 }, tex: { grain: T(0.5, 1), paper: T(0.3, 0, 0.7), dust: T(0.3, 2), creases: T(0.3, 0, 0.8), edges: T(0.25, 0, 0.7) } },
  { id: 'dark', label: 'Fotografia sombria', frame: 'rect', paper: '#d9d4c6', adjust: { exposure: -0.35, contrast: 0.35, saturation: -0.4, temperature: -0.18, tint: 0.08, fade: 0.18, vignette: 0.75 }, tex: { grain: T(0.6, 1), mold: T(0.3, 1, 0.75), dust: T(0.3, 2), paper: T(0.3, 2, 0.6) } },
  { id: 'bw', label: 'Preto e branco analógico', frame: 'rect', paper: '#f4f1ea', adjust: { mono: 1, contrast: 0.3, fade: 0.12, vignette: 0.25, soften: 0.05 }, tex: { grain: T(0.7, 1), dust: T(0.25, 2), scratches: T(0.2, 0) } },
  { id: 'damaged', label: 'Foto danificada pelo tempo', frame: 'worn', wear: 0.6, paper: '#e2d6b6', adjust: { exposure: 0.02, contrast: 0.05, saturation: -0.3, temperature: 0.35, fade: 0.4, sepia: 0.35, vignette: 0.5 }, tex: { grain: T(0.5, 1), paper: T(0.6, 1, 0.8), dust: T(0.5, 2), scratches: T(0.45, 1), creases: T(0.6, 4, 0.85), edges: T(0.7, 2), torn: T(0.3, 0, 0.95), emulsion: T(0.4, 0), mold: T(0.35, 0, 0.7), coffee: T(0.35, 0, 0.8) } },
  { id: 'found', label: 'Evidência encontrada', frame: 'polaroid', paper: '#e8dfc6', adjust: { exposure: -0.08, contrast: 0.2, saturation: -0.25, temperature: 0.2, fade: 0.3, sepia: 0.2, vignette: 0.5 }, tex: { grain: T(0.5, 1), paper: T(0.4, 0, 0.75), dust: T(0.4, 2), creases: T(0.45, 0, 0.8), blood: T(0.4, 0, 0.85), coffee: T(0.3, 0, 0.75), edges: T(0.4, 2, 0.8) } },
];

export function applyPreset(s: State, p: Preset): State {
  const textures = {} as Record<TexKey, Tex>;
  TEX_ORDER.forEach((k) => {
    textures[k] = { ...s.textures[k], on: false, variant: 0, intensity: 0.5, opacity: 0.8, x: 0, y: 0, scale: 1, rot: 0, ...(p.tex[k] || {}) };
  });
  const frame = p.frame ?? s.frame;
  return {
    ...s, presetId: p.id, frame, paper: p.paper ?? s.paper, wear: p.wear ?? 0,
    corners: frame === 'polaroid' || frame === 'square' ? 'soft' : 'straight',
    adjust: { ...ADJ0, ...p.adjust }, textures,
  };
}
export const newSeed = rs;
