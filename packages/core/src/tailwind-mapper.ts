/**
 * Maps CSS property-value pairs to Tailwind CSS utility classes.
 */

const SPACING_MAP: Record<string, string> = {
  '0px': '0',
  '1px': 'px',
  '2px': '0.5',
  '4px': '1',
  '6px': '1.5',
  '8px': '2',
  '10px': '2.5',
  '12px': '3',
  '14px': '3.5',
  '16px': '4',
  '20px': '5',
  '24px': '6',
  '28px': '7',
  '32px': '8',
  '36px': '9',
  '40px': '10',
  '44px': '11',
  '48px': '12',
  '56px': '14',
  '64px': '16',
  '80px': '20',
  '96px': '24',
};

const FONT_SIZE_MAP: Record<string, string> = {
  '12px': 'text-xs',
  '14px': 'text-sm',
  '16px': 'text-base',
  '18px': 'text-lg',
  '20px': 'text-xl',
  '24px': 'text-2xl',
  '30px': 'text-3xl',
  '36px': 'text-4xl',
  '48px': 'text-5xl',
  '60px': 'text-6xl',
  '72px': 'text-7xl',
};

const FONT_WEIGHT_MAP: Record<string, string> = {
  '100': 'font-thin',
  '200': 'font-extralight',
  '300': 'font-light',
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black',
  'normal': 'font-normal',
  'bold': 'font-bold',
};

const RADIUS_MAP: Record<string, string> = {
  '0px': 'rounded-none',
  '2px': 'rounded-sm',
  '4px': 'rounded',
  '6px': 'rounded-md',
  '8px': 'rounded-lg',
  '12px': 'rounded-xl',
  '16px': 'rounded-2xl',
  '24px': 'rounded-3xl',
  '9999px': 'rounded-full',
  '50%': 'rounded-full',
};

function normalizePixel(val: string): string {
  if (!val) return '';
  const num = parseFloat(val);
  if (isNaN(num)) return val.trim();
  return `${Math.round(num)}px`;
}

export function mapStyleToTailwind(property: string, value: string): string | undefined {
  const prop = property.toLowerCase().trim();
  const val = value.toLowerCase().trim();
  const normPx = normalizePixel(val);

  switch (prop) {
    // Spacing - Padding
    case 'padding':
      return SPACING_MAP[normPx] ? `p-${SPACING_MAP[normPx]}` : `p-[${val}]`;
    case 'padding-top':
      return SPACING_MAP[normPx] ? `pt-${SPACING_MAP[normPx]}` : `pt-[${val}]`;
    case 'padding-bottom':
      return SPACING_MAP[normPx] ? `pb-${SPACING_MAP[normPx]}` : `pb-[${val}]`;
    case 'padding-left':
      return SPACING_MAP[normPx] ? `pl-${SPACING_MAP[normPx]}` : `pl-[${val}]`;
    case 'padding-right':
      return SPACING_MAP[normPx] ? `pr-${SPACING_MAP[normPx]}` : `pr-[${val}]`;

    // Spacing - Margin
    case 'margin':
      return SPACING_MAP[normPx] ? `m-${SPACING_MAP[normPx]}` : `m-[${val}]`;
    case 'margin-top':
      return SPACING_MAP[normPx] ? `mt-${SPACING_MAP[normPx]}` : `mt-[${val}]`;
    case 'margin-bottom':
      return SPACING_MAP[normPx] ? `mb-${SPACING_MAP[normPx]}` : `mb-[${val}]`;
    case 'margin-left':
      return SPACING_MAP[normPx] ? `ml-${SPACING_MAP[normPx]}` : `ml-[${val}]`;
    case 'margin-right':
      return SPACING_MAP[normPx] ? `mr-${SPACING_MAP[normPx]}` : `mr-[${val}]`;

    // Layout - Gap
    case 'gap':
      return SPACING_MAP[normPx] ? `gap-${SPACING_MAP[normPx]}` : `gap-[${val}]`;
    case 'row-gap':
      return SPACING_MAP[normPx] ? `gap-y-${SPACING_MAP[normPx]}` : `gap-y-[${val}]`;
    case 'column-gap':
      return SPACING_MAP[normPx] ? `gap-x-${SPACING_MAP[normPx]}` : `gap-x-[${val}]`;

    // Typography
    case 'font-size':
      return FONT_SIZE_MAP[normPx] || `text-[${val}]`;
    case 'font-weight':
      return FONT_WEIGHT_MAP[val] || `font-[${val}]`;
    case 'text-align':
      if (['left', 'center', 'right', 'justify'].includes(val)) {
        return `text-${val}`;
      }
      break;

    // Display & Flex
    case 'display':
      if (['flex', 'inline-flex', 'grid', 'inline-grid', 'block', 'inline-block', 'inline', 'hidden', 'none'].includes(val)) {
        return val === 'none' ? 'hidden' : val;
      }
      break;
    case 'flex-direction':
      if (val === 'row') return 'flex-row';
      if (val === 'column') return 'flex-col';
      if (val === 'row-reverse') return 'flex-row-reverse';
      if (val === 'column-reverse') return 'flex-col-reverse';
      break;
    case 'align-items':
      if (val === 'center') return 'items-center';
      if (val === 'flex-start' || val === 'start') return 'items-start';
      if (val === 'flex-end' || val === 'end') return 'items-end';
      if (val === 'stretch') return 'items-stretch';
      if (val === 'baseline') return 'items-baseline';
      break;
    case 'justify-content':
      if (val === 'center') return 'justify-center';
      if (val === 'flex-start' || val === 'start') return 'justify-start';
      if (val === 'flex-end' || val === 'end') return 'justify-end';
      if (val === 'space-between') return 'justify-between';
      if (val === 'space-around') return 'justify-around';
      if (val === 'space-evenly') return 'justify-evenly';
      break;

    // Border Radius
    case 'border-radius':
      return RADIUS_MAP[normPx] || `rounded-[${val}]`;

    // Opacity
    case 'opacity': {
      const op = parseFloat(val);
      if (!isNaN(op)) {
        const pct = Math.round(op * 100);
        return `opacity-${pct}`;
      }
      break;
    }
  }

  return undefined;
}
