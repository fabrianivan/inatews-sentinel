'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, Camera, ChevronDown, ChevronRight, ExternalLink, Info, Microscope, Mountain, X } from 'lucide-react';
import ImageViewer, { type ViewedImage } from './ImageViewer';
import VolcanoAnalysisSection from './VolcanoAnalysisSection';
import { CatalogueLevelChip } from './VolcanoChip';
import { useNow } from '@/hooks/useNow';
import type { FeedHealthState } from '@/lib/feeds';
import { formatClockStamp } from '@/lib/time';
import {
  VOLCANO_ORIGIN_LABEL,
  buildVolcanoInspectionReport,
  findVolcanoLocation,
  getVolcanoReports,
  placeholderRecordNotice,
  volcanoRecordOrigin,
} from '@/lib/volcanoData';
import type { VolcanoMediaResponse, VolcanoMediaState } from '@/lib/volcanoMedia';
import type { VolcanoEruption } from '@/lib/types';

interface VolcanoDetailCardProps {
  /** Catalogue name of the volcano to show. Give the card a `key` of the same name so its media reloads with it. */
  volcanoName: string;
  /** The loaded eruption reports (MAGMA, or the built-in placeholders). */
  volcanoes: VolcanoEruption[];
  /** State of the MAGMA eruption list, so an absent report is worded for what is actually known. */
  listState: FeedHealthState;
  /** A request to open the analysis: a number that changes with every request, 0 for none. */
  analysisRequest?: number;
  /** Called once the requested analysis has been opened and has settled in view. */
  onAnalysisHandled?: () => void;
  /** Shown as a close button when the card is a sheet over the map. */
  onClose?: () => void;
}

/** Cameras and earlier reports shown before the card asks to be expanded: it sits on the map and should stay short. */
const CAMERAS_SHOWN = 2;
const EARLIER_SHOWN = 3;

/** How often an open card asks for MAGMA's media again; the server keeps its copy for five minutes. */
const MEDIA_REFRESH_MS = 5 * 60 * 1000;
/** MAGMA's seismogram page takes ten seconds or more to arrive; meanwhile the card asks again this often. */
const MEDIA_RETRY_MS = 5000;
const MEDIA_MAX_RETRIES = 10;
/** Media older than this is no longer called live. */
const MEDIA_STALE_MS = 15 * 60 * 1000;

interface MediaStatus {
  media: VolcanoMediaResponse | null;
  /** The last request to the dashboard's own route failed. */
  failed: boolean;
}

