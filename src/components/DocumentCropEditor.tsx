import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCw, Maximize2, RefreshCw, ArrowLeft, Wand2 } from 'lucide-react';
import {
  EnhanceMode,
  Quad,
  Point,
  detectDocumentQuad,
  fullFrameQuad,
  imageToCanvas,
  loadImage,
  processDocument
} from '../services/documentScanner';

interface DocumentCropEditorProps {
  isOpen: boolean;
  /** Raw, uncropped source image (camera frame or gallery pick). */
  sourceImage: string;
  /** Corners in source-image space; detected automatically when omitted. */
  initialQuad?: Quad | null;
  initialMode?: EnhanceMode;
  initialRotation?: number;
  onCancel: () => void;
  onConfirm: (result: { dataUrl: string; ocrDataUrl: string; quad: Quad; mode: EnhanceMode; rotation: number }) => void;
  confirmLabel?: string;
}

const MODES: { id: EnhanceMode; label: string }[] = [
  { id: 'color', label: 'Color' },
  { id: 'gray', label: 'Gray' },
  { id: 'bw', label: 'B&W' },
  { id: 'original', label: 'Original' }
];

const HANDLE_HIT_RADIUS = 32;

export const DocumentCropEditor: React.FC<DocumentCropEditorProps> = ({
  isOpen,
  sourceImage,
  initialQuad,
  initialMode = 'color',
  initialRotation = 0,
  onCancel,
  onConfirm,
  confirmLabel = 'Use Scan'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [quad, setQuad] = useState<Quad | null>(null);
  const [mode, setMode] = useState<EnhanceMode>(initialMode);
  const [rotation, setRotation] = useState(initialRotation);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  /** Displayed size of the source image inside the editor, in CSS pixels. */
  const [layout, setLayout] = useState({ width: 0, height: 0, scale: 1 });

  // Decode the source once, then find (or accept) the page corners.
  useEffect(() => {
    if (!isOpen || !sourceImage) return;
    let cancelled = false;
    setIsPreparing(true);

    (async () => {
      try {
        const img = await loadImage(sourceImage);
        if (cancelled) return;

        const canvas = imageToCanvas(img);
        sourceCanvasRef.current = canvas;

        let nextQuad = initialQuad ?? null;
        let detected = Boolean(initialQuad);

        if (!nextQuad) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            const detection = detectDocumentQuad(ctx.getImageData(0, 0, canvas.width, canvas.height));
            if (detection) {
              nextQuad = detection.quad;
              detected = true;
            }
          }
        }

        if (cancelled) return;
        setAutoDetected(detected);
        setQuad(nextQuad ?? insetFrameQuad(canvas.width, canvas.height));
        setIsPreparing(false);
      } catch {
        if (!cancelled) setIsPreparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, sourceImage, initialQuad]);

  // Fit the source image into the available editor area.
  const recomputeLayout = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const bounds = container.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;

    const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height);
    setLayout({
      width: canvas.width * scale,
      height: canvas.height * scale,
      scale
    });
  }, []);

  useEffect(() => {
    if (isPreparing) return;
    recomputeLayout();
    window.addEventListener('resize', recomputeLayout);
    return () => window.removeEventListener('resize', recomputeLayout);
  }, [isPreparing, recomputeLayout]);

  const displayQuad = useMemo(() => {
    if (!quad) return null;
    return quad.map((p) => ({ x: p.x * layout.scale, y: p.y * layout.scale })) as Quad;
  }, [quad, layout.scale]);

  const pointerToSource = useCallback(
    (event: React.PointerEvent): Point | null => {
      const stage = event.currentTarget as HTMLElement;
      const bounds = stage.getBoundingClientRect();
      const canvas = sourceCanvasRef.current;
      if (!canvas || layout.scale === 0) return null;

      return {
        x: Math.min(canvas.width, Math.max(0, (event.clientX - bounds.left) / layout.scale)),
        y: Math.min(canvas.height, Math.max(0, (event.clientY - bounds.top) / layout.scale))
      };
    },
    [layout.scale]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!quad) return;
      const point = pointerToSource(event);
      if (!point) return;

      let nearest = -1;
      let nearestDist = Infinity;
      quad.forEach((corner, index) => {
        const d = Math.hypot(corner.x - point.x, corner.y - point.y) * layout.scale;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = index;
        }
      });

      if (nearestDist <= HANDLE_HIT_RADIUS) {
        dragIndexRef.current = nearest;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    },
    [quad, pointerToSource, layout.scale]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const index = dragIndexRef.current;
      if (index === null || !quad) return;
      const point = pointerToSource(event);
      if (!point) return;

      event.preventDefault();
      setQuad((prev) => {
        if (!prev) return prev;
        const next = prev.slice() as Quad;
        next[index] = point;
        return next;
      });
    },
    [quad, pointerToSource]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (dragIndexRef.current === null) return;
    dragIndexRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }, []);

  const resetToFullFrame = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    setQuad(fullFrameQuad(canvas.width, canvas.height));
    setAutoDetected(false);
  }, []);

  const redetect = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const detection = detectDocumentQuad(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (detection) {
      setQuad(detection.quad);
      setAutoDetected(true);
    } else {
      setQuad(insetFrameQuad(canvas.width, canvas.height));
      setAutoDetected(false);
    }
  }, []);

  const confirm = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !quad) return;

    setIsFinishing(true);
    // Yield a frame so the spinner paints before the synchronous warp.
    window.setTimeout(() => {
      try {
        const dataUrl = processDocument(canvas, { quad, mode, rotation });
        const ocrDataUrl = processDocument(canvas, { quad, mode: 'gray', rotation, quality: 0.92 });
        onConfirm({ dataUrl, ocrDataUrl, quad, mode, rotation });
      } finally {
        setIsFinishing(false);
      }
    }, 30);
  }, [quad, mode, rotation, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-100">Adjust Crop</p>
          <p className="text-[11px] text-slate-400">
            {autoDetected ? 'Edges detected — drag the corners to fine-tune' : 'Drag the corners onto the bill'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="p-2 -mr-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
          aria-label="Rotate 90 degrees"
        >
          <RotateCw className="w-5 h-5" />
        </button>
      </div>

      {/* Crop stage */}
      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
        {isPreparing ? (
          <div className="flex flex-col items-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Detecting bill edges…</span>
          </div>
        ) : (
          <div
            className="relative touch-none select-none"
            style={{ width: layout.width, height: layout.height }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              src={sourceImage}
              alt="Captured bill"
              draggable={false}
              className="absolute inset-0 w-full h-full object-fill rounded-lg"
            />

            {displayQuad && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
              >
                <defs>
                  <mask id="cropMask">
                    <rect x="0" y="0" width={layout.width} height={layout.height} fill="white" />
                    <polygon points={displayQuad.map((p) => `${p.x},${p.y}`).join(' ')} fill="black" />
                  </mask>
                </defs>

                {/* Dim everything outside the selection */}
                <rect
                  x="0"
                  y="0"
                  width={layout.width}
                  height={layout.height}
                  fill="rgba(2,6,23,0.62)"
                  mask="url(#cropMask)"
                />

                <polygon
                  points={displayQuad.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#00A3E0"
                  strokeWidth={2}
                />

                {displayQuad.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={13} fill="rgba(0,163,224,0.25)" />
                    <circle cx={p.x} cy={p.y} r={7} fill="#00A3E0" stroke="#ffffff" strokeWidth={2} />
                  </g>
                ))}
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap transition ${
                mode === m.id
                  ? 'bg-[#00A3E0]/20 border-[#00A3E0]/60 text-[#7fd8f7]'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {m.label}
            </button>
          ))}

          <span className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={redetect}
            title="Detect the edges again"
            aria-label="Auto detect edges"
            className="p-2 rounded-full border bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300 shrink-0 transition"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetToFullFrame}
            title="Select the whole photo"
            aria-label="Select whole photo"
            className="p-2 rounded-full border bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300 shrink-0 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isPreparing || isFinishing || !quad}
            className="flex-[1.6] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-extrabold transition flex items-center justify-center gap-2"
          >
            {isFinishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Slightly inset default selection, so every handle is reachable by thumb. */
function insetFrameQuad(w: number, h: number): Quad {
  const mx = w * 0.06;
  const my = h * 0.06;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my }
  ];
}
