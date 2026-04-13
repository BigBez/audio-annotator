import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface WaveformPlayerProps {
  file: File;
  onTimeUpdate: (time: number) => void;
  onDurationReady: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

export default function WaveformPlayer({
  file,
  onTimeUpdate,
  onDurationReady,
  onPlayStateChange,
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
    });

    ws.on('play', () => onPlayStateChange(true));
    ws.on('pause', () => onPlayStateChange(false));
    ws.on('finish', () => onPlayStateChange(false));

    wavesurferRef.current = ws;

    return () => { ws.destroy(); };
  }, [file]);

  return (
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
  );
}
