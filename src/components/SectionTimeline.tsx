import { useState, useRef, useEffect, useCallback } from 'react';
import { formatTime, parseTime, type Section, type VcuSpan, type ChordLine, type LyricLine } from '@/lib/sections';
import { ChevronRight } from 'lucide-react';
import ChordPanel from '@/components/ChordPanel';
import LyricsPanel from '@/components/LyricsPanel';
import { X, Pencil } from 'lucide-react';
import ColorPickerButton from '@/components/ColorPickerButton';

interface SectionTimelineProps {
  sections: Section[];
  vcuSpans: VcuSpan[];
  currentTime: number;
  duration: number;
  selectedId: string | null;
  selectedVcuId: string | null;
  shiftSelectedIds: Set<string>;
  cmdSelectedIds: Set<string>;
  isPlaying: boolean;
  onSelectedIdChange: (id: string | null) => void;
  onSelectedVcuIdChange: (id: string | null) => void;
  onShiftSelect: (id: string) => void;
  onCmdSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onLabelChange: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onBoundaryEdit: (id: string, field: 'start' | 'end', value: number) => void;
  onNotesChange: (id: string, notes: string) => void;
  onChordLinesChange: (id: string, chordLines: ChordLine[]) => void;
  onColorChange: (ids: string[], color: string) => void;
  onLyricLinesChange: (id: string, lyricLines: LyricLine[]) => void;
  onVcuLabelChange: (id: string, label: string) => void;
  onDeleteVcu: (id: string) => void;
  
}

