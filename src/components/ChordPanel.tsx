import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChordLine, ChordBar } from '@/lib/sections';
import { Pencil, Check, Plus, Minus, X, Copy, ClipboardPaste } from 'lucide-react';

let chordClipboard: ChordLine[] | null = null;

interface ChordPanelProps {
  chordLines: ChordLine[];
  currentTime: number;
  sectionStart: number;
  sectionEnd: number;
  isPlaying: boolean;
  onChange: (chordLines: ChordLine[]) => void;
}

const barlineStyle: React.CSSProperties = { width: '1px', backgroundColor: 'rgba(255,255,255,0.3)', display: 'inline-block', height: '14px' };
const dotStyle: React.CSSProperties = { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)' };

function RepeatDots() {
  return (
    <span className="inline-flex flex-col items-center justify-center gap-[3px]" style={{ height: '14px' }}>
      <span style={dotStyle} />
      <span style={dotStyle} />
    </span>
  );
}

const barlinePatterns: [string, (isPrefix: boolean) => React.ReactNode][] = [
  ['|:', (isPrefix) => (
    <span className={`shrink-0 ${isPrefix ? 'mr-1' : 'ml-1'} inline-flex items-center gap-[2px]`}>
      <span style={barlineStyle} />
      <RepeatDots />
    </span>
  )],
  [':|', (isPrefix) => (
    <span className={`shrink-0 ${isPrefix ? 'mr-1' : 'ml-1'} inline-flex items-center gap-[2px]`}>
      <RepeatDots />
      <span style={barlineStyle} />
    </span>
  )],
  ['||', (isPrefix) => (
    <span className={`shrink-0 ${isPrefix ? 'mr-1' : 'ml-1'} inline-flex items-center gap-[1px]`}>
      <span style={barlineStyle} />
      <span style={barlineStyle} />
    </span>
  )],
  ['|', (isPrefix) => (
    <span className={`shrink-0 ${isPrefix ? 'mr-1' : 'ml-1'} inline-flex items-center`}>
      <span style={barlineStyle} />
    </span>
  )],
];

function renderBarline(text: string, isPrefix: boolean): React.ReactNode | null {
  const t = text.trim();
  for (const [symbol, render] of barlinePatterns) {
    if (t.startsWith(symbol)) {
      const rest = t.slice(symbol.length).trim();
      return (
        <span className={`shrink-0 inline-flex items-center ${isPrefix ? 'mr-1' : 'ml-1'}`}>
          {render(false)}
          {rest && <span className="text-xs font-mono text-muted-foreground ml-0.5">{rest}</span>}
        </span>
      );
    }
  }
  return null;
}

/** Flatten all bars across all chord lines into a sequential list with indices */
function flattenBars(chordLines: ChordLine[]): { lineIdx: number; barIdx: number; bar: ChordBar }[] {
  const result: { lineIdx: number; barIdx: number; bar: ChordBar }[] = [];
  chordLines.forEach((line, li) => {
    line.bars.forEach((bar, bi) => {
      result.push({ lineIdx: li, barIdx: bi, bar });
    });
  });
  return result;
}

