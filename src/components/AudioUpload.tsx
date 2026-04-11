import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

interface AudioUploadProps {
  onFileLoaded: (file: File) => void;
}

const ACCEPTED = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-flac', 'audio/mp4', 'audio/x-m4a'];

export default function AudioUpload({ onFileLoaded }: AudioUploadProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (ACCEPTED.some(t => file.type === t) || /\.(mp3|wav|flac|m4a)$/i.test(file.name)) {
      onFileLoaded(file);
    }
  }, [onFileLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-16 transition-colors cursor-pointer ${
        dragging ? 'border-primary bg-accent/30' : 'border-border hover:border-muted-foreground'
      }`}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mp3,.wav,.flac,.m4a';
        input.onchange = () => { if (input.files?.[0]) handleFile(input.files[0]); };
        input.click();
      }}
    >
      <Upload className="h-10 w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-lg font-medium font-display">Drop an audio file here</p>
        <p className="text-sm text-muted-foreground font-mono mt-1">MP3, WAV, FLAC, M4A</p>
      </div>
    </div>
  );
}
