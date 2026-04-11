import { useState } from 'react';
import { formatTime, type Section } from '@/lib/sections';
import { Pencil, Check } from 'lucide-react';

interface SectionListProps {
  sections: Section[];
  currentTime: number;
  onLabelChange: (id: string, label: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onSeek: (time: number) => void;
}

export default function SectionList({ sections, currentTime, onLabelChange, onNotesChange, onSeek }: SectionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground font-mono text-sm">No sections yet</p>
        <p className="text-muted-foreground text-xs mt-1">Press Enter during playback to mark boundaries</p>
      </div>
    );
  }

  const activeSection = sections.find(s => currentTime >= s.start && currentTime < s.end);

  return (
    <div className="space-y-1.5">
      {sections.map(section => {
        const isActive = activeSection?.id === section.id;
        const isEditing = editingId === section.id;

        return (
          <div
            key={section.id}
            className={`group rounded-lg border p-3 transition-colors cursor-pointer ${
              isActive
                ? 'border-primary/50 bg-accent/20'
                : 'border-border bg-card hover:bg-secondary/50'
            }`}
            onClick={() => onSeek(section.start)}
          >
            <div className="flex items-center gap-3">
              {/* Color dot */}
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: section.color }} />

              {/* Label */}
              {isEditing ? (
                <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        onLabelChange(section.id, editValue);
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="bg-secondary border border-border rounded px-2 py-0.5 text-sm font-medium font-display text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => { onLabelChange(section.id, editValue); setEditingId(null); }}
                    className="text-primary hover:text-primary/80"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium font-display flex-1">{section.label}</span>
              )}

              {/* Time range */}
              <span className="text-xs font-mono text-muted-foreground">
                {formatTime(section.start)} – {formatTime(section.end)}
              </span>

              {/* Edit button */}
              {!isEditing && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setEditingId(section.id);
                    setEditValue(section.label);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <textarea
                placeholder="Add notes…"
                value={section.notes}
                onChange={e => onNotesChange(section.id, e.target.value)}
                rows={1}
                className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 resize-none outline-none font-mono"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
