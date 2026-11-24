/**
 * The dashboard's own, illustrative reading of an eruption report.
 *
 * MAGMA's report gives two numbers — the seismograph's maximum amplitude and the signal's
 * duration. Everything here is arithmetic on those two: rough conversions and a templated
 * paragraph. None of it is PVMBG's analysis, and every surface that prints it says so.
 * A report that lacks either number gets no estimates at all; nothing is assumed in its place.
 */

import { formatDecimal } from './time';
import type { VolcanoEruption } from './types';

export interface IllustrativeAnalysis {
  /** Maximum amplitude from the report, in millimetres. */
  amplitudeMm: number;
  /** Signal duration from the report, in seconds. */
  durationSec: number;
  /** "0,109 g" — amplitude scaled by a fixed factor; not a measured acceleration. */
  estimatedPga: string;
  /** Amplitude and duration folded into one number, in the style of an RSAM count. */
  rsamCounts: number;
  /** "1,4–2,2 Hz" — one of two fixed bands, picked by amplitude. */
  dominantFrequency: string;
  /** Signal class picked by amplitude thresholds. */
  signalType: string;
  /** Templated paragraph built from the two report values. */
  interpretation: string;
}

/** "34 mm" → 34, "55.54 detik" → 55.54; null for "—", an empty string or anything without a number. */
export function parseReportNumber(text: string | null | undefined): number | null {
  const match = /\d+(?:[.,]\d+)?/.exec(text || '');
  if (!match) return null;
  const value = parseFloat(match[0].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const STRONG_MM = 40;
const MODERATE_MM = 20;

/** The illustrative estimates for a report, or null when it states no amplitude or no duration. */
export function deriveIllustrativeAnalysis(
  report: Pick<VolcanoEruption, 'amplitude' | 'duration' | 'volcano_name'>
): IllustrativeAnalysis | null {
  const amplitudeMm = parseReportNumber(report.amplitude);
  const durationSec = parseReportNumber(report.duration);
  if (amplitudeMm === null || durationSec === null) return null;

  const dominantFrequency = amplitudeMm >= STRONG_MM ? '1,4–2,2 Hz' : '2,0–3,5 Hz';
  const signalType =
    amplitudeMm >= STRONG_MM
      ? 'Gempa letusan kuat (tremor eksplosif berenergi tinggi)'
      : amplitudeMm >= MODERATE_MM
        ? 'Gempa letusan sedang (tremor letusan)'
        : 'Gempa hembusan / vulkanik dangkal (VB)';
  const amplitudeText = `${formatDecimal(amplitudeMm, Number.isInteger(amplitudeMm) ? 0 : 1)} mm`;
  const durationText = `${formatDecimal(durationSec, Number.isInteger(durationSec) ? 0 : 1)} detik`;

  return {
    amplitudeMm,
    durationSec,
    estimatedPga: `${formatDecimal(amplitudeMm * 0.0032, 3)} g`,
    rsamCounts: Math.round(amplitudeMm * 115 + durationSec * 12),
    dominantFrequency,
    signalType,
    interpretation:
      amplitudeMm >= STRONG_MM
        ? `Defleksi seismograf sebesar ${amplitudeText} dengan durasi ${durationText} lazimnya dikaitkan dengan pelepasan gas magmatik eksplosif bertekanan tinggi di konduit kawah G. ${report.volcano_name}. Sinyal semacam ini umumnya didominasi fase awal yang tajam, disusul tremor berspektrum rendah (${dominantFrequency}).`
        : `Amplitudo ${amplitudeText} dengan durasi ${durationText} lazimnya dikaitkan dengan pelepasan tekanan gas vulkanik dan getaran fluida hidrotermal dangkal. Teks ini tidak menilai ada atau tidaknya deformasi maupun bahaya lain — rujuk laporan PVMBG.`,
  };
}
