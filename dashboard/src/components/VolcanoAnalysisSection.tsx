'use client';

import type { ReactNode } from 'react';
import { ArrowUp, ChevronRight, ExternalLink, Info } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { useVona } from '@/hooks/useVona';
import { formatAge, formatClockStamp, formatWibDateTime } from '@/lib/time';
import { deriveIllustrativeAnalysis, type IllustrativeAnalysis } from '@/lib/volcanoAnalysis';
import type { VolcanoLocation } from '@/lib/volcanoData';
import { VONA_ARCHIVE_URL, VONA_COLOR_ID, vonaMapArrow, type VonaNotice, type VonaResponse } from '@/lib/vona';
import type { VolcanoEruption } from '@/lib/types';

interface VolcanoAnalysisSectionProps {
  volcano: VolcanoLocation;
  /** Real MAGMA reports for this volcano in the loaded list, newest first. */
  reports: VolcanoEruption[];
}

const TRACKS = [16, 34, 52, 70, 88, 106, 124];
const PACKET_TRACK = 70;
const PACKET_START_X = 78;
const WIDTH = 340;

/** A quiet trace for one helicorder line: a fixed, gentle wiggle (deterministic, so it never flickers). */
function quietTrace(y: number, seed: number): string {
  const points: string[] = [];
  for (let x = 8; x <= WIDTH - 8; x += 6) {
    points.push(`${x},${(y + Math.sin(x * 0.21 + seed) * 1.1 + Math.sin(x * 0.07 + seed * 2) * 0.6).toFixed(1)}`);
  }
  return `M ${points.join(' L ')}`;
}

/**
 * The eruption packet: it rises to the reported amplitude within a few swings and decays
 * over a length proportional to the reported duration. Illustrative scale only.
 */
