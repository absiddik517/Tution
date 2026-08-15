import { useStore } from './store';

export type ThemePreset = 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet' | 'blue';

export interface ThemeClasses {
  // Base Layout
  bgMain: string;
  bgCard: string;
  bgCardHover: string;
  bgCardElevated: string;
  bgInput: string;
  borderMain: string;
  borderMuted: string;
  textMain: string;
  textMuted: string;
  textTitle: string;
  bgHeader: string;
  bgSidebar: string;
  
  // Active Preset Specific
  primary: string;
  hover: string;
  bgAccent: string; // e.g. lighter version for selected lists/tabs
  textAccent: string; // text matching primary
  textAccentMuted: string; // secondary text matching primary
  borderAccent: string;
  badgeAccent: string;
  btnPrimary: string;
  ringFocus: string;
  accentShadow: string;
  bgAccentSolid: string;
}

export const THEME_PRESETS: Record<ThemePreset, {
  name: string;
  light: Partial<ThemeClasses>;
  dark: Partial<ThemeClasses>;
}> = {
  indigo: {
    name: 'Oceanic Indigo',
    light: {
      primary: 'bg-indigo-600',
      hover: 'hover:bg-indigo-700',
      bgAccent: 'bg-indigo-50/70',
      textAccent: 'text-indigo-600',
      textAccentMuted: 'text-indigo-500',
      borderAccent: 'border-indigo-100',
      badgeAccent: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-550',
      ringFocus: 'focus:ring-indigo-500',
      accentShadow: 'shadow-indigo-100',
      bgAccentSolid: 'bg-indigo-600',
    },
    dark: {
      primary: 'bg-indigo-500',
      hover: 'hover:bg-indigo-600',
      bgAccent: 'bg-indigo-950/40',
      textAccent: 'text-indigo-400',
      textAccentMuted: 'text-indigo-300',
      borderAccent: 'border-indigo-900/55',
      badgeAccent: 'bg-indigo-950/60 text-indigo-300 border-indigo-900/50',
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500/50',
      ringFocus: 'focus:ring-indigo-500',
      accentShadow: 'shadow-indigo-950/50',
      bgAccentSolid: 'bg-indigo-600',
    }
  },
  emerald: {
    name: 'Garden Emerald',
    light: {
      primary: 'bg-emerald-600',
      hover: 'hover:bg-emerald-700',
      bgAccent: 'bg-emerald-50/70',
      textAccent: 'text-emerald-600',
      textAccentMuted: 'text-emerald-500',
      borderAccent: 'border-emerald-100',
      badgeAccent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-550',
      ringFocus: 'focus:ring-emerald-500',
      accentShadow: 'shadow-emerald-100',
      bgAccentSolid: 'bg-emerald-600',
    },
    dark: {
      primary: 'bg-emerald-500',
      hover: 'hover:bg-emerald-600',
      bgAccent: 'bg-emerald-950/40',
      textAccent: 'text-emerald-400',
      textAccentMuted: 'text-emerald-300',
      borderAccent: 'border-emerald-900/55',
      badgeAccent: 'bg-emerald-950/60 text-emerald-300 border-emerald-900/50',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500/50',
      ringFocus: 'focus:ring-emerald-500',
      accentShadow: 'shadow-emerald-950/50',
      bgAccentSolid: 'bg-emerald-600',
    }
  },
  rose: {
    name: 'Warm Coral Rose',
    light: {
      primary: 'bg-rose-600',
      hover: 'hover:bg-rose-700',
      bgAccent: 'bg-rose-50/70',
      textAccent: 'text-rose-600',
      textAccentMuted: 'text-rose-500',
      borderAccent: 'border-rose-100',
      badgeAccent: 'bg-rose-50 text-rose-700 border-rose-100',
      btnPrimary: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-550',
      ringFocus: 'focus:ring-rose-500',
      accentShadow: 'shadow-rose-100',
      bgAccentSolid: 'bg-rose-600',
    },
    dark: {
      primary: 'bg-rose-500',
      hover: 'hover:bg-rose-600',
      bgAccent: 'bg-rose-950/40',
      textAccent: 'text-rose-400',
      textAccentMuted: 'text-rose-300',
      borderAccent: 'border-rose-900/55',
      badgeAccent: 'bg-rose-950/60 text-rose-300 border-rose-900/50',
      btnPrimary: 'bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500/50',
      ringFocus: 'focus:ring-rose-500',
      accentShadow: 'shadow-rose-950/50',
      bgAccentSolid: 'bg-rose-600',
    }
  },
  amber: {
    name: 'Sunset Amber',
    light: {
      primary: 'bg-amber-500',
      hover: 'hover:bg-amber-600',
      bgAccent: 'bg-amber-50/70',
      textAccent: 'text-amber-700',
      textAccentMuted: 'text-amber-600',
      borderAccent: 'border-amber-100',
      badgeAccent: 'bg-amber-50 text-amber-800 border-amber-100',
      btnPrimary: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-550',
      ringFocus: 'focus:ring-amber-500',
      accentShadow: 'shadow-amber-100',
      bgAccentSolid: 'bg-amber-500',
    },
    dark: {
      primary: 'bg-amber-500',
      hover: 'hover:bg-amber-600',
      bgAccent: 'bg-amber-950/40',
      textAccent: 'text-amber-400',
      textAccentMuted: 'text-amber-300',
      borderAccent: 'border-amber-900/55',
      badgeAccent: 'bg-amber-950/60 text-amber-300 border-amber-900/50',
      btnPrimary: 'bg-amber-500 hover:bg-amber-600 text-slate-900 focus:ring-amber-500/50',
      ringFocus: 'focus:ring-amber-500',
      accentShadow: 'shadow-amber-950/50',
      bgAccentSolid: 'bg-amber-500',
    }
  },
  violet: {
    name: 'Amethyst Spark',
    light: {
      primary: 'bg-violet-600',
      hover: 'hover:bg-violet-700',
      bgAccent: 'bg-violet-50/70',
      textAccent: 'text-violet-600',
      textAccentMuted: 'text-violet-500',
      borderAccent: 'border-violet-100',
      badgeAccent: 'bg-violet-50 text-violet-700 border-violet-100',
      btnPrimary: 'bg-violet-600 hover:bg-violet-700 text-white focus:ring-violet-550',
      ringFocus: 'focus:ring-violet-500',
      accentShadow: 'shadow-violet-100',
      bgAccentSolid: 'bg-violet-600',
    },
    dark: {
      primary: 'bg-violet-500',
      hover: 'hover:bg-violet-600',
      bgAccent: 'bg-violet-950/40',
      textAccent: 'text-violet-400',
      textAccentMuted: 'text-violet-300',
      borderAccent: 'border-violet-900/55',
      badgeAccent: 'bg-violet-950/60 text-violet-300 border-violet-900/50',
      btnPrimary: 'bg-violet-600 hover:bg-violet-500 text-white focus:ring-violet-500/50',
      ringFocus: 'focus:ring-violet-500',
      accentShadow: 'shadow-violet-950/50',
      bgAccentSolid: 'bg-violet-600',
    }
  },
  blue: {
    name: 'Classic Cobalt',
    light: {
      primary: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      bgAccent: 'bg-blue-50/70',
      textAccent: 'text-blue-600',
      textAccentMuted: 'text-blue-500',
      borderAccent: 'border-blue-100',
      badgeAccent: 'bg-blue-50 text-blue-700 border-blue-100',
      btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-550',
      ringFocus: 'focus:ring-blue-500',
      accentShadow: 'shadow-blue-100',
      bgAccentSolid: 'bg-blue-600',
    },
    dark: {
      primary: 'bg-blue-500',
      hover: 'hover:bg-blue-600',
      bgAccent: 'bg-blue-950/40',
      textAccent: 'text-blue-400',
      textAccentMuted: 'text-blue-300',
      borderAccent: 'border-blue-900/55',
      badgeAccent: 'bg-blue-950/60 text-blue-300 border-blue-900/50',
      btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500/50',
      ringFocus: 'focus:ring-blue-500',
      accentShadow: 'shadow-blue-950/50',
      bgAccentSolid: 'bg-blue-600',
    }
  }
};

