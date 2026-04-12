import { useState, useRef, useEffect, useCallback } from 'react';
import type { LyricLine } from '@/lib/sections';
import { Pencil, Check, Plus, X } from 'lucide-react';

interface LyricsPanelProps {
  lyricLines: LyricLine[];
  onChange: (lyricLines: LyricLine[]) => void;
}

export default function LyricsPanel({ lyricLines, onChange }: LyricsPanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

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
    <div className="space-y-0">
      {/* Header controls */}
      <div className="flex justify-end mb-1.5">
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
      </div>

      {/* Lyric lines */}
      <div className="space-y-1">
        {lyricLines.map((line, lineIdx) => (
          <div key={line.id}>
            {editMode ? (
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
              <p className="text-sm font-mono text-foreground leading-relaxed">
                {line.text || '\u00A0'}
              </p>
            )}
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
