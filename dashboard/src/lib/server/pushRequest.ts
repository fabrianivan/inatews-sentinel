/** Shared handling of the small JSON bodies the push routes accept. */

import { NextResponse } from 'next/server';

/** No push request needs more than this; anything larger is refused before it is parsed. */
const MAX_BODY_BYTES = 4096;

export async function readJsonBody(request: Request): Promise<{ value: unknown } | { error: NextResponse }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return { error: NextResponse.json({ error: 'too-large' }, { status: 413 }) };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { error: NextResponse.json({ error: 'too-large' }, { status: 413 }) };
  }
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { error: NextResponse.json({ error: 'invalid-json' }, { status: 400 }) };
  }
}

export function noStore<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } });
}
