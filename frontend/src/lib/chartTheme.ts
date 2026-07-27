'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

export interface ChartTheme {
  accent: string;
  muted: string;
  tooltipBg: string;
  tooltipBorder: string;
  green: string;
  red: string;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Reads chart colors from the active theme's CSS custom properties. Recharts
 * needs concrete color strings for SVG strokes/fills (it can't consume
 * `var(--x)` reliably), so we resolve them at runtime and re-read whenever the
 * theme changes. Charts stay bound to real data — only the colors change.
 */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ChartTheme>({
    accent: '#6d54d6',
    muted: '#6b6484',
    tooltipBg: '#ffffff',
    tooltipBorder: '#ece6f5',
    green: '#12a594',
    red: '#dc6a6a',
  });

  useEffect(() => {
    setColors({
      accent: readVar('--accent', '#6d54d6'),
      muted: readVar('--text-muted', '#6b6484'),
      tooltipBg: readVar('--bg-card', '#ffffff'),
      tooltipBorder: readVar('--border', '#ece6f5'),
      green: readVar('--green', '#12a594'),
      red: readVar('--red', '#dc6a6a'),
    });
  }, [theme]);

  return colors;
}
