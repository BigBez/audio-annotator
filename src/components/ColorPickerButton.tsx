import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { SECTION_COLORS } from '@/lib/sections';

interface ColorPickerButtonProps {
  activeColor?: string;
  mode: 'single' | 'multi';
  size?: number;
  onColorSelect: (color: string) => void;
}

export default function ColorPickerButton({ activeColor, mode, onColorSelect }: ColorPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
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
      {open && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-lg p-2 shadow-md"
          onClick={e => e.stopPropagation()}
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
      )}
    </div>
  );
}
