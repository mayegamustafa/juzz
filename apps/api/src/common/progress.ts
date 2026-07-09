// Target configuration for V1: "2 Juzu" = Juzu Tabaraka (29) + Juzu Amma (30),
// i.e. surahs 67..114 = 48 surahs. Centralized so it can later be driven by Target rows.
export const TARGET_JUZ = [29, 30];
export const TARGET_SURAH_COUNT = 48; // surahs 67..114

export function progressPercent(memorizedFraction: number): number {
  return Math.round((memorizedFraction / TARGET_SURAH_COUNT) * 1000) / 10; // 1 decimal
}
