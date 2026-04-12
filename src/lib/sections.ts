export interface Section {
  id: string;
  start: number;
  end: number;
  label: string;
  color: string;
  notes: string;
  bars: string | null;
}

export interface VcuSpan {
  id: string;
  label: string;
  sectionIds: string[];
}

const SECTION_COLORS = [
  'hsl(168, 50%, 45%)',
  'hsl(200, 50%, 50%)',
  'hsl(280, 40%, 55%)',
  'hsl(340, 50%, 50%)',
  'hsl(30, 60%, 50%)',
  'hsl(140, 40%, 45%)',
  'hsl(220, 50%, 55%)',
  'hsl(0, 50%, 50%)',
];

export function getColorForIndex(index: number): string {
  return SECTION_COLORS[index % SECTION_COLORS.length];
}

export function getDefaultLabel(index: number): string {
  return String(index + 1);
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseTime(str: string): number | null {
  const match = str.trim().match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (secs >= 60) return null;
  return mins * 60 + secs;
}
