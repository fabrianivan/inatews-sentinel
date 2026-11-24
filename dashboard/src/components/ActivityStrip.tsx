'use client';

import type { AttentionAssessment, DayActivity } from '@/lib/attention';
import { toneFromMagnitude } from '@/lib/severity';
import { formatDecimal } from '@/lib/time';

interface ActivityStripProps {
  /** BMKG M≥5 activity per WIB day, oldest first (see summarizeDays). */
  days: DayActivity[];
  /** The attention assessment whose facts are listed under the strip. */
  assessment: AttentionAssessment;
}

/** Bars are scaled between the list threshold and a great earthquake. */
const MIN_MAGNITUDE = 5;
const MAX_MAGNITUDE = 9;
const BAR_AREA_PX = 56;

function barHeight(magnitude: number): number {
  const share = (Math.min(MAX_MAGNITUDE, Math.max(MIN_MAGNITUDE, magnitude)) - MIN_MAGNITUDE) / (MAX_MAGNITUDE - MIN_MAGNITUDE);
  return Math.round(10 + share * (BAR_AREA_PX - 10));
}

/**
 * What has already happened, as BMKG reported it: one column per day whose
 * height is that day's largest M≥5 earthquake. Replaces the old "MMI %" ring —
 * a list of facts cannot be mistaken for an instrument or a forecast.
 */
export default function ActivityStrip({ days, assessment }: ActivityStripProps) {
  const { counts, reasons, level } = assessment;
  const unknown = level === 'unknown';

  return (
    <section aria-label="Aktivitas gempa tujuh hari terakhir">
      <h3 className="t-micro">Aktivitas 7 hari · BMKG M≥5</h3>
      <p className="t-meta text-[var(--text-muted)]">Tinggi batang = magnitudo terbesar hari itu</p>

      {unknown ? (
        <p className="t-body mt-3 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-4 text-center text-[var(--text-muted)]">
          {/* The assessment words the reason itself: still loading, stale, or unavailable */}
          {assessment.headline}
        </p>
      ) : (
        <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Per hari, dari yang terlama">
          {days.map((day) => (
            <li key={day.dayStartMs} className="flex flex-col items-center gap-1">
              <div className="flex w-full items-end justify-center" style={{ height: BAR_AREA_PX }}>
                {day.largest !== null ? (
                  <span
                    // Colour only inside the 24-hour window that drives the level; older days are neutral history.
                    data-tone={day.inWindow ? toneFromMagnitude(day.largest) : 'rutin'}
                    className="w-full max-w-7 rounded-t-md"
                    style={{
                      height: barHeight(day.largest),
                      background: day.inWindow ? 'var(--tone-solid)' : 'var(--border-strong)',
                    }}
                  />
                ) : (
                  <span className="h-px w-full max-w-7 bg-[var(--border-strong)]" />
                )}
              </div>
              <span className="t-data text-[11px] leading-4 text-[var(--text-primary)]">
                {day.largest !== null ? `M${formatDecimal(day.largest)}` : '—'}
              </span>
              <span className="text-[11px] leading-4 text-[var(--text-muted)]">
                {day.label.split(' ')[0]}
                <span className="sr-only">
                  {' '}
                  {day.label}: {day.count} gempa M≥5
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: '24 jam', value: unknown ? '—' : String(counts.last24h) },
          { label: '7 hari', value: unknown ? '—' : String(counts.last7d) },
          {
            label: 'Terbesar',
            value: unknown || counts.largest7d === null ? '—' : `M${formatDecimal(counts.largest7d)}`,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 py-1.5">
            <dt className="t-micro">{item.label}</dt>
            <dd className="t-data-lg">{item.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 space-y-1">
        {reasons.map((reason) => (
          <li key={reason} className="t-meta flex gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      <p className="t-meta mt-2 text-[var(--text-muted)]">
        Ringkasan kejadian yang sudah terjadi — bukan prakiraan.
      </p>
    </section>
  );
}