export default function ChordPanel({ chordLines, currentTime, sectionStart, sectionEnd, isPlaying, onChange }: ChordPanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [syncMode, setSyncMode] = useState(false);
  const [syncFlatIdx, setSyncFlatIdx] = useState(0);
  const [syncDraft, setSyncDraft] = useState<ChordLine[]>([]);
  const [syncSnapshot, setSyncSnapshot] = useState<ChordLine[]>([]);
  const [focusBarKey, setFocusBarKey] = useState<string | null>(null);
  const [chordFont, setChordFont] = useState<'standard' | 'musanalysis'>('standard');

  const chordFontStyle: React.CSSProperties = chordFont === 'musanalysis'
    ? { fontFamily: "'MusAnalysis', monospace" }
    : {};

  const addLine = (afterIndex?: number) => {
    const newLine: ChordLine = {
      id: crypto.randomUUID(),
      prefix: '',
      bars: [{ id: crypto.randomUUID(), content: '', startTime: null, endTime: null }],
      suffix: '',
    };
    const next = [...chordLines];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : next.length;
    next.splice(insertAt, 0, newLine);
    onChange(next);
  };

  const removeLine = (lineIdx: number) => {
    onChange(chordLines.filter((_, i) => i !== lineIdx));
  };

  const addBar = (lineIdx: number) => {
    const newId = crypto.randomUUID();
    const next = chordLines.map((line, i) =>
      i === lineIdx
        ? { ...line, bars: [...line.bars, { id: newId, content: '', startTime: null, endTime: null }] }
        : line
    );
    onChange(next);
    setFocusBarKey(newId);
  };

  const removeBar = (lineIdx: number) => {
    const next = chordLines.map((line, i) =>
      i === lineIdx && line.bars.length > 1
        ? { ...line, bars: line.bars.slice(0, -1) }
        : line
    );
    onChange(next);
  };

  const updateBarContent = (lineIdx: number, barIdx: number, content: string) => {
    const next = chordLines.map((line, i) =>
      i === lineIdx
        ? { ...line, bars: line.bars.map((b, j) => (j === barIdx ? { ...b, content } : b)) }
        : line
    );
    onChange(next);
  };

  const updatePrefix = (lineIdx: number, prefix: string) => {
    const next = chordLines.map((line, i) => (i === lineIdx ? { ...line, prefix } : line));
    onChange(next);
  };

  const updateSuffix = (lineIdx: number, suffix: string) => {
    const next = chordLines.map((line, i) => (i === lineIdx ? { ...line, suffix } : line));
    onChange(next);
  };

  // --- Sync mode ---
  const enterSync = () => {
    setSyncSnapshot(structuredClone(chordLines));
    const draft = structuredClone(chordLines);
    const flat = flattenBars(draft);
    if (flat.length > 0) {
      const f = flat[0];
      draft[f.lineIdx].bars[f.barIdx] = { ...draft[f.lineIdx].bars[f.barIdx], startTime: sectionStart };
    }
    setSyncDraft(draft);
    setSyncFlatIdx(0);
    setSyncMode(true);
    setEditMode(false);
  };

  const commitSync = () => {
    onChange(syncDraft);
    setSyncMode(false);
  };

  const discardSync = () => {
    onChange(syncSnapshot);
    setSyncMode(false);
  };

  const flat = syncMode ? flattenBars(syncDraft) : flattenBars(chordLines);
  const totalBars = flat.length;

  const stampBar = useCallback(() => {
    const flatBars = flattenBars(syncDraft);
    const idx = syncFlatIdx;
    if (idx >= flatBars.length - 1) {
      // Last bar
      setSyncDraft(prev => {
        const next = structuredClone(prev);
        const f = flatBars[idx];
        next[f.lineIdx].bars[f.barIdx] = { ...next[f.lineIdx].bars[f.barIdx], endTime: sectionEnd };
        return next;
      });
      setTimeout(() => commitSync(), 0);
    } else {
      setSyncDraft(prev => {
        const next = structuredClone(prev);
        const curr = flatBars[idx];
        const nxt = flatBars[idx + 1];
        next[curr.lineIdx].bars[curr.barIdx] = { ...next[curr.lineIdx].bars[curr.barIdx], endTime: currentTime };
        next[nxt.lineIdx].bars[nxt.barIdx] = { ...next[nxt.lineIdx].bars[nxt.barIdx], startTime: currentTime };
        return next;
      });
      setSyncFlatIdx(prev => prev + 1);
    }
  }, [syncDraft, syncFlatIdx, currentTime, sectionEnd]);


  // Auto-exit sync mode when playhead passes section end
  useEffect(() => {
    if (syncMode && currentTime >= sectionEnd) {
      commitSync();
    }
  }, [syncMode, currentTime, sectionEnd]);

  const undoLastStamp = useCallback(() => {
    if (syncFlatIdx === 0) return;
    const flatBars = flattenBars(syncDraft);
    setSyncDraft(prev => {
      const next = structuredClone(prev);
      const curr = flatBars[syncFlatIdx];
      const prevBar = flatBars[syncFlatIdx - 1];
      next[curr.lineIdx].bars[curr.barIdx] = { ...next[curr.lineIdx].bars[curr.barIdx], startTime: null };
      next[prevBar.lineIdx].bars[prevBar.barIdx] = { ...next[prevBar.lineIdx].bars[prevBar.barIdx], endTime: null };
      return next;
    });
    setSyncFlatIdx(prev => prev - 1);
  }, [syncFlatIdx, syncDraft]);

  // Clear all timecodes
  const clearTimecodes = () => {
    const cleared = chordLines.map(line => ({
      ...line,
      bars: line.bars.map(b => ({ ...b, startTime: null, endTime: null })),
    }));
    onChange(cleared);
  };

  const hasAnyTimecodes = chordLines.some(line => line.bars.some(b => b.startTime !== null));

  // Tab/Escape/Cmd+Z handler for chord sync mode
  useEffect(() => {
    if (!syncMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        stampBar();
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
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [syncMode, stampBar, undoLastStamp]);

  // Playback highlighting — find active bar
  const getActiveBarKey = (): string | null => {
    if (!isPlaying) return null;
    for (const line of chordLines) {
      for (const bar of line.bars) {
        if (bar.startTime === null) continue;
        const end = bar.endTime ?? sectionEnd;
        if (currentTime >= bar.startTime && currentTime < end) return bar.id;
      }
    }
    return null;
  };
  const activeBarId = getActiveBarKey();

  // Sync mode — find the active flat index's bar id
  const syncActiveBarId = syncMode ? flattenBars(syncDraft)[syncFlatIdx]?.bar.id ?? null : null;

  // Determine which lines to render
  const renderLines = syncMode ? syncDraft : chordLines;

  if (chordLines.length === 0 && !editMode) {
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
    <div className="space-y-0">
      {/* Header controls */}
      <div className="flex justify-end items-center gap-2 mb-1.5">
        {/* Font toggle */}
        <span className="flex items-center gap-0.5 mr-auto">
          {(['standard', 'musanalysis'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setChordFont(opt)}
              className={`text-[10px] font-mono px-1 py-0.5 rounded transition-colors ${
                chordFont === opt
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt === 'standard' ? 'Std' : 'Mus'}
            </button>
          ))}
        </span>
        {syncMode ? (
          <>
            <button
              onClick={discardSync}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              onClick={commitSync}
              className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
            >
              <Check className="h-3 w-3" /> Done
            </button>
          </>
        ) : (
          <>
            {chordLines.length > 0 && (
              <button
                onClick={() => { chordClipboard = structuredClone(chordLines); }}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            )}
            {chordClipboard && (
              <button
                onClick={() => {
                  const pasted = structuredClone(chordClipboard!).map(line => ({
                    ...line,
                    id: crypto.randomUUID(),
                    bars: line.bars.map(b => ({ ...b, id: crypto.randomUUID(), startTime: null, endTime: null })),
                  }));
                  onChange(pasted);
                }}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                <ClipboardPaste className="h-3 w-3" /> Paste
              </button>
            )}
            {hasAnyTimecodes && (
              <button
                onClick={clearTimecodes}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            {totalBars > 0 && (
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

      {/* Chord lines */}
      <div className="space-y-0">
        {renderLines.map((line, lineIdx) => (
          <div key={line.id}>
            {lineIdx > 0 && <hr className="border-border my-1" />}
            <div className="overflow-x-auto pb-4">
              <div className="flex items-center gap-0 min-w-0">
                {/* Prefix */}
                {editMode ? (
                  <input
                    value={line.prefix}
                    onChange={e => updatePrefix(lineIdx, e.target.value)}
                    placeholder="|:"
                    className="w-14 shrink-0 bg-secondary border border-border rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center mr-1"
                  />
                ) : (
                  line.prefix && (
                    renderBarline(line.prefix, true) || <span className="text-xs font-mono text-muted-foreground shrink-0 mr-1">{line.prefix}</span>
                  )
                )}

                {/* Bar cells */}
                <div className="flex items-stretch">
                  {line.bars.map((bar, barIdx) => {
                    const isActivePlayback = !syncMode && activeBarId === bar.id;
                    const isActiveSyncBar = syncMode && syncActiveBarId === bar.id;
                    const isSyncStamped = syncMode && syncFlatIdx > 0 && (() => {
                      const flatBars = flattenBars(syncDraft);
                      const flatIdx = flatBars.findIndex(f => f.bar.id === bar.id);
                      return flatIdx >= 0 && flatIdx < syncFlatIdx;
                    })();

                    return (
                      <div key={bar.id} className="flex items-stretch">
                        {barIdx > 0 && (
                          <div className="self-stretch" style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }} />
                        )}
                        {editMode ? (
                          <input
                            ref={el => {
                              if (el && focusBarKey === bar.id) {
                                el.focus();
                                setFocusBarKey(null);
                              }
                            }}
                            value={bar.content}
                            onChange={e => updateBarContent(lineIdx, barIdx, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && e.shiftKey) {
                                e.preventDefault();
                                addLine(lineIdx);
                              }
                            }}
                            className="min-w-[110px] bg-secondary border border-border rounded px-1.5 py-1 font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center"
                            style={{ fontSize: '15px', ...chordFontStyle }}
                          />
                        ) : (
                          <div
                            className={`min-w-[110px] flex items-center justify-around px-1.5 py-0.5 transition-colors ${
                              isActiveSyncBar
                                ? 'bg-primary/10 ring-1 ring-primary/40'
                                : isSyncStamped
                                ? 'opacity-50'
                                : isActivePlayback
                                ? 'bg-primary/10 ring-1 ring-primary/40'
                                : ''
                            }`}
                          >
                            {bar.content.trim() && bar.content.trim().includes(' ')
                              ? bar.content.trim().split(/\s+/).map((token, ti) => (
                                  <span key={ti} className="text-xs font-mono text-foreground text-center" style={chordFontStyle}>{token}</span>
                                ))
                              : <span className="text-xs font-mono text-foreground text-center" style={chordFontStyle}>{bar.content || '\u00A0'}</span>
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Suffix */}
                {editMode ? (
                  <input
                    value={line.suffix}
                    onChange={e => updateSuffix(lineIdx, e.target.value)}
                    placeholder=":|"
                    className="w-14 shrink-0 bg-secondary border border-border rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center ml-1"
                  />
                ) : (
                  line.suffix && (
                    renderBarline(line.suffix, false) || <span className="text-xs font-mono text-muted-foreground shrink-0 ml-1">{line.suffix}</span>
                  )
                )}

                {/* Line controls */}
                {editMode && (
                  <div className="flex items-center gap-0.5 ml-1.5 shrink-0">
                    <button
                      onClick={() => addBar(lineIdx)}
                      className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Add bar"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeBar(lineIdx)}
                      className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Remove last bar"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeLine(lineIdx)}
                      className="p-0.5 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
                      title="Remove line"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add line button */}
      {editMode && (
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
