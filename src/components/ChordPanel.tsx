import { useState } from 'react';
import type { ChordLine } from '@/lib/sections';
import { Pencil, Check, Plus, Minus, X } from 'lucide-react';

interface ChordPanelProps {
  chordLines: ChordLine[];
  onChange: (chordLines: ChordLine[]) => void;
}

export default function ChordPanel({ chordLines, onChange }: ChordPanelProps) {
  const [editMode, setEditMode] = useState(false);

  const addLine = (afterIndex?: number) => {
    const newLine: ChordLine = {
      id: crypto.randomUUID(),
      prefix: '',
      bars: [{ id: crypto.randomUUID(), content: '' }],
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
    const next = chordLines.map((line, i) =>
      i === lineIdx
        ? { ...line, bars: [...line.bars, { id: crypto.randomUUID(), content: '' }] }
        : line
    );
    onChange(next);
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

  if (chordLines.length === 0 && !editMode) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground/60 font-mono italic">No chords yet</p>
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

      {/* Chord lines */}
      <div className="space-y-0">
        {chordLines.map((line, lineIdx) => (
          <div key={line.id}>
            {lineIdx > 0 && <hr className="border-border my-1" />}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-0 min-w-0">
                {/* Prefix */}
                {editMode ? (
                  <input
                    value={line.prefix}
                    onChange={e => updatePrefix(lineIdx, e.target.value)}
                    placeholder="…"
                    className="w-12 shrink-0 bg-secondary border border-border rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center mr-1"
                  />
                ) : (
                  line.prefix && (
                    <span className="text-xs font-mono text-muted-foreground shrink-0 mr-1">{line.prefix}</span>
                  )
                )}

                {/* Bar cells */}
                <div className="flex items-stretch">
                  {line.bars.map((bar, barIdx) => (
                    <div key={bar.id} className="flex items-stretch">
                      {barIdx > 0 && (
                        <div className="w-px bg-border self-stretch" />
                      )}
                      {editMode ? (
                        <input
                          value={bar.content}
                          onChange={e => updateBarContent(lineIdx, barIdx, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.shiftKey) {
                              e.preventDefault();
                              addLine(lineIdx);
                            }
                          }}
                          className="min-w-[80px] bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center"
                        />
                      ) : (
                        <div className="min-w-[80px] flex items-center justify-center px-1.5 py-0.5">
                          <span className="text-xs font-mono text-foreground text-center">{bar.content || '\u00A0'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Suffix */}
                {editMode ? (
                  <input
                    value={line.suffix}
                    onChange={e => updateSuffix(lineIdx, e.target.value)}
                    placeholder="…"
                    className="w-12 shrink-0 bg-secondary border border-border rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center ml-1"
                  />
                ) : (
                  line.suffix && (
                    <span className="text-xs font-mono text-muted-foreground shrink-0 ml-1">{line.suffix}</span>
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
