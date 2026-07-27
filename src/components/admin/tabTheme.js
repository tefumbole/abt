/** Shared colorful tab themes for admin module navigation */

export const TAB_COLOR_MAP = {
  blue: {
    idle: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400',
    active: 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200',
  },
  navy: {
    idle: 'border-[#7aa3d4] bg-[#eef5fc] text-[#003D82] hover:bg-[#dceaf8]',
    active: 'border-[#003D82] bg-[#003D82] text-white shadow-md shadow-blue-200',
  },
  gold: {
    idle: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
    active: 'border-[#D4AF37] bg-[#D4AF37] text-[#003D82] shadow-md shadow-amber-200',
  },
  purple: {
    idle: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100',
    active: 'border-purple-600 bg-purple-600 text-white shadow-md shadow-purple-200',
  },
  pink: {
    idle: 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100',
    active: 'border-pink-600 bg-pink-600 text-white shadow-md shadow-pink-200',
  },
  green: {
    idle: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100',
    active: 'border-green-600 bg-green-600 text-white shadow-md shadow-green-200',
  },
  teal: {
    idle: 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100',
    active: 'border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-200',
  },
  orange: {
    idle: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100',
    active: 'border-orange-600 bg-orange-600 text-white shadow-md shadow-orange-200',
  },
  indigo: {
    idle: 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    active: 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200',
  },
  cyan: {
    idle: 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    active: 'border-cyan-600 bg-cyan-600 text-white shadow-md shadow-cyan-200',
  },
  rose: {
    idle: 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100',
    active: 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-200',
  },
  slate: {
    idle: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100',
    active: 'border-slate-700 bg-slate-700 text-white shadow-md shadow-slate-200',
  },
};

export const TAB_COLOR_ORDER = [
  'navy',
  'gold',
  'blue',
  'green',
  'purple',
  'teal',
  'orange',
  'indigo',
  'pink',
  'cyan',
  'rose',
  'slate',
];

export function getTabTheme(colorOrIndex) {
  if (typeof colorOrIndex === 'number') {
    const key = TAB_COLOR_ORDER[colorOrIndex % TAB_COLOR_ORDER.length];
    return TAB_COLOR_MAP[key];
  }
  return TAB_COLOR_MAP[colorOrIndex] || TAB_COLOR_MAP.navy;
}

export const COLORED_TAB_BASE =
  'inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border-2 transition-all whitespace-nowrap';