function packetTrace(analysis: IllustrativeAnalysis): { path: string; endX: number; peakX: number; height: number } {
  const height = Math.min(1, Math.max(0.15, analysis.amplitudeMm / 50)) * 30;
  const length = Math.min(1, Math.max(0.25, analysis.durationSec / 120)) * 230;
  const swings = 34;
  const points = [`8,${PACKET_TRACK}`, `${PACKET_START_X},${PACKET_TRACK}`];
  for (let i = 1; i <= swings; i++) {
    const x = PACKET_START_X + (i / swings) * length;
    const envelope = i <= 3 ? height * (i / 3) : height * Math.exp(-(i - 3) / (swings / 3.2));
    const y = PACKET_TRACK + (i % 2 === 0 ? envelope : -envelope);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const endX = PACKET_START_X + length;
  points.push(`${(endX + 4).toFixed(1)},${PACKET_TRACK}`, `${WIDTH - 8},${PACKET_TRACK}`);
  const peakX = PACKET_START_X + (3 / swings) * length;
  return { path: `M ${points.join(' L ')}`, endX, peakX, height };
}

function HelicorderIllustration({ analysis }: { analysis: IllustrativeAnalysis }) {
  const packet = packetTrace(analysis);
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} 140`}
        role="img"
        aria-label={`Ilustrasi helicorder: paket getaran setinggi ${analysis.amplitudeMm} mm dan sepanjang ${analysis.durationSec} detik, dari angka laporan`}
        className="block w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)]"
      >
        {TRACKS.filter((y) => y !== PACKET_TRACK).map((y, index) => (
          <path key={y} d={quietTrace(y, index)} fill="none" style={{ stroke: 'var(--text-muted)', strokeWidth: 0.8, opacity: 0.55 }} />
        ))}
        <path d={packet.path} fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 1.4 }} />
        {/* Annotations: where the packet starts, peaks and ends */}
        <line x1={PACKET_START_X} y1={6} x2={PACKET_START_X} y2={132} style={{ stroke: 'var(--text-muted)', strokeWidth: 0.8, strokeDasharray: '3 3' }} />
        <text x={PACKET_START_X + 3} y={11} style={{ fill: 'var(--text-secondary)', fontSize: 9, fontWeight: 600 }}>
          awal
        </text>
        <text x={packet.peakX + 4} y={PACKET_TRACK - packet.height - 3} style={{ fill: 'var(--accent)', fontSize: 9, fontWeight: 700 }}>
          A maks {analysis.amplitudeMm} mm
        </text>
        <line x1={packet.endX} y1={6} x2={packet.endX} y2={132} style={{ stroke: 'var(--text-muted)', strokeWidth: 0.8, strokeDasharray: '3 3' }} />
        <text x={Math.min(packet.endX + 3, WIDTH - 74)} y={137} style={{ fill: 'var(--text-secondary)', fontSize: 9, fontWeight: 600 }}>
          durasi {analysis.durationSec} dtk
        </text>
      </svg>
      <figcaption className="t-meta mt-1 text-[var(--text-muted)]">
        Ilustrasi — bukan rekaman. Tinggi paket mengikuti amplitudo laporan, panjangnya mengikuti durasi.
      </figcaption>
    </figure>
  );
}

function Estimate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 py-1.5">
      <dt className="t-micro">{label}</dt>
      <dd className="t-data text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function MagmaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

/** Why no VONA for the volcano is shown, worded for what is actually known. */
function absentVonaText(name: string, data: VonaResponse | null, routeFailed: boolean): string {
  if (!data) return routeFailed ? 'VONA dari MAGMA sedang tidak terjangkau.' : 'Memuat VONA dari MAGMA…';
  const result = data.volcano;
  if (data.state === 'error' || !result) return 'Daftar VONA MAGMA sedang tidak dapat dimuat.';
  if (!result.code) return `MAGMA tidak mencantumkan arsip VONA untuk G. ${name}.`;
  if (result.state === 'error') {
    return `G. ${name} tidak ada di antara VONA terbaru MAGMA, dan arsip VONA gunung ini gagal dimuat.`;
  }
  return `Tidak ada VONA untuk G. ${name} di arsip MAGMA yang termuat.`;
}

/** What the notice says about the ash cloud, in one line: its words, never a value it does not state. */
function VonaHeadline({ notice }: { notice: VonaNotice }) {
  const direction = notice.ash_direction;
  if (notice.ash_observed === true && direction?.label) {
    return (
      <p className="t-body mt-1.5 flex items-center gap-2 font-semibold">
        {/* One arrow per compass point the notice names; 0° is north */}
        <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          {direction.bearings.map((bearing, index) => (
            <ArrowUp
              key={`${bearing}-${index}`}
              className="h-4 w-4 text-[var(--accent)]"
              style={{ transform: `rotate(${bearing}deg)` }}
            />
          ))}
        </span>
        Bergerak ke {direction.label}
      </p>
    );
  }
  const text =
    notice.ash_observed === false
      ? 'Abu tidak teramati'
      : notice.ash_observed === true
        ? direction
          ? `Kolom abu teramati — arah ditulis “${direction.phrase}”`
          : 'Kolom abu teramati — arahnya tidak disebut'
        : 'VONA tidak tegas soal kolom abu — baca teksnya';
  return <p className="t-body mt-1.5 font-semibold">{text}</p>;
}

/**
 * The newest VONA PVMBG issued for the volcano, read from MAGMA: its colour code, issue time,
 * ash-cloud height and direction as the notice states them, and the notice itself, verbatim.
 */
function VonaAshBlock({ volcano }: { volcano: VolcanoLocation }) {
  const { data, failed } = useVona(volcano.name);
  const now = useNow(60_000);
  const result = data?.volcano ?? null;
  const notice = result?.latest ?? null;
  const archiveUrl = result?.archive_url ?? VONA_ARCHIVE_URL;
  const outdated = failed || result?.state === 'stale';
  const heights = notice
    ? [
        notice.ash_top_asl_m !== null ? `${notice.ash_top_asl_m.toLocaleString('id-ID')} m dpl` : null,
        notice.ash_top_above_summit_m !== null
          ? `${notice.ash_top_above_summit_m.toLocaleString('id-ID')} m di atas puncak`
          : null,
      ].filter((value): value is string => value !== null)
    : [];
  const drawn = notice && now !== null ? vonaMapArrow(notice, now) !== null : false;
  const hasDirection = notice?.ash_observed === true && (notice.ash_direction?.bearings.length ?? 0) > 0;

  return (
    <section
      aria-label={`VONA terbaru G. ${volcano.name}`}
      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="t-micro">Arah abu · VONA</h5>
        <span className="t-meta text-[var(--text-muted)]">MAGMA PVMBG</span>
      </div>

      {notice ? (
        <>
          <VonaHeadline notice={notice} />
          <dl className="t-meta mt-1.5 space-y-0.5">
            <div>
              <dt className="inline text-[var(--text-muted)]">Diterbitkan: </dt>
              <dd className="inline">
                {formatWibDateTime(notice.issued_at)}
                {now !== null && notice.issued_at ? ` · ${formatAge(notice.issued_at, now)}` : ''}
              </dd>
            </div>
            {notice.color_code && (
              <div>
                <dt className="inline text-[var(--text-muted)]">Kode warna penerbangan: </dt>
                <dd className="inline">
                  “{notice.color_code}” ({VONA_COLOR_ID[notice.color_code]})
                </dd>
              </div>
            )}
            {heights.length > 0 && (
              <div>
                <dt className="inline text-[var(--text-muted)]">Puncak awan abu: </dt>
                <dd className="inline">sekitar {heights.join(' · ')}</dd>
              </div>
            )}
            {notice.volcano.toLowerCase() !== volcano.name.toLowerCase() && (
              <div>
                <dt className="inline text-[var(--text-muted)]">Ditulis untuk: </dt>
                <dd className="inline">G. {notice.volcano}</dd>
              </div>
            )}
          </dl>
          <details className="group mt-1.5">
            <summary className="t-meta inline-flex min-h-7 cursor-pointer list-none items-center gap-1 font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
              Teks VONA
            </summary>
            <blockquote lang="en" className="t-meta mt-1 border-l-2 border-[var(--border-strong)] pl-2.5 text-[var(--text-secondary)]">
              {notice.text || 'MAGMA tidak menampilkan teks untuk VONA ini.'}
            </blockquote>
          </details>
          <p className="t-meta mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--text-muted)]">
            {notice.observatory && <span>{notice.observatory}</span>}
            {notice.url && <MagmaLink href={notice.url}>Buka VONA di MAGMA</MagmaLink>}
          </p>
          {(drawn || hasDirection) && (
            <p className="t-meta mt-1 text-[var(--text-muted)]">
              {drawn
                ? 'Arahnya ditunjukkan di peta — hanya arah, VONA tidak menyebut jarak.'
                : 'Tidak digambar di peta: VONA ini terbit lebih dari 6 jam lalu.'}
            </p>
          )}
        </>
      ) : (
        <p className="t-meta mt-1.5 text-[var(--text-muted)]">
          {absentVonaText(volcano.name, data, failed)}{' '}
          {data && (
            <MagmaLink href={archiveUrl}>
              {result?.code ? `Arsip VONA G. ${volcano.name}` : 'Arsip VONA MAGMA'}
            </MagmaLink>
          )}
        </p>
      )}

      {outdated && result?.fetched_at && (
        <p className="t-meta mt-1 text-[var(--text-muted)]">
          Tidak dapat diperbarui dari MAGMA — dibaca {formatClockStamp(result.fetched_at, now)}.
        </p>
      )}
      <p className="t-meta mt-1 text-[var(--text-muted)]">
        VONA ditujukan untuk penerbangan. Rekomendasi dan radius bahaya resmi hanya ada di MAGMA Indonesia.
      </p>
    </section>
  );
}

/**
 * The dashboard's own reading of a volcano's latest report, with its illustration, all in
 * the volcano panel: a helicorder drawn from the report's two numbers, the arithmetic on
 * them and a templated interpretation — none of it PVMBG's analysis nor a recording, and each
 * part says so — followed by PVMBG's own newest VONA for the volcano, quoted as issued.
 */
export default function VolcanoAnalysisSection({ volcano, reports }: VolcanoAnalysisSectionProps) {
  // The newest report that states both numbers: a report filed while an eruption is still
  // going on often has neither yet.
  const source = reports.find((report) => deriveIllustrativeAnalysis(report) !== null) ?? null;
  const analysis = source ? deriveIllustrativeAnalysis(source) : null;
  const stamp = (report: VolcanoEruption) => [report.time, report.date].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <p className="t-meta flex items-start gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <span>Hitungan dan gambar dasbor dari angka laporan MAGMA — bukan analisis PVMBG dan bukan rekaman.</span>
      </p>

      {source && analysis ? (
        <>
          <p className="t-meta">
            Dari laporan <span className="t-data text-[var(--text-primary)]">{stamp(source)}</span>
            {source !== reports[0] ? ' (laporan terakhir belum mencantumkan amplitudo dan durasi)' : ''}
          </p>
          <HelicorderIllustration analysis={analysis} />
          <dl className="grid grid-cols-2 gap-2">
            <Estimate label="Estimasi PGA" value={analysis.estimatedPga} />
            <Estimate label="Frekuensi dominan" value={analysis.dominantFrequency} />
            <Estimate label="Indeks gaya RSAM" value={`${analysis.rsamCounts.toLocaleString('id-ID')} count`} />
            <Estimate label="Klasifikasi sinyal" value={analysis.signalType} />
          </dl>
          <p className="t-body text-[var(--text-secondary)]">{analysis.interpretation}</p>
        </>
      ) : (
        <p className="t-meta text-[var(--text-muted)]">
          {reports.length > 0
            ? 'Laporan yang termuat tidak mencantumkan amplitudo dan durasi, jadi tidak ada yang bisa dihitung atau diilustrasikan.'
            : 'Tidak ada laporan yang termuat untuk dihitung atau diilustrasikan.'}
        </p>
      )}

      <VonaAshBlock volcano={volcano} />
    </div>
  );
}