export const getThemeClasses = (themeName: ThemePreset = 'indigo', darkMode: boolean): ThemeClasses => {
  const baseLight: Omit<ThemeClasses, keyof typeof THEME_PRESETS.indigo.light> = {
    bgMain: 'bg-slate-50 text-slate-800',
    bgCard: 'bg-white',
    bgCardHover: 'hover:bg-slate-50/50',
    bgCardElevated: 'bg-slate-50',
    bgInput: 'bg-slate-50 border-slate-200 focus:bg-white text-slate-800 focus:border-indigo-500',
    borderMain: 'border-slate-200',
    borderMuted: 'border-slate-100',
    textMain: 'text-slate-700',
    textMuted: 'text-slate-400',
    textTitle: 'text-slate-900',
    bgHeader: 'bg-white border-slate-200',
    bgSidebar: 'bg-white border-slate-200',
  };

  const baseDark: Omit<ThemeClasses, keyof typeof THEME_PRESETS.indigo.dark> = {
    bgMain: 'bg-slate-950 text-slate-200',
    bgCard: 'bg-slate-900 border-slate-800/80',
    bgCardHover: 'hover:bg-slate-850/65',
    bgCardElevated: 'bg-slate-850 border-slate-800/50',
    bgInput: 'bg-slate-800/80 border-slate-750/70 focus:bg-slate-800 text-slate-100 focus:border-indigo-500/80 focus:ring-indigo-500/20',
    borderMain: 'border-slate-800',
    borderMuted: 'border-slate-800/60',
    textMain: 'text-slate-300',
    textMuted: 'text-slate-400',
    textTitle: 'text-white',
    bgHeader: 'bg-slate-900/90 border-slate-800/80 backdrop-blur',
    bgSidebar: 'bg-slate-900 border-slate-800/80',
  };

  const preset = THEME_PRESETS[themeName] || THEME_PRESETS.indigo;
  const activePreset = darkMode ? preset.dark : preset.light;
  const base = darkMode ? baseDark : baseLight;

  return {
    ...base,
    ...activePreset,
  } as ThemeClasses;
};

export const useTheme = () => {
  const { settings } = useStore();
  const activeTheme: ThemePreset = (settings.themeColor as ThemePreset) || 'indigo';
  return {
    theme: getThemeClasses(activeTheme, settings.darkMode),
    presetName: THEME_PRESETS[activeTheme]?.name || 'Oceanic Indigo',
    presetKey: activeTheme,
    darkMode: settings.darkMode
  };
};
