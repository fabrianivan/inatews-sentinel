'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ZoomIn, ZoomOut, X } from 'lucide-react';

export interface ViewedImage {
  src: string;
  alt: string;
  /** What the image is and where it comes from, shown under it. */
  caption: string;
  /** A page where the original can be seen, e.g. the MAGMA report. */
  href?: string;
}

interface ImageViewerProps {
  image: ViewedImage | null;
  onClose: () => void;
}

/**
 * Shows one image as large as the window allows, above everything else. It is rendered
 * into <body>: the panels it opens from use backdrop-filter, which would otherwise make
 * them the containing block of a fixed-position overlay.
 */
export default function ImageViewer({ image, onClose }: ImageViewerProps) {
  if (!image || typeof document === 'undefined') return null;
  // Keyed by the image, so zoom and focus start over for each one.
  return createPortal(<ViewerDialog key={image.src} image={image} onClose={onClose} />, document.body);
}

function ViewerDialog({ image, onClose }: { image: ViewedImage; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus moves into the dialog and comes back to whatever opened it; Escape closes it and
  // Tab stays inside it.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={image.alt}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-3.5 py-2">
          <p className="t-meta min-w-0 truncate font-semibold text-[var(--text-primary)]" title={image.alt}>
            {image.alt}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoomed((value) => !value)}
              aria-pressed={zoomed}
              aria-label={zoomed ? 'Pas ke layar' : 'Perbesar 2×'}
              title={zoomed ? 'Pas ke layar' : 'Perbesar 2×'}
              className="icon-btn"
            >
              {zoomed ? <ZoomOut className="h-4 w-4" aria-hidden="true" /> : <ZoomIn className="h-4 w-4" aria-hidden="true" />}
            </button>
            {image.href && (
              <a
                href={image.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buka sumber di tab baru"
                title="Buka sumber di tab baru"
                className="icon-btn"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup" title="Tutup" className="icon-btn">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            className={zoomed ? 'block w-[200%] max-w-none' : 'mx-auto block max-h-[78vh] w-full object-contain'}
          />
        </div>
        <p className="t-meta border-t border-[var(--border-hairline)] px-3.5 py-2 text-[var(--text-muted)]">{image.caption}</p>
      </div>
    </div>
  );
}
