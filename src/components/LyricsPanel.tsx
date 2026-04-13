import { useState, useRef, useEffect, useCallback } from 'react';
import type { LyricLine } from '@/lib/sections';
import { Pencil, Check, Plus, X } from 'lucide-react';

interface LyricsPanelProps {
  lyricLines: LyricLine[];
  currentTime: number;
  sectionStart: number;
  sectionEnd: number;
  isPlaying: boolean;
  onChange: (lyricLines: LyricLine[]) => void;
}

export default function LyricsPanel({ lyricLines, currentTime, sectionStart, sectionEnd, isPlaying, onChange }: LyricsPanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [syncMode, setSyncMode] = useState(false);
  const [syncLineIdx, setSyncLineIdx] = useState(0);
  const [syncDraft, setSyncDraft] = useState<LyricLine[]>([]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const syncContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusIdx !== null && textareaRefs.current[focusIdx]) {
      textareaRefs.current[focusIdx]?.focus();
      setFocusIdx(null);
    }
  }, [focusIdx, lyricLines]);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const addLine = (afterIndex?: number) => {
    const newLine: LyricLine = {
      id: crypto.randomUUID(),
      text: '',
      startTime: null,
      endTime: null,
    };
    const next = [...lyricLines];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : next.length;
    next.splice(insertAt, 0, newLine);
    onChange(next);
    setFocusIdx(insertAt);
  };

  const removeLine = (lineIdx: number) => {
    if (lyricLines.length <= 1) {
      onChange([]);
      return;
    }
    const next = lyricLines.filter((_, i) => i !== lineIdx);
    onChange(next);
    if (lineIdx > 0) {
      setFocusIdx(lineIdx - 1);
    }
  };

  const updateText = (lineIdx: number, text: string) => {
    const next = lyricLines.map((line, i) => (i === lineIdx ? { ...line, text } : line));
    onChange(next);
  };

  // Enter sync mode — auto-stamp first line's startTime to section start
  const enterSync = () => {
    const draft = structuredClone(lyricLines);
    if (draft.length > 0) {
      draft[0] = { ...draft[0], startTime: sectionStart };
    }
    setSyncDraft(draft);
    setSyncLineIdx(0);
    setSyncMode(true);
    setEditMode(false);
  };

  // Exit sync mode — commit
  const commitSync = () => {
    onChange(syncDraft);
    setSyncMode(false);
  };

  // Exit sync mode — discard
  const discardSync = () => {
    setSyncMode(false);
  };

  // Stamp current line — Tab means "this line just ended"
  const stampLine = useCallback(() => {
    if (syncLineIdx >= lyricLines.length - 1) {
      // Last line — set its endTime to section end and auto-exit
      setSyncDraft(prev => {
        const next = [...prev];
        next[syncLineIdx] = { ...next[syncLineIdx], endTime: sectionEnd };
        return next;
      });
      setTimeout(() => {
        setSyncMode(false);
      }, 0);
    } else {
      // Set endTime of current line, startTime of next line
      setSyncDraft(prev => {
        const next = [...prev];
        next[syncLineIdx] = { ...next[syncLineIdx], endTime: currentTime };
        next[syncLineIdx + 1] = { ...next[syncLineIdx + 1], startTime: currentTime };
        return next;
      });
      setSyncLineIdx(prev => prev + 1);
    }
  }, [syncLineIdx, currentTime, sectionEnd, lyricLines.length]);


  // Auto-exit sync mode when playhead passes section end
  useEffect(() => {
    if (syncMode && currentTime >= sectionEnd) {
      commitSync();
    }
  }, [syncMode, currentTime, sectionEnd]);

  // Undo last stamp in sync mode
  const undoLastStamp = useCallback(() => {
    if (syncLineIdx === 0) return;
    setSyncDraft(prev => {
      const next = [...prev];
      // Clear current line's startTime
      next[syncLineIdx] = { ...next[syncLineIdx], startTime: null };
      // Clear previous line's endTime
      const prevIdx = syncLineIdx - 1;
      next[prevIdx] = { ...next[prevIdx], endTime: null };
      return next;
    });
    setSyncLineIdx(prev => prev - 1);
  }, [syncLineIdx]);

  // Clear all timecodes
  const clearTimecodes = () => {
    const cleared = lyricLines.map(line => ({ ...line, startTime: null, endTime: null }));
    onChange(cleared);
  };

  const hasAnyTimecodes = lyricLines.some(l => l.startTime !== null);

  // Tab key handler for sync mode
  useEffect(() => {
    if (!syncMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        stampLine();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        discardSync();
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undoLastStamp();
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [syncMode, stampLine, undoLastStamp]);

  // Determine active lyric line during playback
  const getActiveLyricIdx = (): number => {
    if (!isPlaying) return -1;
    for (let i = 0; i < lyricLines.length; i++) {
      const line = lyricLines[i];
      if (line.startTime === null) continue;
      const end = line.endTime ?? sectionEnd;
      if (currentTime >= line.startTime && currentTime < end) return i;
    }
    return -1;
  };
  const activeLyricIdx = getActiveLyricIdx();

  if (lyricLines.length === 0 && !editMode) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => { addLine(); setEditMode(true); }}
          className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-0" ref={syncContainerRef}>
      {/* Header controls */}
      <div className="flex justify-end gap-2 mb-1.5">
        {syncMode ? (
          <button
            onClick={commitSync}
            className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
          >
            <Check className="h-3 w-3" /> Done
          </button>
        ) : (
          <>
            {hasAnyTimecodes && (
              <button
                onClick={clearTimecodes}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            {lyricLines.length > 0 && (
              <button
                onClick={enterSync}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Sync
              </button>
            )}
            {editMode ? (
              <button
                onClick={() => setEditMode(false)}
                className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
              >
                <Check className="h-3 w-3" /> Done
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </>
        )}
      </div>

      {/* Sync mode hint */}
      {syncMode && (
        <p className="text-[10px] font-mono text-muted-foreground mb-1">
          Press <kbd className="px-0.5 border border-border rounded text-[9px]">Tab</kbd> to stamp · <kbd className="px-0.5 border border-border rounded text-[9px]">Esc</kbd> to cancel
        </p>
      )}

      {/* Lyric lines */}
      <div className="space-y-1">
        {(syncMode ? syncDraft : lyricLines).map((line, lineIdx) => (
          <div key={line.id}>
            {editMode && !syncMode ? (
              <div className="flex items-start gap-1">
                <textarea
                  ref={el => {
                    textareaRefs.current[lineIdx] = el;
                    autoResize(el);
                  }}
                  value={line.text}
                  onChange={e => {
                    updateText(lineIdx, e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const ta = e.target as HTMLTextAreaElement;
                      const cursorAtEnd = ta.selectionStart === ta.value.length;
                      if (cursorAtEnd) {
                        addLine(lineIdx);
                      }
                    }
                    if (e.key === 'Backspace' && line.text === '') {
                      e.preventDefault();
                      removeLine(lineIdx);
                    }
                  }}
                  rows={1}
                  placeholder="Lyric line…"
                  className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring resize-none overflow-hidden"
                />
                <button
                  onClick={() => removeLine(lineIdx)}
                  className="shrink-0 p-1 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors mt-0.5"
                  title="Remove line"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <p
                className={`text-sm font-mono leading-relaxed transition-colors ${
                  syncMode && lineIdx === syncLineIdx
                    ? 'border-l-2 border-primary pl-2 text-foreground bg-primary/5'
                    : syncMode && lineIdx < syncLineIdx
                    ? 'border-l-2 border-transparent pl-2 text-muted-foreground'
                    : syncMode
                    ? 'border-l-2 border-transparent pl-2 text-muted-foreground/60'
                    : activeLyricIdx === lineIdx
                    ? 'border-l-2 border-primary pl-2 text-foreground'
                    : 'text-foreground'
                }`}
              >
                {line.text || '\u00A0'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add line button */}
      {editMode && !syncMode && (
        <button
          onClick={() => addLine()}
          className="mt-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          <Plus className="h-3 w-3" /> Line
        </button>
      )}
    </div>
  );
}
