'use client';

import { ExternalLink } from 'lucide-react';
import { EventAge } from './SentinelClocks';
import { feedStateWord, type FeedHealth, type FeedHealthState } from '@/lib/feeds';
import type { Tone } from '@/lib/severity';

interface SourcePanelProps {
  feeds: FeedHealth[];
}

const STATE_TONE: Record<FeedHealthState, Tone> = {
  live: 'rutin',
  loading: 'unknown',
  unreported: 'unknown',
  stale: 'meningkat',
  seed: 'meningkat',
  failed: 'kritis',
};

const STATE_NOTE: Record<FeedHealthState, string> = {
  live: 'Data dari sumber, tampil apa adanya.',
  loading: 'Permintaan pertama belum selesai.',
  unreported: 'Backend tidak melaporkan asal data.',
  stale: 'Tidak ada pembaruan lebih dari satu menit.',
  seed: 'Sumber tidak menjawab — yang tampil adalah data contoh bawaan.',
  failed: 'Permintaan terakhir gagal — yang tampil, bila ada, berasal dari pembaruan terakhir yang berhasil.',
};

/** Who actually issues what. The dashboard issues nothing. */
const AUTHORITIES = [
  { what: 'Peringatan dini tsunami dan info gempa', who: 'BMKG', href: 'https://www.bmkg.go.id/gempabumi' },
  { what: 'Tingkat aktivitas gunung api', who: 'PVMBG – Badan Geologi', href: 'https://magma.esdm.go.id' },
  { what: 'Perintah evakuasi', who: 'Pemerintah daerah / BPBD' },
];

/**
 * The one place that states, in full, where every number on the dashboard
 * comes from, how fresh it is, and that none of it is an official warning.
 */
export default function SourcePanel({ feeds }: SourcePanelProps) {
  return (
    <section id="sumber-data" aria-labelledby="sumber-data-title" className="@container matte-card p-4 @xl:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sumber-data-title" className="t-heading-lg">
          Sumber data
        </h2>
        <p className="t-meta text-[var(--text-muted)]">Diperbarui otomatis tiap 20 detik</p>
      </div>

      <p className="t-body mt-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3.5 py-3 font-semibold">
        Bukan produk BMKG dan bukan sumber peringatan dini. Dasbor ini merangkum data publik untuk
        membantu pemantauan; keputusan tetap mengacu pada lembaga yang berwenang.
      </p>

      <div className="mt-4 grid gap-5 @4xl:grid-cols-[1.6fr_1fr]">
        {/* Phone: one stacked entry per source. The table needs more width than a phone has. */}
        <ul className="divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)] @xl:hidden">
          {feeds.map((feed) => (
            <li key={feed.key} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="t-body font-semibold">
                  {feed.href ? (
                    <a
                      href={feed.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-[var(--accent)] hover:underline"
                    >
                      {feed.label}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    feed.label
                  )}
                </span>
                <span data-tone={STATE_TONE[feed.state]} className="tone-chip shrink-0">
                  <span className="status-dot" data-state={feed.state} aria-hidden="true" />
                  <span className="normal-case tracking-normal">{feedStateWord(feed.state)}</span>
                </span>
              </div>
              <p className="t-meta mt-1">
                {feed.role}
                {feed.note ? ` · ${feed.note}` : ''}
              </p>
              <p className="t-meta mt-0.5 text-[var(--text-muted)]">
                {STATE_NOTE[feed.state]}
                {feed.lastOkAt !== null && (
                  <>
                    {' '}
                    Terakhir berhasil <EventAge at={feed.lastOkAt} />.
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto @xl:block">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">Status tiap sumber data</caption>
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="t-micro py-2 pr-3">Sumber</th>
                <th scope="col" className="t-micro py-2 pr-3">Dipakai untuk</th>
                <th scope="col" className="t-micro py-2 pr-3">Status</th>
                <th scope="col" className="t-micro py-2">Terakhir berhasil</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr key={feed.key} className="border-b border-[var(--border-hairline)] align-top last:border-b-0">
                  <th scope="row" className="t-body py-2.5 pr-3 font-semibold">
                    {feed.href ? (
                      <a
                        href={feed.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-[var(--accent)] hover:underline"
                      >
                        {feed.label}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      feed.label
                    )}
                  </th>
                  <td className="t-meta py-2.5 pr-3">
                    {feed.role}
                    {feed.note ? <span className="block text-[var(--text-muted)]">{feed.note}</span> : null}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span data-tone={STATE_TONE[feed.state]} className="tone-chip" title={STATE_NOTE[feed.state]}>
                      <span className="status-dot" data-state={feed.state} aria-hidden="true" />
                      <span className="normal-case tracking-normal">{feedStateWord(feed.state)}</span>
                    </span>
                    <span className="t-meta mt-1 block text-[var(--text-muted)]">{STATE_NOTE[feed.state]}</span>
                  </td>
                  <td className="t-data py-2.5 font-medium text-[var(--text-secondary)]">
                    {feed.lastOkAt !== null ? <EventAge at={feed.lastOkAt} /> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="t-micro mb-2">Rujukan resmi</h3>
          <ul className="space-y-2.5">
            {AUTHORITIES.map((item) => (
              <li key={item.what}>
                <p className="t-meta text-[var(--text-muted)]">{item.what}</p>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="t-body inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                  >
                    {item.who}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="t-body font-semibold">{item.who}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
