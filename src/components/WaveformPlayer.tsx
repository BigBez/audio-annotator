import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { ChevronUp, ChevronDown } from 'lucide-react';

function formatTime(seconds: number | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface WaveformPlayerProps {
  file: File;
  onTimeUpdate: (time: number) => void;
  onDurationReady: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  onSeek?: (time: number) => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

export default function WaveformPlayer({
  file,
  onTimeUpdate,
  onDurationReady,
  onPlayStateChange,
  onCollapseChange,
  onSeek,
  wavesurferRef,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
      onSeek?.(t);
    });

    ws.on('play', () => onPlayStateChange(true));
    ws.on('pause', () => onPlayStateChange(false));
    ws.on('finish', () => onPlayStateChange(false));

    wavesurferRef.current = ws;

    return () => { ws.destroy(); };
  }, [file]);

  return (
    <div>
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={() => setWaveformCollapsed(prev => { const next = !prev; onCollapseChange?.(next); return next; })}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          title={waveformCollapsed ? 'Show waveform' : 'Hide waveform'}
        >
          {waveformCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div
        ref={containerRef}
        className="rounded-lg bg-secondary/50 p-2"
        style={{ display: waveformCollapsed ? 'none' : undefined }}
      />
    </div>
  );
}
