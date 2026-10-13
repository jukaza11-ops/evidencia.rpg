import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, Download, RefreshCw, Move, Type, Square, 
  Image as ImageIcon, Sliders, Layers, Scissors, Shuffle
} from 'lucide-react';

// Injeta fontes do Google Fonts
const fontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Grape+Nuts&family=The+Girl+Next+Door&display=swap');
  .font-caveat { font-family: 'Caveat', cursive; }
  .font-grape { font-family: 'Grape Nuts', cursive; }
  .font-girl { font-family: 'The Girl Next Door', cursive; }
  
  input[type=range] {
    -webkit-appearance: none;
    width: 100%;
    background: transparent;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #5A5141;
    cursor: pointer;
    margin-top: -6px;
  }
  input[type=range]::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    cursor: pointer;
    background: #D1CBB8;
    border-radius: 2px;
  }
`;

// Paleta de cores da interface (Tema Investigativo)
const theme = {
  bg: '#ECE8E1',      // Bege envelhecido
  panel: '#F5F3EF',   // Off-white
  border: '#D1CBB8',  // Borda suave
  text: '#3A362D',    // Grafite
  accent: '#8C3A3A',  // Terracota / Sangue cenográfico
  primary: '#5A5141'  // Marrom escuro
};

// Definição de estados iniciais para reset
const defaultSettings = {
  filters: { brightness: 100, contrast: 100, sepia: 0, grayscale: 0, noise: 0, saturate: 100, hueRotate: 0 },
  frame: { type: 'none', color: '#FAFAFA', padding: 20, bottomPadding: 100, texture: 'clean' },
  textures: {
    aged: { active: false, intensity: 0.5 },
    scratches: { active: false, intensity: 0.5 },
    vignette: { active: false, intensity: 0.7 },
    folds: { active: false, intensity: 0.65, level: 'medium', seed: 54321 }
  },
  tornEdge: {
    active: false,
    intensity: 18, // profundidade máxima do rasgo em px
    seed: 42,
    showFiber: true
  },
  text: { 
    content: '', 
    font: 'Caveat', 
    color: '#0f172a', // Tinta de caneta preta/azulada
    size: 48, 
    rotation: -2, 
    opacity: 0.85,
    x: 0, y: 0
  }
};

// Gerador pseudo-aleatório baseado em seed
const prng = (x) => {
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// Calcula os pontos do contorno de papel rasgado orgânico
const getTornPolygon = (width, height, maxDepth, seed) => {
  const points = [];
  const step = 4; // Resolução dos pontos em pixels

  const getNoise = (d, edgeOffset) => {
    const s = seed + edgeOffset;
    const n1 = Math.sin(d * 0.012 + s) * 0.45;
    const n2 = Math.sin(d * 0.045 + s * 2.3) * 0.3;
    const n3 = Math.sin(d * 0.11 + s * 4.7) * 0.15;
    const jitter = (prng(d * 0.7 + s * 9.1) - 0.5) * 0.25;
    const raw = Math.max(0, n1 + n2 + n3 + 0.42 + jitter);
    return raw * maxDepth;
  };

  // Borda Superior (esquerda para direita)
  for (let x = 0; x <= width; x += step) {
    points.push({ x, y: getNoise(x, 100) });
  }

  // Borda Direita (topo para base)
  for (let y = 0; y <= height; y += step) {
    points.push({ x: width - getNoise(y, 200), y });
  }

  // Borda Inferior (direita para esquerda)
  for (let x = width; x >= 0; x -= step) {
    points.push({ x, y: height - getNoise(x, 300) });
  }

  // Borda Esquerda (base para topo)
  for (let y = height; y >= 0; y -= step) {
    points.push({ x: getNoise(y, 400), y });
  }

  return points;
};

// Gerador procedural de texturas e imperfeições físicas
const generateTexture = (width, height, type, intensity, options = {}) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (type === 'noise') {
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.random() * 255;
      data[i] = val; data[i+1] = val; data[i+2] = val;
      data[i+3] = 255 * intensity;
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (type === 'scratches') {
    const scratchMult = intensity * 1.3;

    // 1. Riscos de Rolo de Câmera (Linhas verticais de transporte do filme)
    const numLongScratches = Math.floor(3 * scratchMult);
    for (let i = 0; i < numLongScratches; i++) {
      const startX = Math.random() * width;
      const angle = (Math.random() - 0.5) * 0.12;
      const baseAlpha = (Math.random() * 0.4 + 0.2) * intensity;

      ctx.save();
      ctx.strokeStyle = `rgba(250, 248, 242, ${baseAlpha})`;
      ctx.lineWidth = Math.random() * 0.8 + 0.4;
      ctx.beginPath();
      let currX = startX;
      let currY = 0;
      ctx.moveTo(currX, currY);
      while (currY < height) {
        const stepY = Math.random() * 25 + 10;
        currY += stepY;
        currX += Math.sin(currY * 0.02) * 0.8 + Math.tan(angle) * stepY;
        ctx.lineTo(currX, currY);
      }
      ctx.stroke();

      // Sombra projetada do sulco no papel
      ctx.strokeStyle = `rgba(20, 15, 10, ${baseAlpha * 0.75})`;
      ctx.lineWidth = Math.random() * 0.6 + 0.3;
      ctx.beginPath();
      currX = startX + 1.1;
      currY = 0;
      ctx.moveTo(currX, currY);
      while (currY < height) {
        const stepY = Math.random() * 25 + 10;
        currY += stepY;
        currX += Math.sin(currY * 0.02) * 0.8 + Math.tan(angle) * stepY;
        ctx.lineTo(currX, currY);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Arranhões Superficiais Curvos (Desgaste físico de manuseio)
    const numShortScratches = Math.floor((width * height * 0.000045) * scratchMult);
    for (let i = 0; i < numShortScratches; i++) {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const len = Math.random() * 110 + 15;
      const angle = Math.random() * Math.PI * 2;
      const x2 = x1 + Math.cos(angle) * len;
      const y2 = y1 + Math.sin(angle) * len;

      const cp1x = x1 + (Math.random() - 0.5) * len * 0.6;
      const cp1y = y1 + (Math.random() - 0.5) * len * 0.6;

      const opacity = (Math.random() * 0.5 + 0.25) * intensity;
      const strokeW = Math.random() * 0.9 + 0.3;

      ctx.strokeStyle = `rgba(10, 8, 5, ${opacity * 0.8})`;
      ctx.lineWidth = strokeW + 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 0.8, y1 + 0.8);
      ctx.quadraticCurveTo(cp1x + 0.8, cp1y + 0.8, x2 + 0.8, y2 + 0.8);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 252, 245, ${opacity})`;
      ctx.lineWidth = strokeW;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cp1x, cp1y, x2, y2);
      ctx.stroke();
    }

    // 3. Fiapos de Pelo e Poeira
    const numFibers = Math.floor(7 * scratchMult);
    for (let i = 0; i < numFibers; i++) {
      const fx = Math.random() * width;
      const fy = Math.random() * height;
      const fLen = Math.random() * 35 + 12;
      
      ctx.save();
      ctx.strokeStyle = `rgba(25, 20, 15, ${(Math.random() * 0.65 + 0.35) * intensity})`;
      ctx.lineWidth = Math.random() * 1.3 + 0.6;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      
      let cx = fx;
      let cy = fy;
      const segs = 4;
      for (let s = 0; s < segs; s++) {
        cx += (Math.random() - 0.5) * (fLen / segs) * 2;
        cy += (Math.random() - 0.5) * (fLen / segs) * 2;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Lascas de Emulsão
    ctx.fillStyle = `rgba(255, 252, 245, ${0.75 * intensity})`;
    const specks = Math.floor((width * height * 0.000035) * scratchMult);
    for (let i = 0; i < specks; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const r = Math.random() * 1.2 + 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'vignette') {
    const gradient = ctx.createRadialGradient(width/2, height/2, width/4, width/2, height/2, width/1.2);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (type === 'aged') {
    ctx.fillStyle = `rgba(180, 130, 70, ${intensity})`;
    ctx.fillRect(0, 0, width, height);
  } else if (type === 'folds') {
    const { level = 'medium', seed = 54321 } = options;
    const rnd = (i) => prng(seed + i * 17.17);

    const foldLines = [];

    if (level === 'low') {
      if (rnd(1) > 0.5) {
        foldLines.push({ type: 'v', pos: width * (0.48 + (rnd(2) - 0.5) * 0.08) });
      } else {
        foldLines.push({ type: 'h', pos: height * (0.48 + (rnd(3) - 0.5) * 0.08) });
      }
    } else if (level === 'medium') {
      foldLines.push({ type: 'v', pos: width * (0.49 + (rnd(2) - 0.5) * 0.06) });
      foldLines.push({ type: 'h', pos: height * (0.49 + (rnd(3) - 0.5) * 0.06) });
    } else { // 'high'
      foldLines.push({ type: 'v', pos: width * (0.49 + (rnd(2) - 0.5) * 0.06) });
      foldLines.push({ type: 'h', pos: height * (0.49 + (rnd(3) - 0.5) * 0.06) });
      foldLines.push({ type: 'v', pos: width * (0.28 + (rnd(4) - 0.5) * 0.1) });
      foldLines.push({ type: 'h', pos: height * (0.72 + (rnd(5) - 0.5) * 0.1) });
    }

    foldLines.forEach((line, idx) => {
      const isV = line.type === 'v';
      const p = line.pos;
      const lineSeed = idx * 113 + seed;

      ctx.save();
      
      if (isV) {
        const shadowW = Math.max(12, width * 0.035) * intensity;
        
        let gradS = ctx.createLinearGradient(p - shadowW, 0, p, 0);
        gradS.addColorStop(0, 'rgba(0,0,0,0)');
        gradS.addColorStop(0.7, `rgba(15,10,5,${0.22 * intensity})`);
        gradS.addColorStop(1, `rgba(0,0,0,${0.38 * intensity})`);
        ctx.fillStyle = gradS;
        ctx.fillRect(p - shadowW, 0, shadowW, height);

        let gradL = ctx.createLinearGradient(p, 0, p + shadowW, 0);
        gradL.addColorStop(0, `rgba(255,252,240,${0.32 * intensity})`);
        gradL.addColorStop(0.35, `rgba(255,250,230,${0.12 * intensity})`);
        gradL.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradL;
        ctx.fillRect(p, 0, shadowW, height);
      } else {
        const shadowH = Math.max(12, height * 0.035) * intensity;

        let gradS = ctx.createLinearGradient(0, p - shadowH, 0, p);
        gradS.addColorStop(0, 'rgba(0,0,0,0)');
        gradS.addColorStop(0.7, `rgba(15,10,5,${0.22 * intensity})`);
        gradS.addColorStop(1, `rgba(0,0,0,${0.38 * intensity})`);
        ctx.fillStyle = gradS;
        ctx.fillRect(0, p - shadowH, width, shadowH);

        let gradL = ctx.createLinearGradient(0, p, 0, p + shadowH);
        gradL.addColorStop(0, `rgba(255,252,240,${0.32 * intensity})`);
        gradL.addColorStop(0.35, `rgba(255,250,230,${0.12 * intensity})`);
        gradL.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradL;
        ctx.fillRect(0, p, width, shadowH);
      }
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      const step = 6;
      if (isV) {
        ctx.moveTo(p, 0);
        for (let y = 0; y <= height; y += step) {
          const jitter = (prng(y * 0.06 + lineSeed) - 0.5) * 2.2;
          ctx.lineTo(p + jitter, y);
        }
      } else {
        ctx.moveTo(0, p);
        for (let x = 0; x <= width; x += step) {
          const jitter = (prng(x * 0.06 + lineSeed) - 0.5) * 2.2;
          ctx.lineTo(x, p + jitter);
        }
      }

      ctx.strokeStyle = `rgba(10, 8, 5, ${0.45 * intensity})`;
      ctx.lineWidth = 3 * intensity;
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 252, 242, ${0.85 * intensity})`;
      ctx.lineWidth = 1.6 * intensity;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      const lineLen = isV ? height : width;
      const frays = Math.floor((lineLen / 18) * intensity);
      ctx.strokeStyle = `rgba(255, 252, 245, ${0.65 * intensity})`;
      ctx.lineWidth = 0.9;
      for (let f = 0; f < frays; f++) {
        const posOnLine = prng(f * 4.1 + lineSeed) * lineLen;
        const jitter = (prng(f * 8.3 + lineSeed) - 0.5) * 2.5;
        const frayLen = prng(f * 12.7 + lineSeed) * 10 + 3;
        const angle = (prng(f * 14.1 + lineSeed) - 0.5) * 0.9 + (isV ? 0 : Math.PI / 2);

        const fx = isV ? p + jitter : posOnLine;
        const fy = isV ? posOnLine : p + jitter;

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(angle) * frayLen, fy + Math.sin(angle) * frayLen);
        ctx.stroke();
      }
      ctx.restore();
    });

    const vLines = foldLines.filter(l => l.type === 'v');
    const hLines = foldLines.filter(l => l.type === 'h');

    vLines.forEach(v => {
      hLines.forEach(h => {
        ctx.save();
        const ix = v.pos;
        const iy = h.pos;
        const rad = (Math.random() * 6 + 10) * intensity;

        const bloom = ctx.createRadialGradient(ix, iy, 0, ix, iy, rad);
        bloom.addColorStop(0, `rgba(255, 252, 240, ${0.75 * intensity})`);
        bloom.addColorStop(0.5, `rgba(240, 235, 220, ${0.25 * intensity})`);
        bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(ix, iy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    });
  }
  return canvas;
};

export default function App() {
  const [image, setImage] = useState(null);
  const [activeTab, setActiveTab] = useState('presets');
  const [settings, setSettings] = useState(JSON.parse(JSON.stringify(defaultSettings)));
  const canvasRef = useRef(null);
  
  // Estado para mover o texto com o mouse/toque
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = fontStyles;
    document.head.appendChild(styleSheet);
    return () => styleSheet.remove();
  }, []);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setSettings(prev => ({
          ...prev,
          text: { ...prev.text, x: img.width / 2, y: img.height - 100 }
        }));
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(defaultSettings)));
    if (image) {
       setSettings(prev => ({ ...prev, text: { ...prev.text, x: image.width / 2, y: image.height - 100 } }));
    }
  };

  // Renderizador principal da composição no Canvas
  const renderComposition = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    
    let finalWidth = image.width;
    let finalHeight = image.height;
    let imgX = 0;
    let imgY = 0;

    if (settings.frame.type === 'polaroid') {
      finalWidth = image.width + (settings.frame.padding * 2);
      finalHeight = image.height + settings.frame.padding + settings.frame.bottomPadding;
      imgX = settings.frame.padding;
      imgY = settings.frame.padding;
    }

    canvas.width = finalWidth;
    canvas.height = finalHeight;

    // 1. Limpa fundo (preserva transparência nativa)
    ctx.clearRect(0, 0, finalWidth, finalHeight);

    // 2. MÁSCARA DE PAPEL RASGADO (se ativa)
    let tornPoints = null;
    if (settings.tornEdge.active && settings.tornEdge.intensity > 0) {
      tornPoints = getTornPolygon(finalWidth, finalHeight, settings.tornEdge.intensity, settings.tornEdge.seed);
      
      ctx.save();
      ctx.beginPath();
      if (tornPoints.length > 0) {
        ctx.moveTo(tornPoints[0].x, tornPoints[0].y);
        for (let i = 1; i < tornPoints.length; i++) {
          ctx.lineTo(tornPoints[i].x, tornPoints[i].y);
        }
      }
      ctx.closePath();
      ctx.clip(); // Recorta toda a composição no formato de papel rasgado
    }

    // 3. Desenha Moldura
    if (settings.frame.type === 'polaroid') {
      ctx.fillStyle = settings.frame.color;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 10;
      ctx.fillRect(0, 0, finalWidth, finalHeight);
      ctx.shadowColor = 'transparent';
    }

    // 4. Desenha a Imagem com Filtros Base
    ctx.save();
    const filterString = `brightness(${settings.filters.brightness}%) contrast(${settings.filters.contrast}%) sepia(${settings.filters.sepia}%) grayscale(${settings.filters.grayscale}%) saturate(${settings.filters.saturate ?? 100}%) hue-rotate(${settings.filters.hueRotate ?? 0}deg)`;
    ctx.filter = filterString;
    ctx.drawImage(image, imgX, imgY, image.width, image.height);
    ctx.restore();

    // 5. Aplica Texturas sobre toda a fotografia e moldura
    ctx.save();

    if (settings.textures.aged.active) {
      const tex = generateTexture(finalWidth, finalHeight, 'aged', settings.textures.aged.intensity);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(tex, 0, 0);
    }

    if (settings.textures.folds?.active) {
      const tex = generateTexture(finalWidth, finalHeight, 'folds', settings.textures.folds.intensity, {
        level: settings.textures.folds.level,
        seed: settings.textures.folds.seed
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tex, 0, 0);
    }

    if (settings.filters.noise > 0) {
      const tex = generateTexture(finalWidth, finalHeight, 'noise', settings.filters.noise / 100);
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(tex, 0, 0);
    }

    if (settings.textures.scratches.active) {
      const tex = generateTexture(finalWidth, finalHeight, 'scratches', settings.textures.scratches.intensity);
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(tex, 0, 0);
    }

    if (settings.textures.vignette.active) {
      const tex = generateTexture(finalWidth, finalHeight, 'vignette', settings.textures.vignette.intensity);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(tex, 0, 0);
    }
    ctx.restore();

    // 6. Efeito Visual de Fibra do Papel Rasgado
    if (settings.tornEdge.active && settings.tornEdge.intensity > 0 && tornPoints) {
      ctx.save();
      
      if (settings.tornEdge.showFiber) {
        ctx.beginPath();
        ctx.moveTo(tornPoints[0].x, tornPoints[0].y);
        for (let i = 1; i < tornPoints.length; i++) {
          ctx.lineTo(tornPoints[i].x, tornPoints[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(245, 240, 228, 0.9)';
        ctx.lineWidth = Math.max(2, settings.tornEdge.intensity * 0.18);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 252, 245, 0.75)';
        ctx.lineWidth = 1;
        for (let i = 0; i < tornPoints.length; i += 4) {
          const p = tornPoints[i];
          const rnd = prng(i + settings.tornEdge.seed);
          const angle = rnd * Math.PI * 2;
          const len = (prng(i * 3 + settings.tornEdge.seed) * 3.5 + 1);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len);
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.moveTo(tornPoints[0].x, tornPoints[0].y);
      for (let i = 1; i < tornPoints.length; i++) {
        ctx.lineTo(tornPoints[i].x, tornPoints[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(30, 20, 10, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.restore();
    }

    if (settings.tornEdge.active && settings.tornEdge.intensity > 0) {
      ctx.restore();
    }

    // 7. Desenha Texto Manuscrito
    if (settings.text.content) {
      ctx.save();
      ctx.translate(settings.text.x, settings.text.y);
      ctx.rotate((settings.text.rotation * Math.PI) / 180);
      
      ctx.font = `${settings.text.size}px '${settings.text.font}', cursive`;
      ctx.fillStyle = settings.text.color;
      ctx.globalAlpha = settings.text.opacity;
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillText(settings.text.content, 0, 0);
      ctx.globalAlpha = settings.text.opacity * 0.5;
      ctx.fillText(settings.text.content, 1, 1);
      
      ctx.restore();
    }
  }, [image, settings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      renderComposition();
    }, 100);
    return () => clearTimeout(timer);
  }, [renderComposition]);

  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e) => {
    if (!settings.text.content || activeTab !== 'text') return;
    const pos = getPointerPos(e);
    const hitZone = settings.text.size * 2; 
    
    if (Math.abs(pos.x - settings.text.x) < hitZone * (settings.text.content.length/2) && 
        Math.abs(pos.y - settings.text.y) < hitZone) {
      setIsDraggingText(true);
      setDragOffset({ x: pos.x - settings.text.x, y: pos.y - settings.text.y });
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingText) return;
    const pos = getPointerPos(e);
    setSettings(prev => ({
      ...prev,
      text: { ...prev.text, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
    }));
  };

  const handlePointerUp = () => { setIsDraggingText(false); };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `evidencia-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const applyPreset = (presetName) => {
    setSettings(prev => {
      const next = JSON.parse(JSON.stringify(prev));

      let targetFilters = { brightness: 100, contrast: 100, sepia: 0, grayscale: 0, noise: 0, saturate: 100, hueRotate: 0 };
      let texUpdates = {};

      switch(presetName) {
        case 'kodachrome':
          targetFilters = { brightness: 105, contrast: 130, sepia: 12, grayscale: 0, noise: 15, saturate: 140, hueRotate: -5 };
          texUpdates = { aged: { active: true, intensity: 0.15 }, vignette: { active: true, intensity: 0.45 } };
          break;
        case 'kodakgold':
          targetFilters = { brightness: 110, contrast: 105, sepia: 25, grayscale: 0, noise: 20, saturate: 125, hueRotate: 6 };
          texUpdates = { aged: { active: true, intensity: 0.2 }, vignette: { active: true, intensity: 0.25 } };
          break;
        case 'fujichrome':
          targetFilters = { brightness: 98, contrast: 118, sepia: 5, grayscale: 0, noise: 18, saturate: 115, hueRotate: -12 };
          texUpdates = { vignette: { active: true, intensity: 0.4 } };
          break;
        case 'lomography':
          targetFilters = { brightness: 92, contrast: 150, sepia: 10, grayscale: 0, noise: 30, saturate: 165, hueRotate: -8 };
          texUpdates = { scratches: { active: true, intensity: 0.35 }, vignette: { active: true, intensity: 0.85 } };
          break;
        case 'expiredfilm':
          targetFilters = { brightness: 88, contrast: 85, sepia: 48, grayscale: 0, noise: 45, saturate: 75, hueRotate: 20 };
          texUpdates = { aged: { active: true, intensity: 0.55 }, scratches: { active: true, intensity: 0.6 }, vignette: { active: true, intensity: 0.65 } };
          break;
        case 'trix400':
          targetFilters = { brightness: 95, contrast: 155, sepia: 0, grayscale: 100, noise: 65, saturate: 0, hueRotate: 0 };
          texUpdates = { scratches: { active: true, intensity: 0.45 }, vignette: { active: true, intensity: 0.55 } };
          break;
        case 'daguerreotype':
          targetFilters = { brightness: 82, contrast: 165, sepia: 75, grayscale: 50, noise: 75, saturate: 30, hueRotate: 12 };
          texUpdates = { aged: { active: true, intensity: 0.75 }, scratches: { active: true, intensity: 0.85 }, vignette: { active: true, intensity: 0.88 } };
          break;
        case 'disposable90s':
          targetFilters = { brightness: 120, contrast: 112, sepia: 10, grayscale: 0, noise: 38, saturate: 130, hueRotate: 3 };
          texUpdates = { vignette: { active: true, intensity: 0.48 } };
          break;
        case 'polaroid':
          next.frame.type = 'polaroid';
          targetFilters = { brightness: 105, contrast: 92, sepia: 22, grayscale: 0, noise: 22, saturate: 110, hueRotate: -3 };
          texUpdates = { aged: { active: true, intensity: 0.25 }, vignette: { active: true, intensity: 0.35 } };
          break;
        case 'arquivo':
          targetFilters = { brightness: 88, contrast: 135, sepia: 35, grayscale: 85, noise: 40, saturate: 15, hueRotate: 0 };
          texUpdates = { scratches: { active: true, intensity: 0.65 }, vignette: { active: true, intensity: 0.6 } };
          break;
      }

      next.filters = targetFilters;

      // Preserva dobras e papel rasgado sem sobrescrever
      Object.keys(texUpdates).forEach(key => {
        next.textures[key] = {
          ...next.textures[key],
          ...texUpdates[key]
        };
      });

      return next;
    });
  };

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newState = { ...prev };
      let current = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  };

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex flex-col items-center justify-center py-3 text-xs tracking-wider uppercase font-semibold transition-all ${
        activeTab === id 
          ? 'bg-[#ECE8E1] text-[#3A362D] border-t-2 border-[#5A5141]' 
          : 'text-[#3A362D]/60 hover:bg-[#ECE8E1]/50 border-t-2 border-transparent'
      }`}
    >
      <Icon size={18} className="mb-1" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: theme.bg, color: theme.text }}>
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-[#D1CBB8]" style={{ backgroundColor: theme.panel }}>
        <div className="text-center sm:text-left mb-4 sm:mb-0">
          <h1 className="text-2xl font-bold tracking-tighter" style={{ color: theme.primary }}>evidencia.rpg</h1>
          <p className="text-xs tracking-[0.2em] opacity-60 font-semibold">LABORATÓRIO DE EVIDÊNCIAS FOTOGRÁFICAS</p>
        </div>
        <div className="flex gap-3">
          {image && (
            <button onClick={handleReset} className="px-4 py-2 text-sm flex items-center gap-2 border border-[#D1CBB8] rounded hover:bg-[#ECE8E1] transition-colors">
              <RefreshCw size={14} /> Restaurar
            </button>
          )}
          <label className="cursor-pointer px-4 py-2 text-sm flex items-center gap-2 rounded text-white transition-colors" style={{ backgroundColor: theme.primary }}>
            <Upload size={14} /> {image ? 'Trocar Imagem' : 'Carregar Imagem'}
            <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
          </label>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Área Central: Preview */}
        <section 
          className="flex-1 relative flex items-center justify-center overflow-auto p-4 lg:p-12"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h10v10H0zm10 10h10v10H10z' fill='%23e0dbd1' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat'
          }}
        >
          {!image ? (
            <div className="text-center p-12 border-2 border-dashed border-[#D1CBB8] rounded-xl bg-[#F5F3EF]/80 max-w-md">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-40" />
              <h2 className="text-xl font-bold mb-2">Área de Trabalho</h2>
              <p className="opacity-70 text-sm">Carregue uma imagem para aplicar o envelhecimento físico e anotações.</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={`max-w-full max-h-full object-contain shadow-2xl transition-transform ${activeTab === 'text' ? 'cursor-move' : ''}`}
              style={{ filter: 'drop-shadow(0 25px 25px rgb(0 0 0 / 0.15))' }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
          
          {activeTab === 'text' && image && (
            <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 pointer-events-none">
              <Move size={12} /> Arraste o texto pela imagem
            </div>
          )}
        </section>

        {/* Painel Lateral: Controles */}
        <aside 
          className={`w-full lg:w-[400px] flex flex-col border-l border-[#D1CBB8] transition-all duration-300 ${!image ? 'opacity-50 pointer-events-none grayscale' : ''}`} 
          style={{ backgroundColor: theme.panel }}
        >
          <nav className="flex border-b border-[#D1CBB8]">
            <TabButton id="presets" icon={ImageIcon} label="Presets" />
            <TabButton id="textures" icon={Layers} label="Texturas" />
            <TabButton id="frames" icon={Square} label="Moldura" />
            <TabButton id="text" icon={Type} label="Texto" />
          </nav>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* ABA: PRESETS */}
            {activeTab === 'presets' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C3A3A] mb-3 flex items-center gap-1.5">
                    🎞️ Rolos de Filme & Câmeras Clássicas
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'kodachrome', label: 'Kodachrome 64', desc: 'Anos 60 • Cores vivas & contraste' },
                      { id: 'kodakgold', label: 'Kodak Gold 200', desc: 'Anos 80/90 • Tom dourado quente' },
                      { id: 'fujichrome', label: 'Fujifilm Chrome', desc: 'Anos 90 • Verdiosos & tons frios' },
                      { id: 'lomography', label: 'Lomografia LC-A', desc: 'Cores ultra-saturadas & vinheta' },
                      { id: 'disposable90s', label: 'Descartável 90s', desc: 'Flash forte & grão visível' },
                      { id: 'expiredfilm', label: 'Filme Vencido', desc: 'Desvio de cor & oxidação' },
                      { id: 'trix400', label: 'Tri-X 400 P&B', desc: 'Filme P&B de alto contraste & grão' },
                      { id: 'daguerreotype', label: 'Daguerreótipo 1880', desc: 'Século XIX • Desgaste extremo' },
                    ].map(preset => (
                      <button 
                        key={preset.id}
                        onClick={() => applyPreset(preset.id)}
                        className="p-3 text-left border border-[#D1CBB8] rounded bg-white hover:border-[#8C3A3A] hover:shadow-sm transition-all group"
                      >
                        <div className="font-bold text-xs group-hover:text-[#8C3A3A] transition-colors">{preset.label}</div>
                        <div className="text-[10px] opacity-60 mt-1 leading-tight">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5141] mb-3 flex items-center gap-1.5">
                    📁 Arquivo & Evidência
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'polaroid', label: 'Polaroid Clássica', desc: 'Instantânea com moldura' },
                      { id: 'arquivo', label: 'Arquivo Policial', desc: 'Documentação investigativa' },
                    ].map(preset => (
                      <button 
                        key={preset.id}
                        onClick={() => applyPreset(preset.id)}
                        className="p-3 text-left border border-[#D1CBB8] rounded bg-white hover:border-[#5A5141] hover:shadow-sm transition-all group"
                      >
                        <div className="font-bold text-xs group-hover:text-[#5A5141] transition-colors">{preset.label}</div>
                        <div className="text-[10px] opacity-60 mt-1 leading-tight">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#D1CBB8] space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-widest opacity-60 flex items-center gap-2"><Sliders size={14}/> Ajuste Fino da Emulsão</h3>
                  {[
                    { id: 'brightness', label: 'Exposição', min: 50, max: 150 },
                    { id: 'contrast', label: 'Contraste', min: 50, max: 180 },
                    { id: 'saturate', label: 'Vibração / Saturação', min: 0, max: 200 },
                    { id: 'hueRotate', label: 'Tonalidade / Viragem de Cor', min: -30, max: 30 },
                    { id: 'sepia', label: 'Amarelado / Sépia', min: 0, max: 100 },
                    { id: 'noise', label: 'Grão de Filme Analógico', min: 0, max: 100 }
                  ].map(ctrl => (
                    <div key={ctrl.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{ctrl.label}</span>
                        <span>{settings.filters[ctrl.id]}</span>
                      </div>
                      <input 
                        type="range" min={ctrl.min} max={ctrl.max} 
                        value={settings.filters[ctrl.id]}
                        onChange={(e) => updateSetting(`filters.${ctrl.id}`, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA: TEXTURAS */}
            {activeTab === 'textures' && (
              <div className="space-y-5">
                {/* Dobras e Vincos */}
                <div className="p-4 border border-[#5A5141] rounded bg-white shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm">Dobras e Vincos (Papel)</div>
                      <div className="text-[10px] opacity-60">Papel dobrado em quadrantes com vinco gasta</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" className="sr-only peer"
                        checked={settings.textures.folds?.active || false}
                        onChange={(e) => updateSetting('textures.folds.active', e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A5141]"></div>
                    </label>
                  </div>

                  {settings.textures.folds?.active && (
                    <div className="space-y-4 pt-2 border-t border-[#D1CBB8]">
                      <div>
                        <label className="text-xs font-bold block mb-2">Nível das Dobras</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { l: 'Pouco', val: 'low' },
                            { l: 'Médio', val: 'medium' },
                            { l: 'Muito', val: 'high' }
                          ].map(lvl => (
                            <button
                              key={lvl.val}
                              onClick={() => updateSetting('textures.folds.level', lvl.val)}
                              className={`py-2 text-xs font-bold border rounded transition-colors ${
                                settings.textures.folds?.level === lvl.val 
                                  ? 'bg-[#5A5141] text-white border-[#5A5141]' 
                                  : 'bg-white border-[#D1CBB8] text-[#3A362D] hover:bg-[#ECE8E1]'
                              }`}
                            >
                              {lvl.l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Intensidade do Vinco</span>
                          <span>{Math.round((settings.textures.folds?.intensity || 0.6) * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.2" max="1" step="0.05"
                          value={settings.textures.folds?.intensity || 0.6}
                          onChange={(e) => updateSetting('textures.folds.intensity', Number(e.target.value))}
                        />
                      </div>

                      <button
                        onClick={() => updateSetting('textures.folds.seed', Math.floor(Math.random() * 100000))}
                        className="w-full py-2 px-3 text-xs font-bold border border-[#5A5141] rounded bg-[#ECE8E1] hover:bg-[#D1CBB8] flex items-center justify-center gap-2 transition-colors"
                      >
                        <Shuffle size={14} /> 🎲 Gerar Nova Dobra (Aleatório)
                      </button>
                    </div>
                  )}
                </div>

                {/* Papel Rasgado */}
                <div className="p-4 border border-[#5A5141] rounded bg-white shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Scissors size={18} className="text-[#8C3A3A]" />
                      <div>
                        <div className="font-bold text-sm">Bordas Rasgadas (Papel Real)</div>
                        <div className="text-[10px] opacity-60">Recorte físico orgânico nas margens do papel</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" className="sr-only peer"
                        checked={settings.tornEdge.active}
                        onChange={(e) => updateSetting('tornEdge.active', e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A5141]"></div>
                    </label>
                  </div>

                  {settings.tornEdge.active && (
                    <div className="space-y-4 pt-2 border-t border-[#D1CBB8]">
                      <div>
                        <label className="text-xs font-bold block mb-2">Nível do Rasgo</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { l: 'Pouco', val: 8 },
                            { l: 'Médio', val: 18 },
                            { l: 'Muito', val: 32 }
                          ].map(lvl => (
                            <button
                              key={lvl.l}
                              onClick={() => updateSetting('tornEdge.intensity', lvl.val)}
                              className={`py-2 text-xs font-bold border rounded transition-colors ${
                                settings.tornEdge.intensity === lvl.val 
                                  ? 'bg-[#5A5141] text-white border-[#5A5141]' 
                                  : 'bg-white border-[#D1CBB8] text-[#3A362D] hover:bg-[#ECE8E1]'
                              }`}
                            >
                              {lvl.l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Ajuste Fino da Profundidade</span>
                          <span>{settings.tornEdge.intensity}px</span>
                        </div>
                        <input 
                          type="range" min="3" max="50" 
                          value={settings.tornEdge.intensity}
                          onChange={(e) => updateSetting('tornEdge.intensity', Number(e.target.value))}
                        />
                      </div>

                      <button
                        onClick={() => updateSetting('tornEdge.seed', Math.floor(Math.random() * 100000))}
                        className="w-full py-2 px-3 text-xs font-bold border border-[#5A5141] rounded bg-[#ECE8E1] hover:bg-[#D1CBB8] flex items-center justify-center gap-2 transition-colors"
                      >
                        <Shuffle size={14} /> 🎲 Gerar Novo Rasgo (Aleatório)
                      </button>
                    </div>
                  )}
                </div>

                {[
                  { id: 'aged', label: 'Papel Envelhecido', desc: 'Manchas de tempo e oxidação.' },
                  { id: 'scratches', label: 'Arranhões', desc: 'Desgaste físico na superfície.' },
                  { id: 'vignette', label: 'Bordas Escuras', desc: 'Vinheta natural de lente/tempo.' }
                ].map(tex => (
                  <div key={tex.id} className="p-4 border border-[#D1CBB8] rounded bg-white">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-bold text-sm">{tex.label}</div>
                        <div className="text-[10px] opacity-60">{tex.desc}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" className="sr-only peer"
                          checked={settings.textures[tex.id].active}
                          onChange={(e) => updateSetting(`textures.${tex.id}.active`, e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A5141]"></div>
                      </label>
                    </div>
                    {settings.textures[tex.id].active && (
                      <div className="mt-3">
                         <div className="flex justify-between text-xs mb-1 opacity-60"><span>Intensidade</span></div>
                         <input 
                          type="range" min="0" max="1" step="0.1" 
                          value={settings.textures[tex.id].intensity}
                          onChange={(e) => updateSetting(`textures.${tex.id}.intensity`, Number(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ABA: MOLDURAS */}
            {activeTab === 'frames' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button 
                    onClick={() => updateSetting('frame.type', 'none')}
                    className={`p-4 border rounded text-center transition-colors ${settings.frame.type === 'none' ? 'border-[#5A5141] bg-[#ECE8E1]' : 'border-[#D1CBB8] bg-white'}`}
                  >
                    Sem Moldura
                  </button>
                  <button 
                    onClick={() => updateSetting('frame.type', 'polaroid')}
                    className={`p-4 border rounded text-center transition-colors ${settings.frame.type === 'polaroid' ? 'border-[#5A5141] bg-[#ECE8E1]' : 'border-[#D1CBB8] bg-white'}`}
                  >
                    Polaroid Clássica
                  </button>
                </div>
                
                {settings.frame.type === 'polaroid' && (
                  <div className="p-4 border border-[#D1CBB8] rounded bg-white space-y-6">
                    <div>
                      <label className="text-xs font-bold block mb-3">Cor do Papel Fotográfico</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { c: '#FAFAFA', l: 'Novo' }, 
                          { c: '#F0EAD6', l: 'Quente' }, 
                          { c: '#E6E2D3', l: 'Desbotado' }, 
                          { c: '#D4C5AD', l: 'Amarelado' }, 
                          { c: '#9C8A76', l: 'Mofado' }, 
                          { c: '#111111', l: 'Escuro' }
                        ].map(color => (
                          <button 
                            key={color.c}
                            onClick={() => updateSetting('frame.color', color.c)}
                            title={color.l}
                            className={`w-8 h-8 rounded-full border-2 shadow-inner transition-transform ${settings.frame.color === color.c ? 'border-[#5A5141] scale-110' : 'border-gray-300 hover:scale-105'}`}
                            style={{ backgroundColor: color.c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold block mb-3">Dimensões da Moldura</label>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Bordas (Laterais e Topo)</span>
                            <span>{settings.frame.padding}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="150" 
                            value={settings.frame.padding}
                            onChange={(e) => updateSetting('frame.padding', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Área Inferior (Escrita)</span>
                            <span>{settings.frame.bottomPadding}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="300" 
                            value={settings.frame.bottomPadding}
                            onChange={(e) => updateSetting('frame.bottomPadding', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA: TEXTO */}
            {activeTab === 'text' && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold block mb-1">Anotação Manuscrita</label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: CASO 017 — Encontrada no local."
                    className="w-full p-3 border border-[#D1CBB8] rounded bg-white text-sm focus:outline-none focus:border-[#5A5141]"
                    value={settings.text.content}
                    onChange={(e) => updateSetting('text.content', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs block mb-1">Fonte</label>
                    <select 
                      className="w-full p-2 border border-[#D1CBB8] rounded bg-white text-sm"
                      value={settings.text.font}
                      onChange={(e) => updateSetting('text.font', e.target.value)}
                    >
                      <option value="Caveat">Caveat</option>
                      <option value="Grape Nuts">Grape Nuts</option>
                      <option value="The Girl Next Door">The Girl Next Door</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Tamanho</label>
                    <input 
                      type="range" min="16" max="120" 
                      value={settings.text.size}
                      onChange={(e) => updateSetting('text.size', Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs block mb-2">Cor da Tinta</label>
                  <div className="flex gap-3">
                    {[
                      { c: '#0f172a', l: 'Preta' }, 
                      { c: '#1e3a8a', l: 'Azul' }, 
                      { c: '#7f1d1d', l: 'Vermelha' }
                    ].map(ink => (
                      <button 
                        key={ink.c}
                        onClick={() => updateSetting('text.color', ink.c)}
                        className={`w-8 h-8 rounded-full shadow-inner border ${settings.text.color === ink.c ? 'ring-2 ring-offset-2 ring-[#5A5141]' : 'border-black/20'}`}
                        style={{ backgroundColor: ink.c }}
                        title={ink.l}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Rotação (Graus)</span>
                    <span>{settings.text.rotation}°</span>
                  </div>
                  <input 
                    type="range" min="-15" max="15" 
                    value={settings.text.rotation}
                    onChange={(e) => updateSetting('text.rotation', Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Exportação */}
          <div className="p-4 border-t border-[#D1CBB8] bg-[#ECE8E1]">
            <button 
              onClick={exportPNG}
              disabled={!image}
              className="w-full py-4 rounded font-bold tracking-widest text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.text, color: theme.panel }}
            >
              <Download size={18} /> BAIXAR PNG (TRANSPARENTE)
            </button>
            <p className="text-center text-[10px] opacity-50 mt-2">Gera arquivo isolado com canal alfa nativo.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}