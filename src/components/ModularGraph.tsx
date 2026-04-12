import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { Section } from '@/lib/sections';
import ColorPickerButton from '@/components/ColorPickerButton';

export interface JoinedGroup {
  id: string;
  label: string;
  sectionIds: string[];
}

export interface ModularGraphState {
  boxWidths: Record<string, number>;
  joinedGroups: JoinedGroup[];
  barCounts: Record<string, string>;
}

export const DEFAULT_MODULAR_STATE: ModularGraphState = {
  boxWidths: {},
  joinedGroups: [],
  barCounts: {},
};

interface ModularGraphProps {
  sections: Section[];
  currentTime: number;
  selectedId: string | null;
  cmdSelectedIds: Set<string>;
  modularState: ModularGraphState;
  onSelectedIdChange: (id: string | null) => void;
  onCmdSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onColorChange: (ids: string[], color: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onModularStateChange: (state: ModularGraphState) => void;
  pushUndo: () => void;
}

export default function ModularGraph({
  sections,
  currentTime,
  selectedId,
  cmdSelectedIds,
  modularState,
  onSelectedIdChange,
  onCmdSelect,
  onSeek,
  onColorChange,
  onLabelChange,
  onModularStateChange,
  pushUndo,
}: ModularGraphProps) {
  const { boxWidths, joinedGroups, barCounts } = modularState;

  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');
  const [editingGroupLabel, setEditingGroupLabel] = useState<string | null>(null);
  const [groupLabelValue, setGroupLabelValue] = useState('');
  const [editingBarCount, setEditingBarCount] = useState<string | null>(null);
  const [barCountValue, setBarCountValue] = useState('');
  const [widthInputValue, setWidthInputValue] = useState('');
  const [editingWidth, setEditingWidth] = useState(false);

  const getWidth = (id: string) => boxWidths[id] ?? 120;
  const getBarCount = (id: string) => barCounts[id] ?? '';

  const getGroupForSection = (sectionId: string) =>
    joinedGroups.find(g => g.sectionIds.includes(sectionId));

  const activeSection = sections.find(s => currentTime >= s.start && currentTime < s.end);

  const multiSelectedIds = new Set([...cmdSelectedIds]);
  const isMultiSelect = multiSelectedIds.size > 0;

  const selectedSection = selectedId ? sections.find(s => s.id === selectedId) : null;
  const selectedGroup = selectedId ? getGroupForSection(selectedId) : null;

  // Build render groups: consecutive sections that are joined together
  const renderItems: Array<{ type: 'single'; section: Section } | { type: 'group'; group: JoinedGroup; sections: Section[] }> = [];
  const processed = new Set<string>();

  for (const section of sections) {
    if (processed.has(section.id)) continue;
    const group = getGroupForSection(section.id);
    if (group) {
      const groupSections = group.sectionIds
        .map(id => sections.find(s => s.id === id))
        .filter(Boolean) as Section[];
      groupSections.forEach(s => processed.add(s.id));
      renderItems.push({ type: 'group', group, sections: groupSections });
    } else {
      processed.add(section.id);
      renderItems.push({ type: 'single', section });
    }
  }

  const updateState = (partial: Partial<ModularGraphState>) => {
    onModularStateChange({ ...modularState, ...partial });
  };

  const handleWidthChange = (ids: string[], width: number) => {
    pushUndo();
    const clamped = Math.max(10, Math.min(400, width));
    const next = { ...boxWidths };
    ids.forEach(id => { next[id] = clamped; });
    updateState({ boxWidths: next });
  };

  const handleBarCountSave = (id: string, value: string) => {
    pushUndo();
    const next = { ...barCounts };
    if (value.trim()) {
      next[id] = value.trim();
    } else {
      delete next[id];
    }
    updateState({ barCounts: next });
    setEditingBarCount(null);
  };

  const renderBox = (section: Section) => {
    const w = getWidth(section.id);
    const isActive = activeSection?.id === section.id;
    const isSelected = selectedId === section.id;
    const isCmdSelected = cmdSelectedIds.has(section.id);

    return (
      <div
        key={section.id}
        className="flex flex-col"
        style={{ width: w }}
      >
        {/* Box */}
        <div
          className="relative flex items-center justify-center cursor-pointer transition-all overflow-hidden rounded-sm"
          style={{
            width: w,
            height: 64,
            backgroundColor: section.color,
            boxShadow: isCmdSelected
              ? 'inset 0 0 0 2px rgba(255,255,255,0.9)'
              : isSelected
              ? 'inset 0 0 0 2px rgba(255,255,255,0.8)'
              : isActive
              ? 'inset 0 0 0 2px hsl(var(--foreground) / 0.4)'
              : 'none',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.metaKey || e.ctrlKey) {
              onCmdSelect(section.id);
            } else {
              onSelectedIdChange(section.id);
              onSeek(section.start);
            }
          }}
        >
          <span className="text-xs font-display font-medium text-white truncate px-1 drop-shadow-sm select-none">
            {section.label}
          </span>
        </div>
        {/* Bar count cell */}
        <div
          className="flex items-center justify-center cursor-pointer border-t border-border/30"
          style={{ width: w, height: 24 }}
          onClick={(e) => {
            e.stopPropagation();
            setEditingBarCount(section.id);
            setBarCountValue(getBarCount(section.id));
          }}
        >
          {editingBarCount === section.id ? (
            <input
              autoFocus
              value={barCountValue}
              onChange={e => setBarCountValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleBarCountSave(section.id, barCountValue);
                if (e.key === 'Escape') setEditingBarCount(null);
              }}
              onBlur={() => handleBarCountSave(section.id, barCountValue)}
              className="w-full h-full bg-transparent text-center text-[11px] font-mono text-foreground outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="text-[11px] font-mono text-muted-foreground select-none">
              {getBarCount(section.id)}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (sections.length === 0) return null;

  // Width for detail strip
  const currentWidthValue = (() => {
    if (isMultiSelect) {
      const ids = Array.from(multiSelectedIds);
      const widths = ids.map(id => getWidth(id));
      return widths.every(w => w === widths[0]) ? widths[0] : '';
    }
    if (selectedId) return getWidth(selectedId);
    return '';
  })();

  return (
    <div className="space-y-0" onClick={e => e.stopPropagation()}>
      {/* Divider label */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Analysis</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Boxes row with group labels */}
      <div className="overflow-x-auto">
        <div className="flex items-end" style={{ gap: 0, justifyContent: 'center' }}>
          {renderItems.map((item) => {
            if (item.type === 'single') {
              return (
                <div key={item.section.id} style={{ marginRight: 6 }}>
                  {renderBox(item.section)}
                </div>
              );
            }
            // Grouped
            const { group, sections: groupSections } = item;
            const isGroupSelected = groupSections.some(s => s.id === selectedId || cmdSelectedIds.has(s.id));
            return (
              <div key={group.id} style={{ marginRight: 6 }}>
                {/* Group label */}
                <div className="flex justify-center mb-1">
                  {editingGroupLabel === group.id ? (
                    <input
                     onMouseDown={e => e.stopPropagation()}
                     autoFocus
                      onFocus={e => e.target.select()}
                      value={groupLabelValue}
                      onChange={e => setGroupLabelValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          pushUndo();
                          updateState({
                            joinedGroups: joinedGroups.map(g =>
                              g.id === group.id ? { ...g, label: groupLabelValue } : g
                            ),
                          });
                          setEditingGroupLabel(null);
                        }
                        if (e.key === 'Escape') setEditingGroupLabel(null);
                      }}
                      onBlur={() => {
                        pushUndo();
                        updateState({
                          joinedGroups: joinedGroups.map(g =>
                            g.id === group.id ? { ...g, label: groupLabelValue } : g
                          ),
                        });
                        setEditingGroupLabel(null);
                      }}
                      className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-20 text-center"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingGroupLabel(group.id);
                        setGroupLabelValue(group.label);
                      }}
                      className={`text-[10px] font-display font-medium flex items-center gap-0.5 ${
                        isGroupSelected ? 'text-foreground' : 'text-muted-foreground'
                      } hover:text-primary`}
                    >
                      {group.label}
                      <Pencil className="h-2 w-2" />
                    </button>
                  )}
                </div>
                {/* Joined boxes — no gap */}
                <div className="flex">
                  {groupSections.map(s => renderBox(s))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modular detail strip */}
      {isMultiSelect && (
        <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded-md bg-card border border-border text-sm font-mono">
          <ColorPickerButton mode="multi" onColorSelect={(color) => onColorChange(Array.from(multiSelectedIds), color)} />
          <span className="text-xs text-muted-foreground">{multiSelectedIds.size} boxes selected</span>
          <div className="flex-1" />
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            W
            <input
              type="text"
              value={editingWidth ? widthInputValue : String(currentWidthValue)}
              onFocus={e => {
                setEditingWidth(true);
                setWidthInputValue(String(currentWidthValue));
                e.target.select();
              }}
              onChange={e => setWidthInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseInt(widthInputValue, 10);
                  if (!isNaN(v)) handleWidthChange(Array.from(multiSelectedIds), v);
                  setEditingWidth(false);
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  setEditingWidth(false);
                  (e.target as HTMLInputElement).blur();
                }
                e.stopPropagation();
              }}
              onBlur={() => {
                if (editingWidth) {
                  const v = parseInt(widthInputValue, 10);
                  if (!isNaN(v)) handleWidthChange(Array.from(multiSelectedIds), v);
                  setEditingWidth(false);
                }
              }}
              className="w-14 bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center"
              onClick={e => e.stopPropagation()}
            />
          </label>
        </div>
      )}

      {!isMultiSelect && selectedSection && (
        <div className="mt-2 space-y-0">
          {/* Group label row if in a joined group */}
          {selectedGroup && (
            <div className="flex items-center gap-3 px-2 py-1 rounded-t-md bg-card border border-border border-b-0 text-sm font-mono">
              {editingGroupLabel === selectedGroup.id ? (
                <input
                  autoFocus
                  onFocus={e => e.target.select()}
                  value={groupLabelValue}
                  onChange={e => setGroupLabelValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      pushUndo();
                      updateState({
                        joinedGroups: joinedGroups.map(g =>
                          g.id === selectedGroup.id ? { ...g, label: groupLabelValue } : g
                        ),
                      });
                      setEditingGroupLabel(null);
                    }
                    if (e.key === 'Escape') setEditingGroupLabel(null);
                  }}
                  onBlur={() => {
                    pushUndo();
                    updateState({
                      joinedGroups: joinedGroups.map(g =>
                        g.id === selectedGroup.id ? { ...g, label: groupLabelValue } : g
                      ),
                    });
                    setEditingGroupLabel(null);
                  }}
                  className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-20"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingGroupLabel(selectedGroup.id);
                    setGroupLabelValue(selectedGroup.label);
                  }}
                  className="text-xs font-display font-medium text-foreground hover:text-primary flex items-center gap-1"
                >
                  {selectedGroup.label}
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                </button>
              )}
              <span className="text-muted-foreground text-xs">|</span>
              <span className="text-[10px] text-muted-foreground">{selectedGroup.sectionIds.length} sections</span>
              <div className="flex-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pushUndo();
                  updateState({
                    joinedGroups: joinedGroups.filter(g => g.id !== selectedGroup.id),
                  });
                }}
                className="shrink-0 p-1 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
                title="Split group"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {/* Section detail row */}
          <div className={`flex items-center gap-3 px-2 py-1.5 bg-card border border-border text-sm font-mono ${
            selectedGroup ? 'rounded-b-md border-t-0 pl-5' : 'rounded-md'
          }`}>
            {selectedGroup && <span className="text-muted-foreground text-xs">↳</span>}
            <ColorPickerButton mode="single" activeColor={selectedSection.color} onColorSelect={(color) => onColorChange([selectedSection.id], color)} />
            {editingLabel === selectedSection.id ? (
              <input
                autoFocus
                onFocus={e => e.target.select()}
                value={labelValue}
                onChange={e => setLabelValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onLabelChange(selectedSection.id, labelValue); setEditingLabel(null); }
                  if (e.key === 'Escape') setEditingLabel(null);
                }}
                onBlur={() => { onLabelChange(selectedSection.id, labelValue); setEditingLabel(null); }}
                className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-display text-foreground outline-none focus:ring-1 focus:ring-ring w-24"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingLabel(selectedSection.id);
                  setLabelValue(selectedSection.label);
                }}
                className="text-xs font-display font-medium text-foreground hover:text-primary flex items-center gap-1"
              >
                {selectedSection.label}
                <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )}
            <div className="flex-1" />
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              W
              <input
                type="text"
                value={editingWidth ? widthInputValue : String(getWidth(selectedSection.id))}
                onFocus={e => {
                  setEditingWidth(true);
                  setWidthInputValue(String(getWidth(selectedSection.id)));
                  e.target.select();
                }}
                onChange={e => setWidthInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = parseInt(widthInputValue, 10);
                    if (!isNaN(v)) handleWidthChange([selectedSection.id], v);
                    setEditingWidth(false);
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    setEditingWidth(false);
                    (e.target as HTMLInputElement).blur();
                  }
                  e.stopPropagation();
                }}
                onBlur={() => {
                  if (editingWidth) {
                    const v = parseInt(widthInputValue, 10);
                    if (!isNaN(v)) handleWidthChange([selectedSection.id], v);
                    setEditingWidth(false);
                  }
                }}
                className="w-14 bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-ring text-center"
                onClick={e => e.stopPropagation()}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
