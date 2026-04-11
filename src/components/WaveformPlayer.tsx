import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Square } from 'lucide-react';
import { formatTime, type Section } from '@/lib/sections';

interface WaveformPlayerProps {
  file: File;
  sections: Section[];
  onTimeUpdate: (time: number) => void;
  onDurationReady: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onStop: () => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

export default function WaveformPlayer({
  file,
  sections,
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
      height: 120,
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
    <div className="space-y-3">
      {/* Time display */}
      <div className="flex items-center justify-between font-mono text-sm">
        <span className="text-accent-foreground">{formatTime(currentTime)}</span>
        <span className="text-muted-foreground">{formatTime(duration)}</span>
      </div>

      {/* Section regions overlay + waveform */}
      <div className="relative">
        {duration > 0 && sections.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1.5 z-10 rounded-t overflow-hidden flex">
            {sections.map(s => (
              <div
                key={s.id}
                style={{
                  left: `${(s.start / duration) * 100}%`,
                  width: `${((s.end - s.start) / duration) * 100}%`,
                  backgroundColor: s.color,
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                }}
              />
            ))}
          </div>
        )}
        <div ref={containerRef} className="rounded-lg bg-secondary/50 p-2 pt-3" />
      </div>

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
    </div>
  );
}
