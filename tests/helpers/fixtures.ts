import { emptyNormalizedJob, type NormalizedJob } from '@/domain/job';

let seq = 0;

export function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  seq++;
  return {
    ...emptyNormalizedJob({
      sourceId: 'test-source',
      sourceExternalId: `ext-${seq}`,
      sourceUrl: `https://example.gov.tr/ilan/${seq}`,
      title: `Test ilanı ${seq}`,
      parserVersion: 1,
    }),
    sector: 'public',
    ...overrides,
  };
}
