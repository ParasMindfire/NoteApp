const TAG_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
] as const;

export function getTagColor(count: number): string {
  return TAG_COLORS[count % TAG_COLORS.length] as string;
}
