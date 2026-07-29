import Image from 'next/image';

export const APP_NAME = 'SAK/CPS Juzz Tracking System';
export const APP_SHORT = 'Juzz Tracking';
export const ORG_NAME = "Sir Apollo Kaggwa Schools & City Parents' School";

// The organisation's letterhead — used verbatim on the login screen and at the
// top of every printed report, matching the paper documents Sheikhs already know.
export const LETTERHEAD_TITLE = 'Sir Apollo Kaggwa Schools - Since 1996';
export const LETTERHEAD_MOTTO = '"Where your child is guaranteed a first grade"';
export const LETTERHEAD_DEPARTMENT = 'Theology Department';

/**
 * The two school crests. Both are crimson, so they sit on a light chip rather
 * than the emerald surface — otherwise they fight the app's palette.
 */
export function BrandLogos({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="inline-flex items-center justify-center rounded-md bg-white p-1 ring-1 ring-black/5"
        style={{ width: size, height: size }}
      >
        <Image src="/brand/sak.png" alt="Sir Apollo Kaggwa Schools" width={size} height={size} priority />
      </span>
      <span
        className="inline-flex items-center justify-center rounded-md bg-white p-0.5 ring-1 ring-black/5"
        style={{ width: size, height: size }}
      >
        <Image src="/brand/cps.png" alt="City Parents' School" width={size} height={size} priority />
      </span>
    </span>
  );
}

/** Sidebar / header lockup: crests + name. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandLogos size={compact ? 28 : 34} />
      <div className="min-w-0">
        <p className="truncate font-bold leading-tight text-emerald-700 dark:text-emerald-400">
          {compact ? 'SAK/CPS' : APP_SHORT}
        </p>
        <p className="truncate text-[10px]" style={{ color: 'var(--muted)' }}>
          {compact ? APP_SHORT : 'SAK & CPS Schools'}
        </p>
      </div>
    </div>
  );
}
