import { useState, useRef, useCallback, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import AudioUpload from '@/components/AudioUpload';
import WaveformPlayer from '@/components/WaveformPlayer';
import SectionTimeline from '@/components/SectionTimeline';
import ModularGraph, { type ModularGraphState, DEFAULT_MODULAR_STATE } from '@/components/ModularGraph';
import { type Section, type VcuSpan, getColorForIndex, getDefaultLabel } from '@/lib/sections';
import { Music, Upload, Play, Pause, Square } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface UndoSnapshot {
  sections: Section[];
  boundaries: number[];
  vcuSpans: VcuSpan[];
  cmdSelectedIds: string[];
  modularGraph: ModularGraphState;
}

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [vcuSpans, setVcuSpans] = useState<VcuSpan[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformCollapsed, setWaveformCollapsed] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedVcuId, setSelectedVcuId] = useState<string | null>(null);
  const [shiftSelectedIds, setShiftSelectedIds] = useState<Set<string>>(new Set());
  const [cmdSelectedIds, setCmdSelectedIds] = useState<Set<string>>(new Set());
  const [modularGraph, setModularGraph] = useState<ModularGraphState>(DEFAULT_MODULAR_STATE);
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
  const modularGraphRef = useRef<ModularGraphState>(DEFAULT_MODULAR_STATE);
  modularGraphRef.current = modularGraph;

  const pendingAnalysisRef = useRef<any | null>(null);

  const applyAnalysisData = useCallback((data: any) => {
    if (!data.sections || !Array.isArray(data.sections)) {
      toast({ title: 'Invalid analysis', description: 'No sections found in JSON.' });
      return;
    }
    const imported: Section[] = data.sections.map((s: any) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      label: s.label,
      color: s.color,
      notes: s.content?.notes ?? s.notes ?? '',
      bars: s.bars ?? null,
      chordLines: s.chordLines ?? s.content?.chordLines ?? [],
      lyricLines: s.lyricLines ?? s.content?.lyricLines ?? [],
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
    if (data.modularGraph) {
      setModularGraph({
        boxWidths: data.modularGraph.boxWidths ?? {},
        joinedGroups: data.modularGraph.joinedGroups ?? [],
        barCounts: data.modularGraph.barCounts ?? {},
        boxColors: data.modularGraph.boxColors ?? {},
      });
    } else {
      setModularGraph(DEFAULT_MODULAR_STATE);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const audioUrl = params.get('audio');
    const analysisUrl = params.get('analysis');
    if (!audioUrl) return;

    (async () => {
      try {
        // 1. Fetch analysis JSON first (if provided), but DON'T apply yet.
        if (analysisUrl) {
          try {
            const analysisRes = await fetch(analysisUrl);
            if (!analysisRes.ok) throw new Error('Analysis fetch failed');
            pendingAnalysisRef.current = await analysisRes.json();
          } catch (err) {
            toast({ title: 'Analysis load failed', description: err instanceof Error ? err.message : 'Could not load analysis.' });
          }
        }

        // 2. Fetch audio, then set the file so WaveSurfer mounts and initializes.
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) throw new Error('Audio fetch failed');
        const audioBlob = await audioRes.blob();
        const filename = audioUrl.split('/').pop()?.split('?')[0] || 'audio';
        const audioFile = new File([audioBlob], filename, { type: audioBlob.type || 'audio/mpeg' });
        setFile(audioFile);
        // Pending analysis will be applied by the duration-ready effect below.
      } catch (err) {
        toast({ title: 'Load failed', description: err instanceof Error ? err.message : 'Could not load from URL.' });
      }
    })();
  }, []);

  // Apply pending analysis only after WaveSurfer reports a valid duration.
  useEffect(() => {
    if (duration > 0 && pendingAnalysisRef.current) {
      const data = pendingAnalysisRef.current;
      pendingAnalysisRef.current = null;
      applyAnalysisData(data);
    }
  }, [duration, applyAnalysisData]);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push({
      sections: structuredClone(sectionsRef.current),
      boundaries: [...boundariesRef.current],
      vcuSpans: structuredClone(vcuSpansRef.current),
      cmdSelectedIds: Array.from(cmdSelectedIdsRef.current),
      modularGraph: structuredClone(modularGraphRef.current),
    });
    redoStackRef.current = [];
  }, []);

  const handleBoundary = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const time = ws.getCurrentTime();
    const dur = ws.getDuration();
    if (dur <= 0) return;

    pushUndo();

    setSections(prev => {
      // If no sections exist yet, create the first two from the split at time
      if (prev.length === 0) {
        if (time < 0.01 || dur - time < 0.01) return prev;
        return [
          { id: crypto.randomUUID(), start: 0, end: time, label: getDefaultLabel(0), color: getColorForIndex(0), notes: '', bars: null, chordLines: [], lyricLines: [] },
          { id: crypto.randomUUID(), start: time, end: dur, label: getDefaultLabel(1), color: getColorForIndex(1), notes: '', bars: null, chordLines: [], lyricLines: [] },
        ];
      }

      // Find the section containing the playhead
      const idx = prev.findIndex(s => time >= s.start && time < s.end);
      if (idx === -1) return prev;

      const target = prev[idx];
      // Don't split if too close to existing boundaries
      if (time - target.start < 0.05 || target.end - time < 0.05) return prev;

      const totalSections = prev.length + 1;
      const newIndex = totalSections - 1;

      const firstHalf: Section = { ...target, end: time };
      const secondHalf: Section = {
        id: crypto.randomUUID(),
        start: time,
        end: target.end,
        label: getDefaultLabel(newIndex),
        color: getColorForIndex(newIndex),
        notes: '',
        bars: null,
        chordLines: [],
        lyricLines: [],
      };

      const result = [...prev];
      result.splice(idx, 1, firstHalf, secondHalf);
      return result;
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

  // Create modular graph joined group from selected sections (J key)
  const handleJoinModular = useCallback(() => {
    const cmd = cmdSelectedIdsRef.current;
    const shift = shiftSelectedIdsRef.current;
    const sel = selectedSectionIdRef.current;
    const allSelected = new Set([...cmd, ...shift]);
    if (sel && allSelected.size === 0) return;
    if (allSelected.size < 2) return;

    const currentSections = sectionsRef.current;
    const currentGroups = modularGraphRef.current.joinedGroups;

    // Expand each selected section to include its entire existing group
    const expanded = new Set<string>();
    for (const id of allSelected) {
      expanded.add(id);
      const group = currentGroups.find(g => g.sectionIds.includes(id));
      if (group) group.sectionIds.forEach(sid => expanded.add(sid));
    }

    // Find index range and fill contiguously
    const indices = Array.from(expanded)
      .map(id => currentSections.findIndex(s => s.id === id))
      .filter(i => i !== -1)
      .sort((a, b) => a - b);

    if (indices.length < 2) return;

    pushUndo();

    const minIdx = indices[0];
    const maxIdx = indices[indices.length - 1];
    const sectionIds: string[] = [];
    for (let i = minIdx; i <= maxIdx; i++) {
      sectionIds.push(currentSections[i].id);
    }

    // Remove any existing groups that overlap with the new merged group
    const remainingGroups = currentGroups.filter(
      g => !g.sectionIds.some(id => sectionIds.includes(id))
    );

    const groupNumber = remainingGroups.length + 1;
    const newGroup = {
      id: `mg-group-${Date.now()}`,
      label: `Group ${groupNumber}`,
      sectionIds,
    };

    setModularGraph(prev => ({
      ...prev,
      joinedGroups: [...remainingGroups, newGroup],
    }));
    setCmdSelectedIds(new Set());
    setSelectedSectionId(sectionIds[0]);
  }, [pushUndo]);

  // Split modular graph joined group (S key)
  const handleSplitModular = useCallback(() => {
    const selId = selectedSectionIdRef.current;
    const shiftIds = shiftSelectedIdsRef.current;
    const cmdIds = cmdSelectedIdsRef.current;
    const isMulti = cmdIds.size > 0 || shiftIds.size > 0;

    const allIds = new Set<string>();
    if (selId) allIds.add(selId);
    shiftIds.forEach(id => allIds.add(id));
    cmdIds.forEach(id => allIds.add(id));
    if (allIds.size === 0) return;

    // Multi-select: dissolve entire groups
    if (isMulti) {
      const groupsToRemove = new Set<string>();
      for (const id of allIds) {
        const group = modularGraphRef.current.joinedGroups.find(g => g.sectionIds.includes(id));
        if (group) groupsToRemove.add(group.id);
      }
      if (groupsToRemove.size === 0) return;
      pushUndo();
      setModularGraph(prev => ({
        ...prev,
        joinedGroups: prev.joinedGroups.filter(g => !groupsToRemove.has(g.id)),
      }));
      return;
    }

    // Single select: smart boundary split
    if (!selId) return;
    const group = modularGraphRef.current.joinedGroups.find(g => g.sectionIds.includes(selId));
    if (!group) return;

    pushUndo();
    const idx = group.sectionIds.indexOf(selId);
    const before = group.sectionIds.slice(0, idx);
    const after = group.sectionIds.slice(idx + 1);

    const newGroups = modularGraphRef.current.joinedGroups.filter(g => g.id !== group.id);
    if (before.length >= 2) {
      newGroups.push({ id: `mg-group-${Date.now()}-a`, label: group.label, sectionIds: before });
    }
    if (after.length >= 2) {
      newGroups.push({ id: `mg-group-${Date.now()}-b`, label: group.label, sectionIds: after });
    }

    setModularGraph(prev => ({ ...prev, joinedGroups: newGroups }));
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
      modularGraph: structuredClone(modularGraphRef.current),
    });
    setSections(snapshot.sections);
    boundariesRef.current = snapshot.boundaries;
    setVcuSpans(snapshot.vcuSpans);
    setCmdSelectedIds(new Set(snapshot.cmdSelectedIds));
    setModularGraph(snapshot.modularGraph);
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
      modularGraph: structuredClone(modularGraphRef.current),
    });
    setSections(snapshot.sections);
    boundariesRef.current = snapshot.boundaries;
    setVcuSpans(snapshot.vcuSpans);
    setCmdSelectedIds(new Set(snapshot.cmdSelectedIds));
    setModularGraph(snapshot.modularGraph);
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
        chordLines: s.chordLines,
        lyricLines: s.lyricLines,
      })),
      vcuSpans: vcuSpans.map(v => ({
        id: v.id,
        label: v.label,
        sectionIds: v.sectionIds,
      })),
      modularGraph: {
        boxWidths: modularGraph.boxWidths,
        joinedGroups: modularGraph.joinedGroups,
        barCounts: modularGraph.barCounts,
        boxColors: modularGraph.boxColors,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, '') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [file, sections, vcuSpans, modularGraph]);

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
            chordLines: s.chordLines ?? s.content?.chordLines ?? [],
            lyricLines: s.lyricLines ?? s.content?.lyricLines ?? [],
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
          if (data.modularGraph) {
            setModularGraph({
              boxWidths: data.modularGraph.boxWidths ?? {},
              joinedGroups: data.modularGraph.joinedGroups ?? [],
              barCounts: data.modularGraph.barCounts ?? {},
              boxColors: data.modularGraph.boxColors ?? {},
            });
          } else {
            setModularGraph(DEFAULT_MODULAR_STATE);
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
    // Clean up modular graph joined groups
    setModularGraph(prev => ({
      ...prev,
      joinedGroups: prev.joinedGroups
        .map(g => ({ ...g, sectionIds: g.sectionIds.filter(sid => sid !== id) }))
        .filter(g => g.sectionIds.length > 1),
    }));
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
      if (e.code === 'KeyJ' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleJoinModular();
      }
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplitModular();
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
        const secs = sectionsRef.current;
        const active = secs.find(s => newTime >= s.start && newTime < s.end);
        if (active) handleSectionSelect(active.id);
        return;
      }
      if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (!ws) return;
        const dur = ws.getDuration();
        const newTime = Math.min(dur, ws.getCurrentTime() + 5);
        ws.seekTo(newTime / dur);
        const secs = sectionsRef.current;
        const active = secs.find(s => newTime >= s.start && newTime < s.end);
        if (active) handleSectionSelect(active.id);
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
      if (e.code === 'Comma' || e.code === 'Period') {
        e.preventDefault();
        const selId = selectedSectionIdRef.current;
        if (!selId) return;
        const secs = sectionsRef.current;
        const idx = secs.findIndex(s => s.id === selId);
        if (idx === -1) return;
        const section = secs[idx];
        const delta = e.shiftKey ? 0.5 : 0.1;
        if (e.code === 'Comma') {
          const newEnd = section.end - delta;
          if (newEnd <= section.start) return;
          pushUndo();
          setSections(prev => {
            const updated = [...prev];
            const cur = { ...updated[idx], end: newEnd };
            // Update last bar/lyric endTime for current section
            if (cur.chordLines.length > 0) {
              const lastLine = cur.chordLines[cur.chordLines.length - 1];
              if (lastLine.bars.length > 0) {
                const lastBar = lastLine.bars[lastLine.bars.length - 1];
                if (lastBar.endTime !== null) {
                  const newLines = [...cur.chordLines];
                  const newBars = [...lastLine.bars];
                  newBars[newBars.length - 1] = { ...lastBar, endTime: newEnd };
                  newLines[newLines.length - 1] = { ...lastLine, bars: newBars };
                  cur.chordLines = newLines;
                }
              }
            }
            if (cur.lyricLines.length > 0) {
              const lastLyric = cur.lyricLines[cur.lyricLines.length - 1];
              if (lastLyric.endTime !== null) {
                const newLyrics = [...cur.lyricLines];
                newLyrics[newLyrics.length - 1] = { ...lastLyric, endTime: newEnd };
                cur.lyricLines = newLyrics;
              }
            }
            updated[idx] = cur;
            if (idx < prev.length - 1) {
              const nxt = { ...updated[idx + 1], start: newEnd };
              // Update first bar/lyric startTime for next section
              if (nxt.chordLines.length > 0 && nxt.chordLines[0].bars.length > 0) {
                const firstBar = nxt.chordLines[0].bars[0];
                if (firstBar.startTime !== null) {
                  const newLines = [...nxt.chordLines];
                  const newBars = [...newLines[0].bars];
                  newBars[0] = { ...firstBar, startTime: newEnd };
                  newLines[0] = { ...newLines[0], bars: newBars };
                  nxt.chordLines = newLines;
                }
              }
              if (nxt.lyricLines.length > 0 && nxt.lyricLines[0].startTime !== null) {
                const newLyrics = [...nxt.lyricLines];
                newLyrics[0] = { ...newLyrics[0], startTime: newEnd };
                nxt.lyricLines = newLyrics;
              }
              updated[idx + 1] = nxt;
            }
            boundariesRef.current = [updated[0].start, ...updated.map(s => s.end)];
            return updated;
          });
        } else {
          if (idx === secs.length - 1) return;
          const newEnd = section.end + delta;
          if (newEnd >= secs[idx + 1].end) return;
          pushUndo();
          setSections(prev => {
            const updated = [...prev];
            const cur = { ...updated[idx], end: newEnd };
            if (cur.chordLines.length > 0) {
              const lastLine = cur.chordLines[cur.chordLines.length - 1];
              if (lastLine.bars.length > 0) {
                const lastBar = lastLine.bars[lastLine.bars.length - 1];
                if (lastBar.endTime !== null) {
                  const newLines = [...cur.chordLines];
                  const newBars = [...lastLine.bars];
                  newBars[newBars.length - 1] = { ...lastBar, endTime: newEnd };
                  newLines[newLines.length - 1] = { ...lastLine, bars: newBars };
                  cur.chordLines = newLines;
                }
              }
            }
            if (cur.lyricLines.length > 0) {
              const lastLyric = cur.lyricLines[cur.lyricLines.length - 1];
              if (lastLyric.endTime !== null) {
                const newLyrics = [...cur.lyricLines];
                newLyrics[newLyrics.length - 1] = { ...lastLyric, endTime: newEnd };
                cur.lyricLines = newLyrics;
              }
            }
            updated[idx] = cur;
            const nxt = { ...updated[idx + 1], start: newEnd };
            if (nxt.chordLines.length > 0 && nxt.chordLines[0].bars.length > 0) {
              const firstBar = nxt.chordLines[0].bars[0];
              if (firstBar.startTime !== null) {
                const newLines = [...nxt.chordLines];
                const newBars = [...newLines[0].bars];
                newBars[0] = { ...firstBar, startTime: newEnd };
                newLines[0] = { ...newLines[0], bars: newBars };
                nxt.chordLines = newLines;
              }
            }
            if (nxt.lyricLines.length > 0 && nxt.lyricLines[0].startTime !== null) {
              const newLyrics = [...nxt.lyricLines];
              newLyrics[0] = { ...newLyrics[0], startTime: newEnd };
              nxt.lyricLines = newLyrics;
            }
            updated[idx + 1] = nxt;
            boundariesRef.current = [updated[0].start, ...updated.map(s => s.end)];
            return updated;
          });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleBoundary, handleUndo, handleRedo, handleSave, handleCreateGroup, handleJoinModular, handleSplitModular, handleDeleteSection, handleSectionSelect, selectedVcuId, pushUndo]);

  const handleLabelChange = useCallback((id: string, label: string) => {
    pushUndo();
    setSections(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }, []);

  const handleNotesChange = useCallback((id: string, notes: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
  }, []);

  const handleChordLinesChange = useCallback((id: string, chordLines: import('@/lib/sections').ChordLine[]) => {
    pushUndo();
    setSections(prev => prev.map(s => s.id === id ? { ...s, chordLines } : s));
  }, [pushUndo]);

  const handleLyricLinesChange = useCallback((id: string, lyricLines: import('@/lib/sections').LyricLine[]) => {
    pushUndo();
    setSections(prev => prev.map(s => s.id === id ? { ...s, lyricLines } : s));
  }, [pushUndo]);

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
    setModularGraph(DEFAULT_MODULAR_STATE);
  }, []);

  return (
    <div className="min-h-screen bg-background" onClick={() => { setSelectedSectionId(null); setSelectedVcuId(null); setShiftSelectedIds(new Set()); setCmdSelectedIds(new Set()); }}>
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {!file ? (
          <AudioUpload onFileLoaded={setFile} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-1">
              <p className="text-sm font-mono text-muted-foreground truncate">{file.name}</p>
              <button
                onClick={(e) => { e.stopPropagation(); handleImport(); }}
                className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Import analysis JSON"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
              <div className="flex-1" />
              <button
                onClick={handleStop}
                className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-opacity shrink-0"
                title="Stop"
              >
                <Square className="h-3 w-3" />
              </button>
              <button
                onClick={() => wavesurferRef.current?.playPause()}
                className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                title="Play/Pause"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
              </button>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">Space = Play/Pause · Enter = Mark Section</span>
            </div>

            <div className="space-y-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-muted-foreground">{formatTime(currentTime)}</span>
                <span className="text-xs font-mono text-muted-foreground">{formatTime(duration)}</span>
              </div>
              <WaveformPlayer
                file={file}
                onTimeUpdate={setCurrentTime}
                onDurationReady={setDuration}
                onPlayStateChange={setIsPlaying}
                onCollapseChange={setWaveformCollapsed}
                onSeek={(time: number) => {
                  const active = sectionsRef.current.find(s => time >= s.start && time < s.end);
                  if (active) handleSectionSelect(active.id);
                }}
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
                    waveformCollapsed={waveformCollapsed}
                    onSelectedIdChange={handleSectionSelect}
                    onSelectedVcuIdChange={handleVcuSelect}
                    onShiftSelect={handleShiftSelect}
                    onCmdSelect={handleCmdSelect}
                    onSeek={handleSeek}
                    onLabelChange={handleLabelChange}
                    onDelete={handleDeleteSection}
                    onBoundaryEdit={handleBoundaryEdit}
                    onNotesChange={handleNotesChange}
                    onChordLinesChange={handleChordLinesChange}
                    onColorChange={handleColorChange}
                    onLyricLinesChange={handleLyricLinesChange}
                    onVcuLabelChange={handleVcuLabelChange}
                    onDeleteVcu={handleDeleteVcu}
                  />
              )}
            </div>

            {duration > 0 && sections.length > 0 && (
              <ModularGraph
                sections={sections}
                currentTime={currentTime}
                selectedId={selectedSectionId}
                cmdSelectedIds={cmdSelectedIds}
                shiftSelectedIds={shiftSelectedIds}
                modularState={modularGraph}
                isPlaying={isPlaying}
                onSelectedIdChange={handleSectionSelect}
                onShiftSelect={handleShiftSelect}
                onCmdSelect={handleCmdSelect}
                onSeek={handleSeek}
                onLabelChange={handleLabelChange}
                onModularStateChange={setModularGraph}
                pushUndo={pushUndo}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
