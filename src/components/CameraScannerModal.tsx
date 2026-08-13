import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, ZapOff, Camera, RefreshCw, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { detectDocumentQuad, estimateFocus, quadDrift, Quad } from '../services/documentScanner';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fires with the full-resolution frame plus the detected corners (frame space). */
  onCapture: (frameDataUrl: string, quad: Quad | null) => void;
  /** Escape hatch when getUserMedia is unavailable or blocked. */
  onFallbackToFilePicker?: () => void;
}

/** Consecutive stable detections required before the shutter fires. */
const STABLE_FRAMES_REQUIRED = 8;
/** Maximum corner movement (fraction of frame diagonal) still counted as "still". */
const STABLE_DRIFT_LIMIT = 0.02;
/** Detection cadence — full detection on every frame is wasteful on phones. */
const DETECT_INTERVAL_MS = 110;
/**
 * Laplacian spread below which the frame is still focusing. Calibrated against
 * rendered blur: a sharp page scores ~50, 2px of blur ~19, 3px ~10, 5px ~5.
 * A steady phone that has not focused yet is perfectly stable, so without this
 * the auto-shutter fires on an unreadable frame.
 */
const FOCUS_MIN = 12;
/** After this long stuck out of focus, tell the user to take the shot manually. */
const FOCUS_HINT_AFTER_MS = 3000;

