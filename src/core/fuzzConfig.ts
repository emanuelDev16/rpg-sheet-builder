/**
 * Resolves deterministic fast-check options in CI (or when `FUZZ_SEED` is set)
 * while preserving exploratory random seeds during local runs.
 */
export function getFuzzOptions(
  defaultSeed: number,
  numRuns = 200,
): { numRuns: number; seed?: number } {
  const rawSeed = typeof process !== 'undefined' ? process.env?.FUZZ_SEED : undefined;
  if (rawSeed !== undefined && rawSeed.trim() !== '') {
    const parsed = Number.parseInt(rawSeed, 10);
    if (Number.isFinite(parsed)) {
      return { numRuns, seed: parsed };
    }
  }
  const isCi = typeof process !== 'undefined' && process.env?.CI === 'true';
  const forceRandom = typeof process !== 'undefined' && process.env?.FUZZ_RANDOM === '1';
  return isCi && !forceRandom ? { numRuns, seed: defaultSeed } : { numRuns };
}
