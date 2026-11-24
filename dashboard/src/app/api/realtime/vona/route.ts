import { NextRequest, NextResponse } from 'next/server';
import { createUpstreamReader, type UpstreamOptions, type UpstreamRead } from '@/lib/telemetry';
import { findVolcanoLocation } from '@/lib/volcanoData';
import {
  VONA_ARCHIVE_URL,
  latestVonaFor,
  parseVonaPage,
  vonaArchiveUrl,
  vonaCodeFor,
  vonaReadState,
  type VonaFeedState,
  type VonaPage,
  type VonaResponse,
  type VonaVolcanoResult,
} from '@/lib/vona';

export const dynamic = 'force-dynamic';

const MAGMA_PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; INATEWS-Sentinel/1.0)',
  Accept: 'text/html,application/xhtml+xml',
};

/**
 * MAGMA's newest VONAs for every volcano: a small page (about 45 kB) that answers in well under a
 * second. Re-read every two minutes; the last good copy stands in for half an hour, marked stale.
 */
const LATEST_READ: UpstreamOptions = {
  timeoutMs: 8000,
  ttlSeconds: 120,
  staleIfErrorSeconds: 30 * 60,
  parse: 'text',
  headers: MAGMA_PAGE_HEADERS,
};

/**
 * One volcano's own VONA archive, read only when none of its notices is among the newest — its
 * latest notice is then older than everything on that page, so it is re-read less often.
 */
const ARCHIVE_READ: UpstreamOptions = {
  timeoutMs: 8000,
  ttlSeconds: 15 * 60,
  staleIfErrorSeconds: 2 * 60 * 60,
  parse: 'text',
  headers: MAGMA_PAGE_HEADERS,
};

// Its own memo: one entry for the newest page, one per volcano archive (keyed by URL, so by code).
const readUpstream = createUpstreamReader();

interface ReadPage {
  page: VonaPage | null;
  state: VonaFeedState;
  fetchedAt: string | null;
}

/** A read MAGMA page with its honest state. A page that yields neither notices nor MAGMA's volcano list has changed shape. */
function readVonaPage(read: UpstreamRead, options: UpstreamOptions): ReadPage {
  const parsed = typeof read.body === 'string' ? parseVonaPage(read.body) : null;
  const page = parsed && (parsed.notices.length > 0 || parsed.volcanoes.length > 0) ? parsed : null;
  const fetchedAt = page ? read.fetchedAt : null;
  return { page, state: vonaReadState(fetchedAt, Date.now(), options.ttlSeconds * 1000), fetchedAt };
}

/** One catalogue volcano's newest VONA: from the newest page when it is there, else from its own archive. */
async function volcanoResult(name: string, latest: ReadPage): Promise<VonaVolcanoResult> {
  const code = latest.page ? (vonaCodeFor(name, latest.page.volcanoes)?.code ?? null) : null;
  const base = { name, code, archive_url: code ? vonaArchiveUrl(code) : VONA_ARCHIVE_URL };
  const onLatestPage = latest.page ? latestVonaFor(name, latest.page.notices) : null;

  // Found among the newest, or nothing more to look in: the newest page could not be read, or
  // MAGMA's list gives this volcano no archive.
  if (onLatestPage || !latest.page || !code) {
    return {
      ...base,
      latest: onLatestPage,
      found_in: onLatestPage ? 'latest' : null,
      state: latest.state,
      fetched_at: latest.fetchedAt,
    };
  }

  const archive = readVonaPage(await readUpstream(vonaArchiveUrl(code), ARCHIVE_READ), ARCHIVE_READ);
  const fromArchive = archive.page ? latestVonaFor(name, archive.page.notices) : null;
  return {
    ...base,
    latest: fromArchive,
    found_in: fromArchive ? 'archive' : null,
    state: archive.state,
    fetched_at: archive.fetchedAt,
  };
}

/**
 * PVMBG's Volcano Observatory Notices for Aviation, read from MAGMA Indonesia's public archive.
 * With `?volcano=<catalogue name>` the answer also carries that volcano's newest notice. Only
 * catalogue volcanoes are answered, so the query never reaches MAGMA as typed.
 */
export async function GET(req: NextRequest) {
  const asked = (req.nextUrl.searchParams.get('volcano') ?? '').trim();
  const volcano = asked.length >= 3 ? findVolcanoLocation(asked) : null;
  if (asked && !volcano) {
    return NextResponse.json({ error: 'unknown volcano' }, { status: 404 });
  }

  const latest = readVonaPage(await readUpstream(VONA_ARCHIVE_URL, LATEST_READ), LATEST_READ);
  const response: VonaResponse = {
    source: VONA_ARCHIVE_URL,
    state: latest.state,
    fetched_at: latest.fetchedAt,
    notices: latest.page?.notices ?? [],
  };
  if (volcano) response.volcano = await volcanoResult(volcano.name, latest);
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
