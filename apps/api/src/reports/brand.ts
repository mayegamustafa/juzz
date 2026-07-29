import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const APP_NAME = 'SAK/CPS Juzz Tracking System';
export const ORG_NAME = "Sir Apollo Kaggwa Schools & City Parents' School";

// The organisation's letterhead, used verbatim at the top of every printed
// report and PDF. Line 4 is filled in per-document with the specific school
// (a pupil's own school, or "All Schools" for an organisation-wide report).
export const LETTERHEAD_TITLE = 'SIR APOLLO KAGGWA SCHOOLS - SINCE 1996';
export const LETTERHEAD_MOTTO = '"Where your child is guaranteed a first grade"';
export const LETTERHEAD_DEPARTMENT = 'THEOLOGY DEPARTMENT';

export function letterheadSchoolLine(schoolName?: string | null): string {
  return schoolName ?? 'All Schools';
}

/** Printed reports are the school's documents, so the footer credits the school. */
export const COPYRIGHT_HOLDER = 'Sir Apollo Kaggwa Schools';
export function copyrightLine(): string {
  return `© ${new Date().getFullYear()} ${COPYRIGHT_HOLDER}`;
}

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

let cachedSmall: { sak: Buffer | null; cps: Buffer | null } | undefined;

/**
 * 96px crests — both are drawn at ~46-48px in every report, so this is the only
 * size the export service needs. Read (and cached) once; embedding a full-size
 * PNG in a PDF/Excel document that reuses it per page/sheet is what inflated a
 * 4-page report to over a megabyte before this was introduced.
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
  if (!d) return 'N/A';
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
