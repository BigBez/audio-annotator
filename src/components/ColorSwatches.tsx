import { SECTION_COLORS } from '@/lib/sections';

interface ColorSwatchesProps {
  activeColor?: string;
  onColorSelect: (color: string) => void;
}

export default function ColorSwatches({ activeColor, onColorSelect }: ColorSwatchesProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {SECTION_COLORS.map(color => (
        <button
          key={color}
          onClick={(e) => { e.stopPropagation(); onColorSelect(color); }}
          className="h-4 w-4 rounded-full shrink-0 transition-transform hover:scale-125"
          style={{
            backgroundColor: color,
            boxShadow: activeColor === color ? '0 0 0 2px hsl(var(--background)), 0 0 0 3.5px hsl(var(--foreground))' : 'none',
          }}
          title={color}
        />
      ))}
    </div>
  );
}
