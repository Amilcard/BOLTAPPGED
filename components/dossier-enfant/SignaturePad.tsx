'use client';
import { useRef, useEffect, useCallback } from 'react';

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export function SignaturePad({ value, onChange, disabled = false, label }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (value && value.startsWith('data:')) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const onPointerUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onChange(dataUrl);
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    onChange(null);
  }, [onChange]);

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-gray-700">{label}</p>}
      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-24 touch-none cursor-crosshair"
          style={{ display: 'block' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-1 right-1 text-xs text-gray-400 hover:text-gray-600 bg-white/80 px-1 rounded"
          >
            Effacer
          </button>
        )}
      </div>
      {!value && !disabled && (
        <p className="text-xs text-gray-400">Signez dans le cadre ci-dessus</p>
      )}
      {value && (
        <p className="text-xs text-green-600">✓ Signature enregistrée</p>
      )}
    </div>
  );
}
