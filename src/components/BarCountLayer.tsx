import { useState } from 'react';
import type { Section } from '@/lib/sections';

interface BarCountLayerProps {
  sections: Section[];
  duration: number;
  onBarsChange: (id: string, bars: string | null) => void;
}

export default function BarCountLayer({ sections, duration, onBarsChange }: BarCountLayerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  if (sections.length === 0) return null;

  return (
    <div className="flex w-full h-6">
      {sections.map((section, i) => {
        const widthPercent = ((section.end - section.start) / duration) * 100;
        const isEditing = editingId === section.id;

        return (
          <div
            key={section.id}
            className="relative flex items-center justify-center"
            style={{
              width: `${widthPercent}%`,
              borderRight: i < sections.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditing) {
                setEditingId(section.id);
                setInputValue(section.bars ?? '');
              }
            }}
          >
            {isEditing ? (
              <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onBarsChange(section.id, inputValue.trim() || null);
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                  e.stopPropagation();
                }}
                onBlur={() => {
                  onBarsChange(section.id, inputValue.trim() || null);
                  setEditingId(null);
                }}
                className="w-12 bg-secondary border border-border rounded px-1 py-0 text-[11px] font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center"
              />
            ) : (
              <span className="text-[11px] font-mono text-muted-foreground select-none cursor-pointer">
                {section.bars ?? ''}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
