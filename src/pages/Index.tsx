import { useState, useRef, useCallback, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import AudioUpload from '@/components/AudioUpload';
import WaveformPlayer from '@/components/WaveformPlayer';
import SectionTimeline from '@/components/SectionTimeline';
import BarCountLayer from '@/components/BarCountLayer';
import { type Section, type VcuSpan, getColorForIndex, getDefaultLabel } from '@/lib/sections';
import { Music, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface UndoSnapshot {
  sections: Section[];
  boundaries: number[];
  vcuSpans: VcuSpan[];
  cmdSelectedIds: string[];
}

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [vcuSpans, setVcuSpans] = useState<VcuSpan[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedVcuId, setSelectedVcuId] = useState<string | null>(null);
  const [shiftSelectedIds, setShiftSelectedIds] = useState<Set<string>>(new Set());
  const [cmdSelectedIds, setCmdSelectedIds] = useState<Set<string>>(new Set());
  const manualSelectRef = useRef(false);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const boundariesRef = useRef<number[]>([]);
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);

  const sectionsRef = useRef<Section[]>([]);
  sectionsRef.current = sections;
  const vcuSpansRef = useRef<VcuSpan[]>([]);
  vcuSpansRef.current = vcuSpans;
  const selectedSectionIdRef = useRef<string | null>(null);
  selectedSectionIdRef.current = selectedSectionId;
  const cmdSelectedIdsRef = useRef<Set<string>>(new Set());
  cmdSelectedIdsRef.current = cmdSelectedIds;
  const shiftSelectedIdsRef = useRef<Set<string>>(new Set());
  shiftSelectedIdsRef.current = shiftSelectedIds;

  const pushUndo = useCallback(() => {
    undoStackRef.current.push({
      sections: structuredClone(sectionsRef.current),
      boundaries: [...boundariesRef.current],
      vcuSpans: structuredClone(vcuSpansRef.current),
      cmdSelectedIds: Array.from(cmdSelectedIdsRef.current),
    });
    redoStackRef.current = [];
  }, []);

  const handleBoundary = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const time = ws.getCurrentTime();
    const dur = ws.getDuration();
    if (dur <= 0) return;
    const boundaries = boundariesRef.current;

    if (boundaries.length > 0 && Math.abs(time - boundaries[boundaries.length - 1]) < 0.05) return;

    pushUndo();

    boundaries.push(time);

    const allPoints = [0, ...boundaries, dur];
    const unique = [...new Set(allPoints)].sort((a, b) => a - b);

    const newSections: Section[] = [];
    for (let i = 0; i < unique.length - 1; i++) {
      if (unique[i + 1] - unique[i] < 0.01) continue;
      newSections.push({
        id: `section-${i}`,
        start: unique[i],
        end: unique[i + 1],
        label: getDefaultLabel(i),
        color: getColorForIndex(i),
        notes: '',
        bars: null,
      });
    }
    setSections(prev => {
      return newSections.map((ns, i) => {
        const existing = prev.find(p => p.id === ns.id);
        if (existing) {
          return { ...ns, label: existing.label, notes: existing.notes, bars: existing.bars, color: existing.color };
        }
        return ns;
      });
    });
  }, []);

  // Playhead-driven selection
  useEffect(() => {
    if (!isPlaying) return;
    if (manualSelectRef.current) {
      manualSelectRef.current = false;
      return;
    }
    const active = sections.find(s => currentTime >= s.start && currentTime < s.end);
    if (active && active.id !== selectedSectionId) {
      setSelectedSectionId(active.id);
      setSelectedVcuId(null);
    }
  }, [currentTime, isPlaying, sections, selectedSectionId]);

  const handleSectionSelect = useCallback((id: string | null) => {
    manualSelectRef.current = true;
    setSelectedSectionId(id);
    setSelectedVcuId(null);
    setShiftSelectedIds(new Set());
    setCmdSelectedIds(new Set());
    shiftAnchorRef.current = null;
  }, []);

  const handleVcuSelect = useCallback((id: string | null) => {
    setSelectedVcuId(id);
    setSelectedSectionId(null);
    setShiftSelectedIds(new Set());
    setCmdSelectedIds(new Set());
    shiftAnchorRef.current = null;
  }, []);

  const shiftAnchorRef = useRef<string | null>(null);

  const handleShiftSelect = useCallback((id: string) => {
    setCmdSelectedIds(new Set());
    const currentSections = sectionsRef.current;
    const clickedIdx = currentSections.findIndex(s => s.id === id);
    if (clickedIdx === -1) return;

    let anchorId = shiftAnchorRef.current;
    if (!anchorId) {
      anchorId = selectedSectionIdRef.current;
    }
    if (anchorId) {
      shiftAnchorRef.current = anchorId;
    } else {
      shiftAnchorRef.current = id;
      setShiftSelectedIds(new Set([id]));
      setSelectedSectionId(null);
      setSelectedVcuId(null);
      return;
    }

    const anchorIdx = currentSections.findIndex(s => s.id === anchorId);
    if (anchorIdx === -1) {
      shiftAnchorRef.current = id;
      setShiftSelectedIds(new Set([id]));
      setSelectedSectionId(null);
      setSelectedVcuId(null);
      return;
    }

    const minIdx = Math.min(anchorIdx, clickedIdx);
    const maxIdx = Math.max(anchorIdx, clickedIdx);
    const next = new Set<string>();
    for (let i = minIdx; i <= maxIdx; i++) {
      next.add(currentSections[i].id);
    }
    setShiftSelectedIds(next);
    setSelectedSectionId(null);
    setSelectedVcuId(null);
  }, []);

  const handleCmdSelect = useCallback((id: string) => {
    setShiftSelectedIds(new Set());
    shiftAnchorRef.current = null;
    setCmdSelectedIds(prev => {
      const next = new Set(prev);
      // If starting a cmd selection, include the currently selected section as anchor
      if (next.size === 0 && selectedSectionId && selectedSectionId !== id) {
        next.add(selectedSectionId);
      }
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedSectionId(null);
    setSelectedVcuId(null);
  }, [selectedSectionId]);

  // Create VCU group from shift or cmd selected sections
  const handleCreateGroup = useCallback(() => {
    const shift = shiftSelectedIdsRef.current;
    const cmd = cmdSelectedIdsRef.current;
    const allSelected = new Set([...shift, ...cmd]);
    if (allSelected.size === 0) return;

    const currentSections = sectionsRef.current;
    const indices = Array.from(allSelected).map(id => currentSections.findIndex(s => s.id === id)).filter(i => i !== -1).sort((a, b) => a - b);

    if (indices.length === 0) return;

    pushUndo();

    // Fill the contiguous range between outermost selected sections
    const minIdx = indices[0];
    const maxIdx = indices[indices.length - 1];
    const sectionIds: string[] = [];
    for (let i = minIdx; i <= maxIdx; i++) {
      sectionIds.push(currentSections[i].id);
    }

    const vcuNumber = vcuSpansRef.current.length + 1;
    const newVcu: VcuSpan = {
      id: `vcu-${Date.now()}`,
      label: `VCU${vcuNumber}`,
      sectionIds,
    };

    setVcuSpans(prev => [...prev, newVcu]);
    setShiftSelectedIds(new Set());
    setCmdSelectedIds(new Set());
    shiftAnchorRef.current = null;
    setSelectedVcuId(null);
    setSelectedSectionId(sectionIds[0]);
  }, [pushUndo]);

  // Undo
  const handleUndo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    redoStackRef.current.push({
      sections: structuredClone(sectionsRef.current),
      boundaries: [...boundariesRef.current],
      vcuSpans: structuredClone(vcuSpansRef.current),
      cmdSelectedIds: Array.from(cmdSelectedIdsRef.current),
    });
    setSections(snapshot.sections);
    boundariesRef.current = snapshot.boundaries;
    setVcuSpans(snapshot.vcuSpans);
    setCmdSelectedIds(new Set(snapshot.cmdSelectedIds));
  }, []);

  // Redo
  const handleRedo = useCallback(() => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) return;
    undoStackRef.current.push({
      sections: structuredClone(sectionsRef.current),
      boundaries: [...boundariesRef.current],
      vcuSpans: structuredClone(vcuSpansRef.current),
      cmdSelectedIds: Array.from(cmdSelectedIdsRef.current),
    });
    setSections(snapshot.sections);
    boundariesRef.current = snapshot.boundaries;
    setVcuSpans(snapshot.vcuSpans);
    setCmdSelectedIds(new Set(snapshot.cmdSelectedIds));
  }, []);

  // Save analysis as JSON
  const handleSave = useCallback(() => {
    if (!file || sections.length === 0) return;
    const data = {
      schemaVersion: 1,
      audioFilename: file.name,
      sections: sections.map(s => ({
        id: s.id,
        start: s.start,
        end: s.end,
        label: s.label,
        color: s.color,
        content: {
          notes: s.notes,
        },
        bars: s.bars,
      })),
      vcuSpans: vcuSpans.map(v => ({
        id: v.id,
        label: v.label,
        sectionIds: v.sectionIds,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, '') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [file, sections, vcuSpans]);

  // Load analysis from JSON
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!data.sections || !Array.isArray(data.sections)) {
            toast({ title: 'Invalid file', description: 'No sections found in JSON.' });
            return;
          }
          if (file && data.audioFilename && data.audioFilename !== file.name) {
            toast({
              title: 'Filename mismatch',
              description: `This analysis was saved for "${data.audioFilename}" but the current file is "${file.name}".`,
            });
          }
          const imported: Section[] = data.sections.map((s: any) => ({
            id: s.id,
            start: s.start,
            end: s.end,
            label: s.label,
            color: s.color,
            notes: s.content?.notes ?? s.notes ?? '',
            bars: s.bars ?? null,
          }));
          setSections(imported);
          if (imported.length > 0) {
            boundariesRef.current = [imported[0].start, ...imported.map(s => s.end)];
          } else {
            boundariesRef.current = [];
          }
          if (data.vcuSpans && Array.isArray(data.vcuSpans)) {
            setVcuSpans(data.vcuSpans.map((v: any) => ({
              id: v.id,
              label: v.label,
              sectionIds: v.sectionIds,
            })));
          } else {
            setVcuSpans([]);
          }
        } catch {
          toast({ title: 'Import failed', description: 'Could not parse JSON file.' });
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }, [file]);

  const handleDeleteSection = useCallback((id: string) => {
    pushUndo();
    let absorbingId: string | null = null;
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const deleted = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      if (next.length === 0) {
        boundariesRef.current = [];
        return [];
      }
      if (idx > 0) {
        next[idx - 1] = { ...next[idx - 1], end: deleted.end };
        absorbingId = next[idx - 1].id;
      } else {
        next[0] = { ...next[0], start: deleted.start };
        absorbingId = next[0].id;
      }
      const newBoundaries = [next[0].start, ...next.map(s => s.end)];
      boundariesRef.current = newBoundaries;
      return next;
    });
    setVcuSpans(prev => prev.map(v => ({
      ...v,
      sectionIds: v.sectionIds.filter(sid => sid !== id),
    })).filter(v => v.sectionIds.length > 0));
    setTimeout(() => {
      if (absorbingId) setSelectedSectionId(absorbingId);
    }, 0);
  }, [pushUndo]);

  const handleColorChange = useCallback((ids: string[], color: string) => {
    pushUndo();
    setSections(prev => prev.map(s => ids.includes(s.id) ? { ...s, color } : s));
    setShiftSelectedIds(new Set());
    setCmdSelectedIds(new Set());
  }, [pushUndo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyS' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        wavesurferRef.current?.playPause();
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        handleBoundary();
      }
      if (e.code === 'KeyG' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleCreateGroup();
      }
      if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !e.shiftKey) {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (!ws || sectionsRef.current.length === 0) return;
        const t = ws.getCurrentTime();
        const secs = sectionsRef.current;
        const dur = ws.getDuration();
        let curIdx = -1;
        for (let i = secs.length - 1; i >= 0; i--) {
          if (t >= secs[i].start - 0.01) { curIdx = i; break; }
        }
        if (curIdx === -1) return;

        if (e.code === 'ArrowLeft') {
          if (t - secs[curIdx].start <= 2) {
            if (curIdx > 0) {
              ws.seekTo(secs[curIdx - 1].start / dur);
              handleSectionSelect(secs[curIdx - 1].id);
            }
          } else {
            ws.seekTo(secs[curIdx].start / dur);
            handleSectionSelect(secs[curIdx].id);
          }
        } else {
          if (curIdx < secs.length - 1) {
            ws.seekTo(secs[curIdx + 1].start / dur);
            handleSectionSelect(secs[curIdx + 1].id);
          }
        }
        return;
      }
      if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (!ws) return;
        const newTime = Math.max(0, ws.getCurrentTime() - 5);
        ws.seekTo(newTime / ws.getDuration());
        return;
      }
      if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (!ws) return;
        const dur = ws.getDuration();
        const newTime = Math.min(dur, ws.getCurrentTime() + 5);
        ws.seekTo(newTime / dur);
        return;
      }
      if (e.code === 'Backspace' || e.code === 'Delete') {
        e.preventDefault();
        const selSection = selectedSectionIdRef.current;
        if (selSection) {
          handleDeleteSection(selSection);
        } else if (selectedVcuId) {
          pushUndo();
          setVcuSpans(prev => prev.filter(v => v.id !== selectedVcuId));
          setSelectedVcuId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleBoundary, handleUndo, handleRedo, handleSave, handleCreateGroup, handleDeleteSection, handleSectionSelect, selectedVcuId, pushUndo]);

  const handleLabelChange = useCallback((id: string, label: string) => {
    pushUndo();
    setSections(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }, []);

  const handleNotesChange = useCallback((id: string, notes: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
  }, []);


  const handleBoundaryEdit = useCallback((sectionId: string, field: 'start' | 'end', newValue: number) => {
    pushUndo();
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx === -1) return prev;

      const section = prev[idx];
      const updated = [...prev];

      if (field === 'start') {
        if (newValue < 0 || newValue >= section.end) return prev;
        if (idx > 0 && newValue < updated[idx - 1].start) return prev;
        updated[idx] = { ...section, start: newValue };
        if (idx > 0) {
          updated[idx - 1] = { ...updated[idx - 1], end: newValue };
        }
      } else {
        if (newValue <= section.start) return prev;
        if (idx < prev.length - 1 && newValue > updated[idx + 1].end) return prev;
        updated[idx] = { ...section, end: newValue };
        if (idx < prev.length - 1) {
          updated[idx + 1] = { ...updated[idx + 1], start: newValue };
        }
      }

      if (updated.length > 0) {
        const newBoundaries = [updated[0].start, ...updated.map(s => s.end)];
        boundariesRef.current = newBoundaries;
      }

      return updated;
    });
  }, []);

  const handleVcuLabelChange = useCallback((id: string, label: string) => {
    pushUndo();
    setVcuSpans(prev => prev.map(v => v.id === id ? { ...v, label } : v));
  }, []);

  const handleDeleteVcu = useCallback((id: string) => {
    pushUndo();
    setVcuSpans(prev => prev.filter(v => v.id !== id));
    setSelectedVcuId(null);
  }, []);

  const handleBarsChange = useCallback((id: string, bars: string | null) => {
    pushUndo();
    setSections(prev => prev.map(s => s.id === id ? { ...s, bars } : s));
  }, []);

  const handleSeek = useCallback((time: number) => {
    if (duration > 0) {
      wavesurferRef.current?.seekTo(time / duration);
    }
  }, [duration]);

  const handleStop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.pause();
    ws.seekTo(0);
  }, []);

  const handleReset = useCallback(() => {
    wavesurferRef.current?.destroy();
    wavesurferRef.current = null;
    setFile(null);
    setSections([]);
    setVcuSpans([]);
    setCurrentTime(0);
    setDuration(0);
    boundariesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    setShiftSelectedIds(new Set());
    setCmdSelectedIds(new Set());
  }, []);

  return (
    <div className="min-h-screen bg-background" onClick={() => { setSelectedSectionId(null); setSelectedVcuId(null); setShiftSelectedIds(new Set()); setCmdSelectedIds(new Set()); }}>
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Music className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold font-display tracking-tight">Formal Analysis</h1>
          </div>
          {file && (
            <button
              onClick={handleReset}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              New file
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {!file ? (
          <AudioUpload onFileLoaded={setFile} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <p className="text-sm font-mono text-muted-foreground truncate">{file.name}</p>
              <button
                onClick={(e) => { e.stopPropagation(); handleImport(); }}
                className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Import analysis JSON"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
            </div>

            <WaveformPlayer
              file={file}
              onTimeUpdate={setCurrentTime}
              onDurationReady={setDuration}
              onPlayStateChange={setIsPlaying}
              onStop={handleStop}
              wavesurferRef={wavesurferRef}
            />

            {duration > 0 && (
                <SectionTimeline
                  sections={sections}
                  vcuSpans={vcuSpans}
                  currentTime={currentTime}
                  duration={duration}
                  selectedId={selectedSectionId}
                  selectedVcuId={selectedVcuId}
                  shiftSelectedIds={shiftSelectedIds}
                  cmdSelectedIds={cmdSelectedIds}
                  isPlaying={isPlaying}
                  onSelectedIdChange={handleSectionSelect}
                  onSelectedVcuIdChange={handleVcuSelect}
                  onShiftSelect={handleShiftSelect}
                  onCmdSelect={handleCmdSelect}
                  onSeek={handleSeek}
                  onLabelChange={handleLabelChange}
                  onDelete={handleDeleteSection}
                  onBoundaryEdit={handleBoundaryEdit}
                  onNotesChange={handleNotesChange}
                  onColorChange={handleColorChange}
                  onVcuLabelChange={handleVcuLabelChange}
                  onDeleteVcu={handleDeleteVcu}
                  barCountLayer={sections.length > 0 ? (
                    <BarCountLayer
                      sections={sections}
                      duration={duration}
                      onBarsChange={handleBarsChange}
                    />
                  ) : undefined}
                />
            )}
          </>
        )}
      </main>
    </div>
  );
}
