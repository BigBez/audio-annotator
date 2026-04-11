import { useState, useRef, useCallback, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import AudioUpload from '@/components/AudioUpload';
import WaveformPlayer from '@/components/WaveformPlayer';
import SectionList from '@/components/SectionList';
import { type Section, getColorForIndex, getDefaultLabel } from '@/lib/sections';
import { Music } from 'lucide-react';

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const boundariesRef = useRef<number[]>([]);

  const handleBoundary = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const time = ws.getCurrentTime();
    const dur = ws.getDuration();
    const boundaries = boundariesRef.current;

    boundaries.push(time);

    if (boundaries.length >= 2) {
      // Create/update sections from all boundaries
      const newSections: Section[] = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        newSections.push({
          id: `section-${i}`,
          start: boundaries[i],
          end: boundaries[i + 1],
          label: getDefaultLabel(i),
          color: getColorForIndex(i),
          notes: '',
        });
      }
      setSections(newSections);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
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

  const handleSeek = useCallback((time: number) => {
    wavesurferRef.current?.seekTo(time / duration);
  }, [duration]);

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
      {/* Header */}
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
            {/* File name */}
            <p className="text-sm font-mono text-muted-foreground truncate">{file.name}</p>

            <WaveformPlayer
              file={file}
              sections={sections}
              onTimeUpdate={setCurrentTime}
              onDurationReady={setDuration}
              onPlayStateChange={setIsPlaying}
              wavesurferRef={wavesurferRef}
            />

            {/* Sections */}
            <div>
              <h2 className="text-sm font-semibold font-display mb-3 text-muted-foreground uppercase tracking-wider">Sections</h2>
              <SectionList
                sections={sections}
                currentTime={currentTime}
                onLabelChange={handleLabelChange}
                onNotesChange={handleNotesChange}
                onSeek={handleSeek}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
