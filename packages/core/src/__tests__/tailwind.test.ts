import { describe, it, expect } from 'vitest';
import { mapStyleToTailwind } from '../tailwind-mapper.js';

describe('Tailwind Mapper', () => {
  it('maps spacing values', () => {
    expect(mapStyleToTailwind('padding', '16px')).toBe('p-4');
    expect(mapStyleToTailwind('margin-bottom', '24px')).toBe('mb-6');
    expect(mapStyleToTailwind('gap', '32px')).toBe('gap-8');
  });

  it('maps typography values', () => {
    expect(mapStyleToTailwind('font-size', '24px')).toBe('text-2xl');
    expect(mapStyleToTailwind('font-weight', '700')).toBe('font-bold');
    expect(mapStyleToTailwind('text-align', 'center')).toBe('text-center');
  });

  it('maps flex and layout values', () => {
    expect(mapStyleToTailwind('display', 'flex')).toBe('flex');
    expect(mapStyleToTailwind('flex-direction', 'column')).toBe('flex-col');
    expect(mapStyleToTailwind('justify-content', 'space-between')).toBe('justify-between');
    expect(mapStyleToTailwind('align-items', 'center')).toBe('items-center');
  });

  it('maps arbitrary pixel values gracefully', () => {
    expect(mapStyleToTailwind('padding', '15px')).toBe('p-[15px]');
  });
});
