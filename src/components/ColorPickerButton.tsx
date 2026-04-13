import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from 'lucide-react';
import { SECTION_COLORS } from '@/lib/sections';

interface ColorPickerButtonProps {
  activeColor?: string;
  mode: 'single' | 'multi';
  onColorSelect: (color: string) => void;
  usePortal?: boolean;
}

export default function ColorPickerButton({ activeColor, mode, onColorSelect, usePortal = false }: ColorPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && usePortal && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPortalPos({ top: rect.top, left: rect.left + rect.width / 2 });
    }
    setOpen(prev => !prev);
  }, [open, usePortal]);

  const popoverContent = open && (
    <div
      className={usePortal ? 'fixed z-50 bg-card border border-border rounded-lg p-2 shadow-md' : 'absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-lg p-2 shadow-md'}
      style={usePortal && portalPos ? { top: portalPos.top, left: portalPos.left, transform: 'translate(-50%, -100%) translateY(-4px)' } : undefined}
      onClick={e => e.stopPropagation()}
      ref={usePortal ? ref : undefined}
    >
      <div className="grid grid-cols-6 gap-1.5" style={{ width: 'max-content' }}>
        {SECTION_COLORS.map(color => (
          <button
            key={color}
            onClick={() => { onColorSelect(color); setOpen(false); }}
            className="rounded-full shrink-0 transition-transform hover:scale-125"
            style={{
              width: 20,
              height: 20,
              backgroundColor: color,
              boxShadow: activeColor === color ? '0 0 0 2px hsl(var(--background)), 0 0 0 3.5px hsl(var(--foreground))' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative" ref={usePortal ? undefined : ref}>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="shrink-0 rounded-full transition-transform hover:scale-110"
        title="Change color"
      >
        {mode === 'single' ? (
          <div
            className="rounded-full"
            style={{ width: 18, height: 18, backgroundColor: activeColor }}
          />
        ) : (
          <Palette className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {usePortal ? popoverContent && createPortal(popoverContent, document.body) : popoverContent}
    </div>
  );
}
