import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Square, ChevronUp, ChevronDown } from 'lucide-react';
import { formatTime, type Section } from '@/lib/sections';

interface WaveformPlayerProps {
  file: File;
  onTimeUpdate: (time: number) => void;
  onDurationReady: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onStop: () => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

export default function WaveformPlayer({
  file,
  onTimeUpdate,
  onDurationReady,
  onPlayStateChange,
  onStop,
  wavesurferRef,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformCollapsed, setWaveformCollapsed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'hsl(168, 50%, 45%)',
      progressColor: 'hsl(168, 70%, 60%)',
      cursorColor: 'hsl(40, 90%, 60%)',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 60,
      normalize: true,
    });

    ws.loadBlob(file);

    ws.on('ready', () => {
      const d = ws.getDuration();
      setDuration(d);
      onDurationReady(d);
    });

    ws.on('audioprocess', () => {
      const t = ws.getCurrentTime();
      setCurrentTime(t);
      onTimeUpdate(t);
    });

    ws.on('seeking', () => {
      const t = ws.getCurrentTime();
      setCurrentTime(t);
      onTimeUpdate(t);
    });

    ws.on('play', () => { setIsPlaying(true); onPlayStateChange(true); });
    ws.on('pause', () => { setIsPlaying(false); onPlayStateChange(false); });
    ws.on('finish', () => { setIsPlaying(false); onPlayStateChange(false); });

    wavesurferRef.current = ws;

    return () => { ws.destroy(); };
  }, [file]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onStop}
          className="flex items-center justify-center h-9 w-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-opacity"
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </button>
        <button
          onClick={togglePlay}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <span className="ml-3 text-xs text-muted-foreground font-mono">Space to play/pause · Enter to mark section</span>
      </div>

      {/* Waveform with collapse toggle */}
      <div className="relative">
        {!waveformCollapsed && (
          <div ref={containerRef} className="rounded-lg bg-secondary/50 p-2" />
        )}
        {waveformCollapsed && (
          <div ref={containerRef} className="hidden" />
        )}
        <button
          onClick={() => setWaveformCollapsed(prev => !prev)}
          className="absolute -bottom-1 right-1 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors z-10"
          title={waveformCollapsed ? 'Show waveform' : 'Hide waveform'}
          style={waveformCollapsed ? { position: 'relative', bottom: 'auto', right: 'auto', float: 'right' } : {}}
        >
          {waveformCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
