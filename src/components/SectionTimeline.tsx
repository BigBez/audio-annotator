import { useState } from 'react';
import { formatTime, parseTime, type Section } from '@/lib/sections';
import { X, Pencil, Check } from 'lucide-react';

interface SectionTimelineProps {
  sections: Section[];
  currentTime: number;
  duration: number;
  selectedId: string | null;
  isPlaying: boolean;
  onSelectedIdChange: (id: string | null) => void;
  onSeek: (time: number) => void;
  onLabelChange: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onBoundaryEdit: (id: string, field: 'start' | 'end', value: number) => void;
  onNotesChange: (id: string, notes: string) => void;
}

export default function SectionTimeline({
  sections,
  currentTime,
  duration,
  selectedId,
  isPlaying,
  onSelectedIdChange,
  onSeek,
  onLabelChange,
  onDelete,
  onBoundaryEdit,
  onNotesChange,
}: SectionTimelineProps) {
  const setSelectedId = onSelectedIdChange;
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [timeValue, setTimeValue] = useState('');

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-muted-foreground font-mono text-sm">No sections yet</p>
        <p className="text-muted-foreground text-xs mt-1">Press Enter during playback to mark boundaries</p>
      </div>
    );
  }

  const activeSection = sections.find(s => currentTime >= s.start && currentTime < s.end);

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      {/* Horizontal timeline blocks */}
      <div className="flex w-full h-10 rounded-lg overflow-hidden border border-border">
        {sections.map(section => {
          const widthPercent = ((section.end - section.start) / duration) * 100;
          const isActive = activeSection?.id === section.id;
          const isSelected = selectedId === section.id;

          return (
            <div
              key={section.id}
              className="relative flex items-center justify-center cursor-pointer transition-all overflow-hidden"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: section.color,
                opacity: isActive ? 1 : 0.7,
                boxShadow: isActive ? 'inset 0 0 0 2px hsl(var(--foreground) / 0.5)' : 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(isSelected ? null : section.id);
                onSeek(section.start);
              }}
            >
              {editingLabel === section.id ? (
                <input
                  autoFocus
                  value={labelValue}
                  onChange={e => setLabelValue(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { onLabelChange(section.id, labelValue); setEditingLabel(null); }
                    if (e.key === 'Escape') setEditingLabel(null);
                  }}
                  onBlur={() => { onLabelChange(section.id, labelValue); setEditingLabel(null); }}
                  onClick={e => e.stopPropagation()}
                  className="bg-secondary/80 border border-border rounded px-1.5 py-0.5 text-xs font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-20 text-center"
                />
              ) : (
                <span className="text-xs font-display font-medium text-white truncate px-1 drop-shadow-sm select-none">
                  {section.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail row for selected section */}
      {selectedId && (() => {
        const section = sections.find(s => s.id === selectedId);
        if (!section) return null;

        return (
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-card border border-border text-sm font-mono flex-1">
            {/* Color dot */}
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: section.color }} />

            {/* Editable label */}
            {editingLabel === section.id ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  value={labelValue}
                  onChange={e => setLabelValue(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onLabelChange(section.id, labelValue); setEditingLabel(null); }
                    if (e.key === 'Escape') setEditingLabel(null);
                  }}
                  onBlur={() => { onLabelChange(section.id, labelValue); setEditingLabel(null); }}
                  className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-24"
                />
              </div>
            ) : (
              <button
                onClick={() => { setEditingLabel(section.id); setLabelValue(section.label); }}
                className="text-xs font-display font-medium text-foreground hover:text-primary flex items-center gap-1"
              >
                {section.label}
                <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )}

            <span className="text-muted-foreground text-xs">|</span>

            {/* Editable start time */}
            {editingTime?.id === section.id && editingTime.field === 'start' ? (
              <input
                autoFocus
                value={timeValue}
                onChange={e => setTimeValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const parsed = parseTime(timeValue);
                    if (parsed !== null) onBoundaryEdit(section.id, 'start', parsed);
                    setEditingTime(null);
                  }
                  if (e.key === 'Escape') setEditingTime(null);
                }}
                onBlur={() => {
                  const parsed = parseTime(timeValue);
                  if (parsed !== null) onBoundaryEdit(section.id, 'start', parsed);
                  setEditingTime(null);
                }}
                className="bg-secondary border border-border rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring w-14 text-center"
              />
            ) : (
              <button
                onClick={() => { setEditingTime({ id: section.id, field: 'start' }); setTimeValue(formatTime(section.start)); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {formatTime(section.start)}
              </button>
            )}

            <span className="text-muted-foreground text-xs">–</span>

            {/* Editable end time */}
            {editingTime?.id === section.id && editingTime.field === 'end' ? (
              <input
                autoFocus
                value={timeValue}
                onChange={e => setTimeValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const parsed = parseTime(timeValue);
                    if (parsed !== null) onBoundaryEdit(section.id, 'end', parsed);
                    setEditingTime(null);
                  }
                  if (e.key === 'Escape') setEditingTime(null);
                }}
                onBlur={() => {
                  const parsed = parseTime(timeValue);
                  if (parsed !== null) onBoundaryEdit(section.id, 'end', parsed);
                  setEditingTime(null);
                }}
                className="bg-secondary border border-border rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring w-14 text-center"
              />
            ) : (
              <button
                onClick={() => { setEditingTime({ id: section.id, field: 'end' }); setTimeValue(formatTime(section.end)); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {formatTime(section.end)}
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Delete button — only on manual selection, not playback-driven */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(null);
                onDelete(section.id);
              }}
              className="shrink-0 p-1 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
              title="Delete section"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* Notes panel */}
      <div className="rounded-lg border border-border bg-card p-3 h-32 overflow-y-auto">
        {selectedId && sections.find(s => s.id === selectedId) ? (
          <textarea
            value={sections.find(s => s.id === selectedId)!.notes}
            onChange={e => onNotesChange(selectedId, e.target.value)}
            placeholder="Add notes for this section…"
            className="w-full h-full bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none resize-none"
          />
        ) : (
          <p className="text-muted-foreground text-sm font-mono">Select a section to add notes.</p>
        )}
      </div>
    </div>
  );
}