export default function SectionTimeline({
  sections,
  vcuSpans,
  currentTime,
  duration,
  selectedId,
  selectedVcuId,
  shiftSelectedIds,
  cmdSelectedIds,
  isPlaying,
  onSelectedIdChange,
  onSelectedVcuIdChange,
  onShiftSelect,
  onCmdSelect,
  onSeek,
  onLabelChange,
  onDelete,
  onBoundaryEdit,
  onNotesChange,
  onChordLinesChange,
  onColorChange,
  onLyricLinesChange,
  onVcuLabelChange,
  onDeleteVcu,
  
}: SectionTimelineProps) {
  const setSelectedId = onSelectedIdChange;
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const [editingVcuLabel, setEditingVcuLabel] = useState<string | null>(null);
  const [vcuLabelValue, setVcuLabelValue] = useState('');
  const [chordsOpen, setChordsOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Height-locking during playback to prevent layout shifts
  const [lockedHeights, setLockedHeights] = useState<{ chords: number; lyrics: number; notes: number } | null>(null);
  const chordsContentRef = useRef<HTMLDivElement>(null);
  const lyricsContentRef = useRef<HTMLDivElement>(null);
  const notesContentRef = useRef<HTMLDivElement>(null);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (isPlaying && !wasPlayingRef.current) {
      setLockedHeights({
        chords: chordsContentRef.current?.scrollHeight ?? 0,
        lyrics: lyricsContentRef.current?.scrollHeight ?? 0,
        notes: notesContentRef.current?.scrollHeight ?? 0,
      });
    } else if (!isPlaying && wasPlayingRef.current) {
      setLockedHeights(null);
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying || !lockedHeights) return;
    const raf = requestAnimationFrame(() => {
      setLockedHeights(prev => {
        if (!prev) return prev;
        return {
          chords: Math.max(prev.chords, chordsContentRef.current?.scrollHeight ?? 0),
          lyrics: Math.max(prev.lyrics, lyricsContentRef.current?.scrollHeight ?? 0),
          notes: Math.max(prev.notes, notesContentRef.current?.scrollHeight ?? 0),
        };
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, selectedId, lockedHeights]);

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-muted-foreground font-mono text-sm">No sections yet</p>
        <p className="text-muted-foreground text-xs mt-1">Press Enter during playback to mark boundaries</p>
      </div>
    );
  }

  const activeSection = sections.find(s => currentTime >= s.start && currentTime < s.end);

  const getVcuForSection = (sectionId: string) => vcuSpans.find(v => v.sectionIds.includes(sectionId));

  const getVcuTimeRange = (vcu: VcuSpan) => {
    const vcuSections = vcu.sectionIds.map(id => sections.find(s => s.id === id)).filter(Boolean) as Section[];
    if (vcuSections.length === 0) return { start: 0, end: 0 };
    return {
      start: Math.min(...vcuSections.map(s => s.start)),
      end: Math.max(...vcuSections.map(s => s.end)),
    };
  };

  const selectedSection = selectedId ? sections.find(s => s.id === selectedId) : null;
  const selectedSectionVcu = selectedId ? getVcuForSection(selectedId) : null;
  const selectedVcu = selectedVcuId ? vcuSpans.find(v => v.id === selectedVcuId) : null;

  // Determine if we're in multi-select mode
  const multiSelectedIds = new Set([...shiftSelectedIds, ...cmdSelectedIds]);
  const isMultiSelect = multiSelectedIds.size > 0;

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      {/* Multi-select hint */}
      {isMultiSelect && (
        <p className="text-[11px] font-mono text-muted-foreground text-center">Press G to group selected sections</p>
      )}

      {/* Horizontal timeline blocks */}
      <div className="flex w-full h-7 rounded-lg overflow-hidden border border-border">
        {sections.map(section => {
          const widthPercent = ((section.end - section.start) / duration) * 100;
          const isActive = activeSection?.id === section.id;
          const isSelected = selectedId === section.id;
          const isShiftSelected = shiftSelectedIds.has(section.id);
          const isCmdSelected = cmdSelectedIds.has(section.id);

          return (
            <div
              key={section.id}
              className="relative flex items-center justify-center cursor-pointer transition-all overflow-hidden"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: section.color,
                opacity: isActive ? 1 : (isShiftSelected || isCmdSelected) ? 0.9 : 0.7,
                boxShadow: isCmdSelected
                  ? 'inset 0 0 0 2px rgba(255, 255, 255, 0.9)'
                  : isActive
                  ? 'inset 0 0 0 2px hsl(var(--foreground) / 0.5)'
                  : isShiftSelected
                  ? 'inset 0 0 0 2px hsl(var(--primary) / 0.8)'
                  : 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  onShiftSelect(section.id);
                } else if (e.metaKey || e.ctrlKey) {
                  onCmdSelect(section.id);
                } else {
                  setSelectedId(section.id);
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

      {/* VCU lane — below section blocks, brackets open downward */}
      {vcuSpans.length > 0 && (
        <div className="relative w-full h-8 -mt-1">
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
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={isSelected ? 0.8 : 0.4} />
                  <line x1="100%" y1="0" x2="100%" y2="10" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={isSelected ? 0.8 : 0.4} />
                  <line x1="0" y1="10" x2="100%" y2="10" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={isSelected ? 0.8 : 0.4} />
                </svg>
                <div className="absolute inset-x-0 bottom-0 flex justify-center">
                  <span className={`text-[10px] font-mono select-none ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {vcu.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail strip — State B: multi-select */}
      {isMultiSelect && (
        <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded-md bg-card border border-border text-sm font-mono">
          <ColorPickerButton mode="multi" onColorSelect={(color) => onColorChange(Array.from(multiSelectedIds), color)} />
          <span className="text-xs text-muted-foreground">{multiSelectedIds.size} sections selected</span>
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">G to group</span>
        </div>
      )}

      {/* Detail strip — State 3: VCU selected directly */}
      {!isMultiSelect && selectedVcu && (() => {
        const range = getVcuTimeRange(selectedVcu);
        return (
           <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded-md bg-card border border-border text-sm font-mono">
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

      {/* Detail strip — collapsible, for section selected with or without VCU */}
      {!isPlaying && !isMultiSelect && selectedSection && (
        <div className="mt-2 rounded-md bg-card border border-border overflow-hidden">
          <button
            onClick={() => setDetailsOpen(prev => !prev)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${detailsOpen ? 'rotate-90' : ''}`} />
            <span className={detailsOpen ? 'text-[10px] text-muted-foreground' : ''}>Details</span>
          </button>
          {detailsOpen && (
            <div className="px-2 pb-1.5">
              {selectedSectionVcu && (() => {
                const range = getVcuTimeRange(selectedSectionVcu);
                return (
                  <div className="space-y-0">
                    <div className="flex items-center gap-3 px-0 py-1 text-sm font-mono">
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
                    <div className="flex items-center gap-3 pl-3 py-1 text-sm font-mono">
                      <span className="text-muted-foreground text-xs">↳</span>
                      <ColorPickerButton mode="single" usePortal activeColor={selectedSection.color} onColorSelect={(color) => onColorChange([selectedSection.id], color)} />
                      {renderSectionControls(selectedSection)}
                    </div>
                  </div>
                );
              })()}
              {!selectedSectionVcu && (
                <div className="flex items-center gap-3 px-0 py-1 text-sm font-mono">
                  <ColorPickerButton mode="single" usePortal activeColor={selectedSection.color} onColorSelect={(color) => onColorChange([selectedSection.id], color)} />
                  {renderSectionControls(selectedSection)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsible panels */}
      {selectedId && selectedSection && (
        <div className="space-y-0">
          {/* Chords + Lyrics side by side */}
          <div className="flex gap-0">
            {/* Chords panel */}
            <div
              className="border border-border bg-card overflow-hidden rounded-tl-lg transition-all min-w-0"
              style={{ flex: chordsOpen && !lyricsOpen ? '1 1 100%' : !chordsOpen && lyricsOpen ? '0 0 auto' : '1 1 50%' }}
            >
              <button
                onClick={() => setChordsOpen(prev => !prev)}
                className={`w-full flex items-center gap-1.5 px-3 ${chordsOpen ? 'py-0.5' : 'py-1.5'} text-xs font-mono text-muted-foreground hover:text-foreground transition-colors`}
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${chordsOpen ? 'rotate-90' : ''}`} />
                <span className={chordsOpen ? 'text-[10px] text-muted-foreground' : ''}>Chords</span>
              </button>
              {chordsOpen && (
                <div ref={chordsContentRef} className="px-3 pb-2" style={lockedHeights ? { minHeight: lockedHeights.chords } : undefined}>
                  <ChordPanel
                    chordLines={selectedSection.chordLines}
                    currentTime={currentTime}
                    sectionStart={selectedSection.start}
                    sectionEnd={selectedSection.end}
                    isPlaying={isPlaying}
                    onChange={lines => onChordLinesChange(selectedId, lines)}
                  />
                </div>
              )}
            </div>

            {/* Lyrics panel */}
            <div
              className="border border-l-0 border-border bg-card overflow-hidden rounded-tr-lg transition-all min-w-0"
              style={{ flex: lyricsOpen && !chordsOpen ? '1 1 100%' : !lyricsOpen && chordsOpen ? '0 0 auto' : '1 1 50%' }}
            >
              <button
                onClick={() => setLyricsOpen(prev => !prev)}
                className={`w-full flex items-center gap-1.5 px-3 ${lyricsOpen ? 'py-0.5' : 'py-1.5'} text-xs font-mono text-muted-foreground hover:text-foreground transition-colors`}
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${lyricsOpen ? 'rotate-90' : ''}`} />
                <span className={lyricsOpen ? 'text-[10px] text-muted-foreground' : ''}>Lyrics</span>
              </button>
              {lyricsOpen && (
                <div ref={lyricsContentRef} className="px-3 pb-2" style={lockedHeights ? { minHeight: lockedHeights.lyrics } : undefined}>
                  <LyricsPanel
                    lyricLines={selectedSection.lyricLines}
                    currentTime={currentTime}
                    sectionStart={selectedSection.start}
                    sectionEnd={selectedSection.end}
                    isPlaying={isPlaying}
                    onChange={lines => onLyricLinesChange(selectedId!, lines)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes panel */}
          <div className="rounded-b-lg border-x border-b border-border bg-card overflow-hidden">
            <button
              onClick={() => setNotesOpen(prev => !prev)}
              className={`w-full flex items-center gap-1.5 px-3 ${notesOpen ? 'py-0.5' : 'py-1.5'} text-xs font-mono text-muted-foreground hover:text-foreground transition-colors`}
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${notesOpen ? 'rotate-90' : ''}`} />
              Notes
            </button>
            {notesOpen && (
              <div ref={notesContentRef} className="px-3 pb-2" style={lockedHeights ? { minHeight: lockedHeights.notes } : undefined}>
                <textarea
                  value={selectedSection.notes}
                  onChange={e => {
                    onNotesChange(selectedId, e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }}
                  ref={el => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                  placeholder="Add notes for this section…"
                  className="w-full min-h-[32px] bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none resize-none overflow-hidden"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderSectionControls(section: Section) {
    return (
      <>
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
