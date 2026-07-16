export interface ChartColors {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  cyan: string;
  amber: string;
  green: string;
  red: string;
  muted: string;
}

const LIGHT: ChartColors = {
  grid: '#E2E8F0',
  axis: '#64748B',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#DCE5EE',
  tooltipText: '#101827',
  cyan: '#0D857C',
  amber: '#B45F06',
  green: '#04825A',
  red: '#C81E1E',
  muted: '#64748B',
};

const DARK: ChartColors = {
  grid: '#22304A',
  axis: '#8A9BB5',
  tooltipBg: '#121A2B',
  tooltipBorder: '#22304A',
  tooltipText: '#E6EDF3',
  cyan: '#4FD1C5',
  amber: '#F5A623',
  green: '#34D399',
  red: '#EF4444',
  muted: '#8A9BB5',
};

export function getChartColors(theme: 'light' | 'dark'): ChartColors {
  return theme === 'dark' ? DARK : LIGHT;
}
