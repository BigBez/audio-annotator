import { useState, useRef, useCallback, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import AudioUpload from '@/components/AudioUpload';
import WaveformPlayer from '@/components/WaveformPlayer';
import SectionTimeline from '@/components/SectionTimeline';
import { type Section, getColorForIndex, getDefaultLabel } from '@/lib/sections';
import { Music } from 'lucide-react';

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const manualSelectRef = useRef(false);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const boundariesRef = useRef<number[]>([]);

  const handleBoundary = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const time = ws.getCurrentTime();
    const dur = ws.getDuration();
    if (dur <= 0) return;
    const boundaries = boundariesRef.current;

    // Prevent duplicate or near-duplicate boundaries
    if (boundaries.length > 0 && Math.abs(time - boundaries[boundaries.length - 1]) < 0.05) return;

    boundaries.push(time);

    // Rebuild sections: always cover 0 to duration
    const allPoints = [0, ...boundaries, dur];
    // Deduplicate and sort
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
      });
    }
    setSections(prev => {
      return newSections.map((ns, i) => {
        const existing = prev.find(p => p.id === ns.id);
        if (existing) {
          return { ...ns, label: existing.label, notes: existing.notes };
        }
        return ns;
      });
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        wavesurferRef.current?.playPause();
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        handleBoundary();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleBoundary]);

  const handleLabelChange = useCallback((id: string, label: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }, []);

  const handleNotesChange = useCallback((id: string, notes: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
  }, []);

  const handleDeleteSection = useCallback((id: string) => {
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

      // Absorb into previous section, or next if no previous
      if (idx > 0) {
        next[idx - 1] = { ...next[idx - 1], end: deleted.end };
      } else if (next.length > 0) {
        next[0] = { ...next[0], start: deleted.start };
      }

      // Rebuild boundaries from sections
      const newBoundaries = [next[0].start, ...next.map(s => s.end)];
      boundariesRef.current = newBoundaries;

      return next;
    });
  }, []);

  const handleBoundaryEdit = useCallback((sectionId: string, field: 'start' | 'end', newValue: number) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx === -1) return prev;
      
      const section = prev[idx];
      const updated = [...prev];
      
      if (field === 'start') {
        // Can't go below 0 or above section end
        if (newValue < 0 || newValue >= section.end) return prev;
        // Can't overlap previous section
        if (idx > 0 && newValue < updated[idx - 1].start) return prev;
        updated[idx] = { ...section, start: newValue };
        // Adjust previous section's end
        if (idx > 0) {
          updated[idx - 1] = { ...updated[idx - 1], end: newValue };
        }
      } else {
        // Can't go below section start or above duration
        if (newValue <= section.start) return prev;
        // Can't overlap next section's end
        if (idx < prev.length - 1 && newValue > updated[idx + 1].end) return prev;
        updated[idx] = { ...section, end: newValue };
        // Adjust next section's start
        if (idx < prev.length - 1) {
          updated[idx + 1] = { ...updated[idx + 1], start: newValue };
        }
      }

      // Rebuild boundaries
      if (updated.length > 0) {
        const newBoundaries = [updated[0].start, ...updated.map(s => s.end)];
        boundariesRef.current = newBoundaries;
      }

      return updated;
    });
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
    setCurrentTime(0);
    setDuration(0);
    boundariesRef.current = [];
  }, []);

  return (
    <div className="min-h-screen bg-background">
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
            <p className="text-sm font-mono text-muted-foreground truncate">{file.name}</p>

            <WaveformPlayer
              file={file}
              sections={sections}
              onTimeUpdate={setCurrentTime}
              onDurationReady={setDuration}
              onPlayStateChange={setIsPlaying}
              onStop={handleStop}
              wavesurferRef={wavesurferRef}
            />

            {/* Horizontal section timeline */}
            {duration > 0 && (
              <SectionTimeline
                sections={sections}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
                onLabelChange={handleLabelChange}
                onDelete={handleDeleteSection}
                onBoundaryEdit={handleBoundaryEdit}
                onNotesChange={handleNotesChange}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