type CameraState = 'idle' | 'starting' | 'live' | 'error';

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onFallbackToFilePicker
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const quadRef = useRef<Quad | null>(null);
  const stableCountRef = useRef(0);
  const lastDetectRef = useRef(0);
  const capturedRef = useRef(false);
  const focusRef = useRef(0);
  const waitingForFocusSinceRef = useRef(0);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [autoCapture, setAutoCapture] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [hint, setHint] = useState('Point the camera at the bill');
  const [stableProgress, setStableProgress] = useState(0);

  const autoCaptureRef = useRef(autoCapture);
  useEffect(() => {
    autoCaptureRef.current = autoCapture;
  }, [autoCapture]);

  // Held in a ref so a re-render of the parent form cannot change the identity
  // of the start/stop callbacks and restart the camera mid-session.
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  /** Grabs the current video frame at full sensor resolution. */
  const grabFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  const doCapture = useCallback(() => {
    if (capturedRef.current) return;
    const canvas = grabFrame();
    if (!canvas) return;
    capturedRef.current = true;

    const quad = quadRef.current;
    stopCamera();
    onCaptureRef.current(canvas.toDataURL('image/jpeg', 0.92), quad);
  }, [grabFrame, stopCamera]);

  /** Detection + overlay loop. */
  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);

    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || !video.videoWidth || capturedRef.current) return;

    // Keep the overlay pixel grid matched to the video's intrinsic frame.
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    }

    const now = performance.now();
    if (now - lastDetectRef.current >= DETECT_INTERVAL_MS) {
      lastDetectRef.current = now;

      if (!workCanvasRef.current) workCanvasRef.current = document.createElement('canvas');
      const work = workCanvasRef.current;

      // Detection runs on a reduced frame; the engine downscales again internally.
      const targetW = 480;
      const scale = Math.min(1, targetW / video.videoWidth);
      work.width = Math.round(video.videoWidth * scale);
      work.height = Math.round(video.videoHeight * scale);

      const wctx = work.getContext('2d', { willReadFrequently: true });
      if (wctx) {
        wctx.drawImage(video, 0, 0, work.width, work.height);
        const frame = wctx.getImageData(0, 0, work.width, work.height);
        const detection = detectDocumentQuad(frame);
        focusRef.current = detection ? estimateFocus(frame, detection.quad) : 0;

        if (detection) {
          const inv = 1 / scale;
          const scaled = detection.quad.map((p) => ({ x: p.x * inv, y: p.y * inv })) as Quad;
          const diag = Math.hypot(video.videoWidth, video.videoHeight);
          const previous = quadRef.current;

          if (previous && quadDrift(previous, scaled, diag) < STABLE_DRIFT_LIMIT) {
            stableCountRef.current = Math.min(STABLE_FRAMES_REQUIRED, stableCountRef.current + 1);
          } else {
            stableCountRef.current = 1;
          }

          // Smooth the outline so it does not jitter frame to frame.
          quadRef.current = previous
            ? (previous.map((p, i) => ({
                x: p.x * 0.55 + scaled[i].x * 0.45,
                y: p.y * 0.55 + scaled[i].y * 0.45
              })) as Quad)
            : scaled;

          const steady = stableCountRef.current >= STABLE_FRAMES_REQUIRED;
          const focused = focusRef.current >= FOCUS_MIN;

          // Track how long the page has been steady but still soft.
          if (steady && !focused) {
            if (waitingForFocusSinceRef.current === 0) waitingForFocusSinceRef.current = now;
          } else {
            waitingForFocusSinceRef.current = 0;
          }
          const stuckOnFocus =
            waitingForFocusSinceRef.current > 0 && now - waitingForFocusSinceRef.current > FOCUS_HINT_AFTER_MS;

          setStableProgress(stableCountRef.current / STABLE_FRAMES_REQUIRED);
          setHint(
            !steady
              ? 'Bill detected — hold steady'
              : !focused
              ? stuckOnFocus
                ? 'Still blurry — tap the shutter to capture anyway'
                : 'Hold steady — focusing…'
              : autoCaptureRef.current
              ? 'Capturing…'
              : 'Bill in focus — tap the shutter'
          );

          // Never fire the shutter on a frame that has not come into focus.
          if (autoCaptureRef.current && steady && focused) {
            doCapture();
            return;
          }
        } else {
          quadRef.current = null;
          stableCountRef.current = 0;
          waitingForFocusSinceRef.current = 0;
          setStableProgress(0);
          setHint('Place the bill on a contrasting surface');
        }
      }
    }

    // Draw the outline.
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const quad = quadRef.current;
    if (!quad) return;

    // Green means ready; amber means steady but still soft.
    const steady = stableCountRef.current >= STABLE_FRAMES_REQUIRED;
    const locked = steady && focusRef.current >= FOCUS_MIN;
    const accent = locked ? '#22c55e' : steady ? '#f59e0b' : '#00A3E0';
    const unit = Math.max(2, overlay.width / 320);

    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(quad[i].x, quad[i].y);
    ctx.closePath();

    ctx.fillStyle = locked
      ? 'rgba(34,197,94,0.18)'
      : steady
      ? 'rgba(245,158,11,0.16)'
      : 'rgba(0,163,224,0.14)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = unit * 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Corner markers.
    ctx.fillStyle = accent;
    for (const p of quad) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, unit * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [doCapture]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setErrorMessage('This browser does not support live camera access.');
      return;
    }

    setCameraState('starting');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        },
        audio: false
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(Boolean(capabilities.torch));

      setCameraState('live');
      capturedRef.current = false;
      stableCountRef.current = 0;
      quadRef.current = null;
      focusRef.current = 0;
      waitingForFocusSinceRef.current = 0;

      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setCameraState('error');
      const name = err instanceof DOMException ? err.name : '';
      setErrorMessage(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings, or upload the photo instead.'
          : name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : 'Could not start the camera on this device.'
      );
    }
  }, [tick]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      // `torch` is a well supported non-standard constraint on Android Chrome.
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  useEffect(() => {
    if (isOpen) {
      capturedRef.current = false;
      startCamera();
    }
    return () => {
      stopCamera();
      setTorchOn(false);
      setCameraState('idle');
    };
    // startCamera/stopCamera are stable callbacks.
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5" />
        </button>

        <span className="text-sm font-bold tracking-wide">Scan Bill</span>

        <button
          type="button"
          onClick={toggleTorch}
          disabled={!torchSupported}
          className={`p-2 -mr-2 rounded-lg transition ${
            torchSupported ? 'hover:bg-white/10' : 'opacity-30'
          } ${torchOn ? 'text-amber-400' : 'text-white'}`}
          aria-label="Toggle flashlight"
        >
          {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-contain"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {cameraState === 'starting' && (
          <div className="relative z-10 flex flex-col items-center text-white/80">
            <RefreshCw className="w-7 h-7 animate-spin mb-2" />
            <span className="text-sm">Starting camera…</span>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="relative z-10 max-w-sm mx-6 text-center text-white">
            <AlertTriangle className="w-9 h-9 mx-auto mb-3 text-amber-400" />
            <p className="text-sm leading-relaxed text-white/85">{errorMessage}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition"
              >
                Try again
              </button>
              {onFallbackToFilePicker && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onFallbackToFilePicker();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00A3E0] hover:bg-[#0090c8] text-sm font-bold transition flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  Use photo instead
                </button>
              )}
            </div>
          </div>
        )}

        {cameraState === 'live' && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur">
              {hint}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 bg-black/85 px-6 pt-4 pb-7 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAutoCapture((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
            autoCapture
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-white/5 border-white/20 text-white/60'
          }`}
        >
          AUTO {autoCapture ? 'ON' : 'OFF'}
        </button>

        {/* Shutter with stability ring */}
        <button
          type="button"
          onClick={doCapture}
          disabled={cameraState !== 'live'}
          className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center disabled:opacity-40"
          aria-label="Capture"
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="33" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
            <circle
              cx="36"
              cy="36"
              r="33"
              fill="none"
              stroke="#22c55e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 33}
              strokeDashoffset={2 * Math.PI * 33 * (1 - stableProgress)}
              className="transition-[stroke-dashoffset] duration-100"
            />
          </svg>
          <span className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
            <Camera className="w-6 h-6 text-slate-900" />
          </span>
        </button>

        {onFallbackToFilePicker ? (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onFallbackToFilePicker();
            }}
            className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            aria-label="Choose from gallery"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>
    </div>
  );
};

