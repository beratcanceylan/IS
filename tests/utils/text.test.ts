import { fnv1a } from '@/utils/text';

describe('fnv1a', () => {
  it('mevcut kimliklerle aynı özeti üretir (UTF-16 kod birimleri)', () => {
    expect(['', 'abc', 'İlan Takip', 'emoji 🎉 test', 'ğüşıöç'].map(fnv1a)).toEqual([
      '811c9dc5',
      '1a47e90b',
      'eba66acb',
      '1a50284c',
      'c7d47abd',
    ]);
  });
});