/** PVMBG's live seismogram and camera frames for one volcano, from the dashboard's own route. */
function useVolcanoMedia(volcano: string): MediaStatus {
  const [status, setStatus] = useState<MediaStatus>({ media: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const load = async () => {
      try {
        const response = await fetch(`/api/realtime/volcano-media?volcano=${encodeURIComponent(volcano)}`);
        if (!response.ok) throw new Error(`volcano media -> ${response.status}`);
        const media = (await response.json()) as VolcanoMediaResponse;
        if (cancelled) return;
        setStatus({ media, failed: false });
        const stillLoading = media.seismogram_state === 'loading' || media.cameras_state === 'loading';
        retries = stillLoading ? retries + 1 : 0;
        timer = setTimeout(load, stillLoading && retries <= MEDIA_MAX_RETRIES ? MEDIA_RETRY_MS : MEDIA_REFRESH_MS);
      } catch {
        if (cancelled) return;
        setStatus((previous) => ({ media: previous.media, failed: true }));
        timer = setTimeout(load, 30_000);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [volcano]);

  return status;
}

/** Why a piece of MAGMA media is not on screen, in the card's words. */
function mediaAbsence(state: VolcanoMediaState | 'route-failed' | 'starting', what: string): string {
  switch (state) {
    case 'starting':
    case 'loading':
      return `Memuat ${what} dari MAGMA… halamannya besar, bisa sampai 15 detik.`;
    case 'unlisted':
      return `MAGMA tidak mencantumkan ${what} untuk gunung ini.`;
    default:
      return `${what.charAt(0).toUpperCase()}${what.slice(1)} dari MAGMA sedang tidak terjangkau.`;
  }
}

/** What is known when the loaded list holds no report for this volcano — from the state of the whole list. */
function absentReportText(name: string, listState: FeedHealthState, volcanoes: VolcanoEruption[]): string {
  const listEmpty = volcanoes.length === 0;
  const allSeeded = !listEmpty && volcanoes.every((item) => item.source === 'SEEDED');
  if (listState === 'seed' || allSeeded) {
    return 'MAGMA Indonesia tidak terjangkau, jadi daftar laporan erupsi belum termuat. Periksa MAGMA Indonesia langsung.';
  }
  if (listEmpty && listState === 'loading') return 'Memuat daftar laporan erupsi dari MAGMA…';
  if (listEmpty) return 'Daftar laporan erupsi MAGMA tidak dapat dimuat. Periksa MAGMA Indonesia langsung.';
  if (listState === 'failed' || listState === 'stale') {
    return `Pembaruan daftar laporan dari MAGMA gagal; pada daftar terakhir yang termuat tidak ada laporan G. ${name}.`;
  }
  return `Tidak ada laporan erupsi G. ${name} pada daftar laporan terbaru dari MAGMA. Periksa MAGMA Indonesia untuk laporan yang lebih lama.`;
}

function SectionHeading({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
      <h4 className="t-micro flex items-center gap-1.5">{children}</h4>
      {note && <span className="t-meta text-[var(--text-muted)]">{note}</span>}
    </div>
  );
}

/**
 * Everything the dashboard has on one volcano, in one panel on the map: the picture (the
 * photo MAGMA attached to the report, or the latest frames of PVMBG's cameras), the report in
 * MAGMA's own words, PVMBG's live seismogram for its station, the dashboard's illustrative
 * analysis, and the other loaded reports. Every image carries MAGMA's label and says what it
 * is; a volcano with no report says so, and no example value is shown.
 */
export default function VolcanoDetailCard({
  volcanoName,
  volcanoes,
  listState,
  analysisRequest = 0,
  onAnalysisHandled,
  onClose,
}: VolcanoDetailCardProps) {
  const geo = findVolcanoLocation(volcanoName);
  const { media, failed: mediaRouteFailed } = useVolcanoMedia(geo?.name ?? volcanoName);
  const now = useNow(60_000);
  const [showAllCameras, setShowAllCameras] = useState(false);
  const [showAllEarlier, setShowAllEarlier] = useState(false);
  const [viewed, setViewed] = useState<ViewedImage | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);
  const onAnalysisHandledRef = useRef(onAnalysisHandled);
  useEffect(() => {
    onAnalysisHandledRef.current = onAnalysisHandled;
  });

  // "Analisis PVMBG" pressed elsewhere (a chip, the strip) opens this section. Adjusted
  // during render when the request changes, as React recommends for state that follows a prop.
  const [analysisOpen, setAnalysisOpen] = useState(analysisRequest > 0);
  const [seenRequest, setSeenRequest] = useState(analysisRequest);
  if (analysisRequest !== seenRequest) {
    setSeenRequest(analysisRequest);
    if (analysisRequest > 0) setAnalysisOpen(true);
  }

  // …and brings it into view inside the panel's own scroll area, without moving the page.
  // Pictures and MAGMA media keep arriving for a moment after the panel opens and change its
  // height, so the section is kept aligned while that settles — until the reader scrolls.
  useEffect(() => {
    if (!analysisRequest) return;
    const section = analysisRef.current;
    const scroller = section?.closest<HTMLElement>('[data-panel-scroll]');
    const card = section?.parentElement;
    if (!section || !scroller || !card) return;

    let readerMoved = false;
    const align = () => {
      if (readerMoved) return;
      const top = scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
      // Instant: a smooth scroll is cancelled part-way by the scroll anchoring that loading images cause.
      if (Math.abs(top - scroller.scrollTop) > 1) scroller.scrollTo({ top });
    };
    const stopFollowing = () => {
      readerMoved = true;
      onAnalysisHandledRef.current?.();
    };
    const frame = requestAnimationFrame(align);
    const observer = new ResizeObserver(align);
    observer.observe(card);
    const settle = setTimeout(() => {
      observer.disconnect();
      onAnalysisHandledRef.current?.();
    }, 4000);
    scroller.addEventListener('wheel', stopFollowing, { passive: true });
    scroller.addEventListener('touchstart', stopFollowing, { passive: true });
    scroller.addEventListener('keydown', stopFollowing);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clearTimeout(settle);
      scroller.removeEventListener('wheel', stopFollowing);
      scroller.removeEventListener('touchstart', stopFollowing);
      scroller.removeEventListener('keydown', stopFollowing);
    };
  }, [analysisRequest]);

  if (!geo) return null;

  const record = buildVolcanoInspectionReport(geo, volcanoes);
  const origin = volcanoRecordOrigin(record);
  const hasReport = placeholderRecordNotice(record) === null;
  const stamp = (item: VolcanoEruption) => [item.time, item.date].filter(Boolean).join(' · ');

  // A report filed while an eruption is still going on, or one whose plume was not seen,
  // has no photo; the newest report that has one is shown instead, under its own time.
  const reports = getVolcanoReports(geo, volcanoes).filter((item) => item.source !== 'SEEDED');
  const pictured = record.image_url ? record : (reports.find((item) => item.image_url) ?? null);
  const earlier = reports.filter((item) => item.id !== record.id);
  const earlierShown = showAllEarlier ? earlier : earlier.slice(0, EARLIER_SHOWN);

  const absenceState = (state: VolcanoMediaState | undefined) =>
    mediaRouteFailed && !media ? 'route-failed' : (state ?? 'starting');
  const allCameras = media?.cameras ?? [];
  const cameras = showAllCameras ? allCameras : allCameras.slice(0, CAMERAS_SHOWN);
  const hiddenCameras = allCameras.length - cameras.length;
  const seismogram = media?.seismogram ?? null;

  // Media the card could not refresh, or that is old, is not presented as live.
  const isStale = (fetchedAt: string) =>
    mediaRouteFailed || (now !== null && now - (Date.parse(fetchedAt) || 0) > MEDIA_STALE_MS);
  const staleNote = (fetchedAt: string) =>
    `Tidak dapat diperbarui dari MAGMA — dibaca ${formatClockStamp(fetchedAt, now)}.`;
  const seismogramStale = seismogram ? isStale(seismogram.fetched_at) : false;
  const camerasStale = cameras.length > 0 ? isStale(cameras[0].fetched_at) : false;

  return (
    <section aria-label={`G. ${geo.name}: gambar, laporan erupsi, seismogram dan analisis`} className="glass-hud rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-micro flex items-center gap-1.5">
            <Mountain className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
            Gunung api
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="t-heading-lg">G. {geo.name}</h3>
            <CatalogueLevelChip levelText={geo.defaultLevel} />
          </div>
          <p className="t-meta mt-1">
            {geo.province} · {geo.elevation.toLocaleString('id-ID')} mdpl · {geo.pgaStation}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Tutup panel gunung" title="Tutup" className="icon-btn shrink-0">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* The picture: the report's own photo first, PVMBG's cameras otherwise */}
      <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
        <SectionHeading>Gambar</SectionHeading>
        {pictured?.image_url && (
          <figure className="m-0 mt-2">
            <button
              type="button"
              onClick={() =>
                setViewed({
                  src: pictured.image_url!,
                  alt: `Citra laporan erupsi G. ${geo.name}, ${stamp(pictured)}`,
                  caption: 'Dilampirkan MAGMA pada laporan erupsi — foto visual atau rekaman seismograf.',
                  href: pictured.detail_url,
                })
              }
              title="Perbesar"
              className="block w-full overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pictured.image_url}
                alt={`Citra laporan erupsi G. ${geo.name}, ${stamp(pictured)}`}
                className="h-[200px] w-full object-contain"
                loading="lazy"
              />
            </button>
            <figcaption className="t-meta mt-1 text-[var(--text-muted)]">
              {pictured === record
                ? `Dilampirkan MAGMA pada laporan ${stamp(pictured)} — foto visual atau rekaman seismograf.`
                : `Dari laporan ${stamp(pictured)}; laporan terakhir tidak dilampiri citra.`}
            </figcaption>
          </figure>
        )}

        {cameras.length > 0 ? (
          <div className="mt-2">
            <p className="t-meta flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
              <Camera className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
              Kamera PVMBG — tangkapan terakhir
            </p>
            <ul className={`mt-1.5 grid gap-2 ${cameras.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {cameras.map((camera) => (
                <li key={camera.label}>
                  <figure className="m-0">
                    <button
                      type="button"
                      onClick={() =>
                        setViewed({
                          src: camera.image,
                          alt: `Kamera PVMBG ${camera.label}`,
                          caption: `Pratinjau kecil dari MAGMA, dibaca ${formatClockStamp(camera.fetched_at, now)} — bukan foto laporan erupsi.`,
                        })
                      }
                      title="Perbesar"
                      className="block w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={camera.image}
                        alt={`Kamera PVMBG ${camera.label}`}
                        className="aspect-[16/10] w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] object-cover"
                      />
                    </button>
                    <figcaption className="t-meta mt-0.5 truncate text-[var(--text-muted)]" title={camera.label}>
                      {camera.camera}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
            <p className="t-meta mt-1 text-[var(--text-muted)]">
              {camerasStale
                ? staleNote(cameras[0].fetched_at)
                : `Pratinjau kecil dari MAGMA, dibaca ${formatClockStamp(cameras[0].fetched_at, now)} — bukan foto laporan erupsi.`}{' '}
              {hiddenCameras > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllCameras(true)}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  Tampilkan {hiddenCameras} kamera lain
                </button>
              )}
            </p>
          </div>
        ) : (
          !pictured?.image_url && (
            <p className="t-meta mt-2 text-[var(--text-muted)]">
              {hasReport ? 'MAGMA tidak melampirkan citra pada laporan yang termuat. ' : ''}
              {mediaAbsence(absenceState(media?.cameras_state), 'kamera PVMBG')}
            </p>
          )
        )}
      </div>

      {/* The report, in MAGMA's own words */}
      <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
        <SectionHeading note={hasReport ? VOLCANO_ORIGIN_LABEL[origin] : undefined}>Laporan erupsi terakhir</SectionHeading>
        {hasReport ? (
          <>
            <p className="t-data mt-2 text-[var(--text-primary)]">{stamp(record)}</p>
            <p className="t-body mt-1 text-[var(--text-secondary)]">{record.description}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {[
                { label: 'Amplitudo maks', value: record.amplitude },
                { label: 'Durasi', value: record.duration },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2.5 py-1.5"
                >
                  <dt className="t-micro">{item.label}</dt>
                  <dd className="t-data text-[var(--text-primary)]">{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="t-meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--text-muted)]">
              <span>Pembuat laporan: {record.author}</span>
              {record.detail_url && (
                <a
                  href={record.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                >
                  Buka di MAGMA
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </p>
          </>
        ) : (
          <p className="t-meta mt-2 flex items-start gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span>{absentReportText(geo.name, listState, volcanoes)}</span>
          </p>
        )}
      </div>

      {/* PVMBG's own seismogram for the volcano's station — a recording, not an illustration */}
      <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
        <SectionHeading note="MAGMA PVMBG">
          <Activity className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
          {seismogramStale ? 'Seismogram (tidak diperbarui)' : 'Seismogram langsung'}
        </SectionHeading>
        {seismogram ? (
          <figure className="m-0 mt-2">
            <button
              type="button"
              onClick={() =>
                setViewed({
                  src: seismogram.image,
                  alt: `Seismogram PVMBG, ${seismogram.label}`,
                  caption: `Rekaman stasiun ${seismogram.label}, dibaca dari MAGMA ${formatClockStamp(seismogram.fetched_at, now)}.`,
                })
              }
              title="Perbesar"
              className="block w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={seismogram.image}
                alt={`Seismogram PVMBG, ${seismogram.label}`}
                className="aspect-[5/3] w-full rounded-xl border border-[var(--border-strong)] bg-white object-contain"
              />
            </button>
            <figcaption className="t-meta mt-1 text-[var(--text-muted)]">
              <span className="t-data text-[var(--text-secondary)]">{seismogram.label}</span> ·{' '}
              {seismogramStale ? staleNote(seismogram.fetched_at) : `dibaca dari MAGMA ${formatClockStamp(seismogram.fetched_at, now)}`}
            </figcaption>
          </figure>
        ) : (
          <p
            className={`t-meta mt-2 text-[var(--text-muted)] ${
              (media?.seismogram_state ?? 'loading') === 'loading' && !mediaRouteFailed
                ? 'flex aspect-[5/3] w-full items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] px-4 text-center'
                : ''
            }`}
          >
            {mediaAbsence(absenceState(media?.seismogram_state), 'seismogram langsung')}
          </p>
        )}
      </div>

      {/* The dashboard's own analysis and illustration, in the same panel */}
      <div ref={analysisRef} className="mt-3 border-t border-[var(--border-hairline)] pt-3">
        <button
          type="button"
          onClick={() => setAnalysisOpen((open) => !open)}
          aria-expanded={analysisOpen}
          aria-controls={`volcano-analysis-${geo.name.replace(/\s+/g, '-')}`}
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 text-left text-[13px] font-bold text-[var(--accent)] hover:bg-[var(--surface-2)]"
        >
          <span className="inline-flex items-center gap-2">
            <Microscope className="h-4 w-4" aria-hidden="true" />
            Analisis PVMBG &amp; ilustrasi
          </span>
          {analysisOpen ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {analysisOpen && (
          <div id={`volcano-analysis-${geo.name.replace(/\s+/g, '-')}`} className="mt-3">
            <VolcanoAnalysisSection volcano={geo} reports={reports} />
          </div>
        )}
      </div>

      {earlier.length > 0 && (
        <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
          <SectionHeading note={`${earlier.length} laporan`}>Laporan sebelumnya</SectionHeading>
          <ul className="mt-1 divide-y divide-[var(--border-hairline)]">
            {earlierShown.map((item) => (
              <li key={item.id}>
                <details className="group py-1">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 hover:text-[var(--accent)]">
                    <span className="t-data inline-flex items-center gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                      {stamp(item)}
                    </span>
                    <span className="t-meta shrink-0 text-[var(--text-muted)]">
                      {item.amplitude !== '—' ? `Amp ${item.amplitude}` : item.image_url ? 'ada citra' : 'tanpa angka'}
                    </span>
                  </summary>
                  <div className="space-y-2 pb-2 pl-5 pt-1">
                    <p className="t-meta text-[var(--text-secondary)]">{item.description}</p>
                    {item.image_url && (
                      <button
                        type="button"
                        onClick={() =>
                          setViewed({
                            src: item.image_url!,
                            alt: `Citra laporan erupsi G. ${geo.name}, ${stamp(item)}`,
                            caption: 'Dilampirkan MAGMA pada laporan erupsi — foto visual atau rekaman seismograf.',
                            href: item.detail_url,
                          })
                        }
                        title="Perbesar"
                        className="block w-full overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt={`Citra laporan erupsi G. ${geo.name}, ${stamp(item)}`}
                          className="max-h-[140px] w-full object-contain"
                          loading="lazy"
                        />
                      </button>
                    )}
                    {item.detail_url && (
                      <a
                        href={item.detail_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="t-meta inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                      >
                        Buka di MAGMA
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {earlier.length > earlierShown.length && (
            <button
              type="button"
              onClick={() => setShowAllEarlier(true)}
              className="t-meta mt-1 font-semibold text-[var(--accent)] hover:underline"
            >
              Tampilkan semua ({earlier.length})
            </button>
          )}
        </div>
      )}

      <ImageViewer image={viewed} onClose={() => setViewed(null)} />
    </section>
  );
}
