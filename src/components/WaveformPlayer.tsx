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
      height: 42,
      normalize: true,
    });

    ws.loadBlob(file);

    ws.on('ready', () => {
      const d = ws.getDuration();
      onDurationReady(d);
    });

    ws.on('audioprocess', () => {
      const t = ws.getCurrentTime();
      onTimeUpdate(t);
    });

    ws.on('seeking', () => {
      const t = ws.getCurrentTime();
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
    <div className="space-y-1">
      {/* Transport controls in title bar */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onStop}
          className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-opacity"
          title="Stop"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={togglePlay}
          className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>
        <span className="ml-1 text-[10px] text-muted-foreground font-mono">Space to play/pause · Enter to mark section</span>
      </div>

      {/* Waveform with collapse toggle */}
      <div>
        <button
          onClick={() => setWaveformCollapsed(prev => !prev)}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors mb-1"
          title={waveformCollapsed ? 'Show waveform' : 'Hide waveform'}
        >
          {waveformCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        <div
          ref={containerRef}
          className="rounded-lg bg-secondary/50 p-2"
          style={{ display: waveformCollapsed ? 'none' : undefined }}
        />
      </div>
    </div>
  );
}
