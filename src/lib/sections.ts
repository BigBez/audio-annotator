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

export const SECTION_COLORS = [
  '#C94040', '#E8826A',
  '#D4A017', '#E8C96A',
  '#3A6EA8', '#6A9EC4',
  '#3A8A4A', '#7AB87A',
  '#C45C8A', '#E8A0BC',
  '#6A3A9A', '#9A6AC4',
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
