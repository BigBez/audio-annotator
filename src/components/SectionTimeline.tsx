import { useState } from 'react';
import { formatTime, parseTime, type Section, type VcuSpan } from '@/lib/sections';
import { X, Pencil } from 'lucide-react';

interface SectionTimelineProps {
  sections: Section[];
  vcuSpans: VcuSpan[];
  currentTime: number;
  duration: number;
  selectedId: string | null;
  selectedVcuId: string | null;
  shiftSelectedIds: Set<string>;
  isPlaying: boolean;
  onSelectedIdChange: (id: string | null) => void;
  onSelectedVcuIdChange: (id: string | null) => void;
  onShiftSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onLabelChange: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onBoundaryEdit: (id: string, field: 'start' | 'end', value: number) => void;
  onNotesChange: (id: string, notes: string) => void;
  onVcuLabelChange: (id: string, label: string) => void;
  onDeleteVcu: (id: string) => void;
  barCountLayer?: React.ReactNode;
}

export default function SectionTimeline({
  sections,
  vcuSpans,
  currentTime,
  duration,
  selectedId,
  selectedVcuId,
  shiftSelectedIds,
  isPlaying,
  onSelectedIdChange,
  onSelectedVcuIdChange,
  onShiftSelect,
  onSeek,
  onLabelChange,
  onDelete,
  onBoundaryEdit,
  onNotesChange,
  onVcuLabelChange,
  onDeleteVcu,
  barCountLayer,
}: SectionTimelineProps) {
  const setSelectedId = onSelectedIdChange;
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const [editingVcuLabel, setEditingVcuLabel] = useState<string | null>(null);
  const [vcuLabelValue, setVcuLabelValue] = useState('');

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-muted-foreground font-mono text-sm">No sections yet</p>
        <p className="text-muted-foreground text-xs mt-1">Press Enter during playback to mark boundaries</p>
      </div>
    );
  }

  const activeSection = sections.find(s => currentTime >= s.start && currentTime < s.end);

  // Find VCU for a section
  const getVcuForSection = (sectionId: string) => vcuSpans.find(v => v.sectionIds.includes(sectionId));

  // Compute VCU time range
  const getVcuTimeRange = (vcu: VcuSpan) => {
    const vcuSections = vcu.sectionIds.map(id => sections.find(s => s.id === id)).filter(Boolean) as Section[];
    if (vcuSections.length === 0) return { start: 0, end: 0 };
    return {
      start: Math.min(...vcuSections.map(s => s.start)),
      end: Math.max(...vcuSections.map(s => s.end)),
    };
  };

  // Selected section and its VCU
  const selectedSection = selectedId ? sections.find(s => s.id === selectedId) : null;
  const selectedSectionVcu = selectedId ? getVcuForSection(selectedId) : null;
  const selectedVcu = selectedVcuId ? vcuSpans.find(v => v.id === selectedVcuId) : null;

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      {/* VCU lane — only if VCUs exist */}
      {vcuSpans.length > 0 && (
        <div className="relative w-full h-8 mb-1">
          {vcuSpans.map(vcu => {
            const range = getVcuTimeRange(vcu);
            if (range.end <= range.start) return null;
            const leftPercent = (range.start / duration) * 100;
            const widthPercent = ((range.end - range.start) / duration) * 100;
            const isSelected = selectedVcuId === vcu.id;

            return (
              <div
                key={vcu.id}
                className="absolute cursor-pointer"
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  top: 0,
                  bottom: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectedVcuIdChange(isSelected ? null : vcu.id);
                }}
              >
                {/* Label */}
                <div className="absolute inset-x-0 top-0 flex justify-center">
                  <span className={`text-[10px] font-mono select-none ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {vcu.label}
                  </span>
                </div>
                {/* Bracket: horizontal line + vertical ticks */}
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  {/* Left tick */}
                  <line x1="0" y1="14" x2="0" y2="100%" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={isSelected ? 0.8 : 0.4} />
                  {/* Right tick */}
                  <line x1="100%" y1="14" x2="100%" y2="100%" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={isSelected ? 0.8 : 0.4} />
                  {/* Horizontal bar */}
                  <line x1="0" y1="14" x2="100%" y2="14" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={isSelected ? 0.8 : 0.4} />
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* Shift-select hint */}
      {shiftSelectedIds.size > 0 && (
        <p className="text-[11px] font-mono text-muted-foreground text-center">Press G to group selected sections</p>
      )}

      {/* Horizontal timeline blocks */}
      <div className="flex w-full h-10 rounded-lg overflow-hidden border border-border">
        {sections.map(section => {
          const widthPercent = ((section.end - section.start) / duration) * 100;
          const isActive = activeSection?.id === section.id;
          const isSelected = selectedId === section.id;
          const isShiftSelected = shiftSelectedIds.has(section.id);

          return (
            <div
              key={section.id}
              className="relative flex items-center justify-center cursor-pointer transition-all overflow-hidden"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: section.color,
                opacity: isActive ? 1 : isShiftSelected ? 0.9 : 0.7,
                boxShadow: isActive
                  ? 'inset 0 0 0 2px hsl(var(--foreground) / 0.5)'
                  : isShiftSelected
                  ? 'inset 0 0 0 2px hsl(var(--primary) / 0.8)'
                  : 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  onShiftSelect(section.id);
                } else {
                  setSelectedId(isSelected ? null : section.id);
                  onSeek(section.start);
                }
              }}
            >
              <span className="text-xs font-display font-medium text-white truncate px-1 drop-shadow-sm select-none">
                {section.label}
              </span>
            </div>
          );
        })}
      </div>

      {barCountLayer}

      {/* Detail strip */}
      {/* State 3: VCU selected directly */}
      {selectedVcu && (() => {
        const range = getVcuTimeRange(selectedVcu);
        return (
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-card border border-border text-sm font-mono">
            {editingVcuLabel === selectedVcu.id ? (
              <input
                autoFocus
                onFocus={e => e.target.select()}
                value={vcuLabelValue}
                onChange={e => setVcuLabelValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onVcuLabelChange(selectedVcu.id, vcuLabelValue); setEditingVcuLabel(null); }
                  if (e.key === 'Escape') setEditingVcuLabel(null);
                }}
                onBlur={() => { onVcuLabelChange(selectedVcu.id, vcuLabelValue); setEditingVcuLabel(null); }}
                className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-20"
              />
            ) : (
              <button
                onClick={() => { setEditingVcuLabel(selectedVcu.id); setVcuLabelValue(selectedVcu.label); }}
                className="text-xs font-display font-medium text-foreground hover:text-primary flex items-center gap-1"
              >
                {selectedVcu.label}
                <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )}
            <span className="text-muted-foreground text-xs">|</span>
            <span className="text-xs text-muted-foreground">{formatTime(range.start)}</span>
            <span className="text-muted-foreground text-xs">–</span>
            <span className="text-xs text-muted-foreground">{formatTime(range.end)}</span>
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteVcu(selectedVcu.id); }}
              className="shrink-0 p-1 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
              title="Remove grouping"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* State 2: Section selected that belongs to a VCU */}
      {selectedSection && selectedSectionVcu && (() => {
        const range = getVcuTimeRange(selectedSectionVcu);
        return (
          <div className="space-y-0">
            {/* VCU row */}
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-t-md bg-card border border-border border-b-0 text-sm font-mono">
              {editingVcuLabel === selectedSectionVcu.id ? (
                <input
                  autoFocus
                  onFocus={e => e.target.select()}
                  value={vcuLabelValue}
                  onChange={e => setVcuLabelValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onVcuLabelChange(selectedSectionVcu.id, vcuLabelValue); setEditingVcuLabel(null); }
                    if (e.key === 'Escape') setEditingVcuLabel(null);
                  }}
                  onBlur={() => { onVcuLabelChange(selectedSectionVcu.id, vcuLabelValue); setEditingVcuLabel(null); }}
                  className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-20"
                />
              ) : (
                <button
                  onClick={() => { setEditingVcuLabel(selectedSectionVcu.id); setVcuLabelValue(selectedSectionVcu.label); }}
                  className="text-xs font-display font-medium text-foreground hover:text-primary flex items-center gap-1"
                >
                  {selectedSectionVcu.label}
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                </button>
              )}
              <span className="text-muted-foreground text-xs">|</span>
              <span className="text-xs text-muted-foreground">{formatTime(range.start)}</span>
              <span className="text-muted-foreground text-xs">–</span>
              <span className="text-xs text-muted-foreground">{formatTime(range.end)}</span>
              <div className="flex-1" />
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteVcu(selectedSectionVcu.id); }}
                className="shrink-0 p-1 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
                title="Remove grouping"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Section row (indented) */}
            <div className="flex items-center gap-3 pl-5 pr-2 py-1.5 rounded-b-md bg-card border border-border text-sm font-mono">
              <span className="text-muted-foreground text-xs">↳</span>
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedSection.color }} />
              {renderSectionControls(selectedSection)}
            </div>
          </div>
        );
      })()}

      {/* State 1: Section selected, no VCU */}
      {selectedSection && !selectedSectionVcu && (
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-card border border-border text-sm font-mono">
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedSection.color }} />
          {renderSectionControls(selectedSection)}
        </div>
      )}

      {/* Notes panel */}
      <div className="rounded-lg border border-border bg-card p-3 h-32 overflow-y-auto">
        {selectedId && selectedSection ? (
          <textarea
            value={selectedSection.notes}
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

  function renderSectionControls(section: Section) {
    return (
      <>
        {/* Editable label */}
        {editingLabel === section.id ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              onFocus={(e) => e.target.select()}
              value={labelValue}
              onChange={e => setLabelValue(e.target.value)}
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

        <div className="flex-1" />

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
      </>
    );
  }
}
