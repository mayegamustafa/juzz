import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const APP_NAME = 'SAK/CPS Juzz Tracking System';
export const ORG_NAME = "Sir Apollo Kaggwa Schools & City Parents' School";

export const EMERALD = '#047857';
export const EMERALD_DARK = '#065F46';
export const GOLD = '#B8860B';
export const GREY = '#6B7280';
export const ZEBRA = '#F3F4F6';
export const INK = '#111111';

/**
 * Logos ship alongside the compiled output. Resolve against both the build dir
 * and the source tree so reports render in dev (`nest start`) and in a container.
 */
function findAsset(name: string): Buffer | null {
  const candidates = [
    join(__dirname, '..', 'assets', 'brand', name), // dist/assets/brand
    join(__dirname, '..', '..', 'assets', 'brand', name), // apps/api/assets/brand
    join(process.cwd(), 'assets', 'brand', name),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p);
  }
  return null;
}

let cached: { sak: Buffer | null; cps: Buffer | null } | undefined;
let cachedSmall: { sak: Buffer | null; cps: Buffer | null } | undefined;

/** Full-size crests, for Excel. Read once — a report should not hit the disk per page. */
export function logos(): { sak: Buffer | null; cps: Buffer | null } {
  if (!cached) cached = { sak: findAsset('sak.png'), cps: findAsset('cps.png') };
  return cached;
}

/**
 * 96px crests for PDF headers. The full-size ones inflate a multi-page report by
 * a megabyte, and they are drawn at 40px anyway.
 */
export function logosSmall(): { sak: Buffer | null; cps: Buffer | null } {
  if (!cachedSmall) {
    cachedSmall = {
      sak: findAsset('sak-sm.png') ?? findAsset('sak.png'),
      cps: findAsset('cps-sm.png') ?? findAsset('cps.png'),
    };
  }
  return cachedSmall;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
