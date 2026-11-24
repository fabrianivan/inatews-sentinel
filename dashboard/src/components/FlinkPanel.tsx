'use client';

import { ArrowRight, Cpu, Database, GitBranch, Info, Sparkles, Workflow } from 'lucide-react';
import { formatDecimal } from '@/lib/time';
import type { ActivityIndex, SystemStatus } from '@/lib/types';

interface FlinkPanelProps {
  activityIndex: ActivityIndex | null;
  status: SystemStatus | null;
  /** True while a drill is running: the activity index shown is then a scenario value. */
  isSimulasi?: boolean;
}

const SOURCE_TOPICS = [
  { name: 'gempa.seismic', sub: 'Gempa BMKG & USGS' },
  { name: 'gempa.stations', sub: 'Seismometer broadband' },
  { name: 'gempa.tsunami', sub: 'Buoy InaTEWS & IOC' },
  { name: 'gempa.satellite', sub: 'Deformasi InSAR' },
  { name: 'gempa.weather', sub: 'Open-Meteo maritim' },
];

const FLINK_JOBS = [
  {
    tag: 'JOB #1',
    name: 'TUMBLE Window (1 Menit)',
    sub: 'Agregasi indeks aktivitas (heuristik): Mag + PGA + Slip + Laut',
  },
  {
    tag: 'JOB #2',
    name: 'Join Multi-Indikator (2 Menit)',
    sub: 'Mesin Korelasi Peringatan (Ambang >= 2 & >= 3 Sensor)',
  },
  {
    tag: 'JOB #3',
    name: 'Anomali Tsunami (30 Detik)',
    sub: 'Deteksi Lonjakan Gelombang InaTEWS & Proyeksi Run-up',
  },
];

/** Static showcase figures: nothing in the standalone path measures them. */
const ILLUSTRATIVE_FIGURES = [
  { label: 'Compute Pool', value: 'cpool-gempa-prod' },
  { label: 'Throughput', value: '1.480 msg/s' },
  { label: 'Watermark Lag', value: '< 140 ms' },
  { label: 'Checkpoints', value: '100%' },
];

const STAGE_LABEL = 'inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider uppercase';
const NODE_TAG = 'font-mono text-[11px] font-bold';
const NODE_SUB = 'text-[11px] text-[var(--text-secondary)]';

function StageArrow() {
  return (
    <div className="hidden items-center justify-center text-[var(--text-muted)] @4xl:flex">
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </div>
  );
}

export default function FlinkPanel({ activityIndex, status, isSimulasi = false }: FlinkPanelProps) {
  const activity = activityIndex?.overall_percentage ?? status?.seismic_intensity;
  const activityText =
    typeof activity === 'number' && Number.isFinite(activity)
      ? `${formatDecimal(activity)} / 100${isSimulasi ? ' · nilai latihan' : ''}`
      : 'tidak tersedia';

  const sinks = [
    { name: 'gempa.intensity_index', sub: `Indeks aktivitas (heuristik): ${activityText}` },
    { name: 'gempa.correlated_alerts', sub: 'Peringatan Dini Multi-Lembaga' },
    { name: 'gempa.tsunami_scenarios', sub: 'Tinggi Gelombang & ETA Pantai' },
  ];

  return (
    <div className="@container flex flex-col gap-4">
      {/* Header Banner */}
      <div className="matte-card p-5">
        <p
          role="note"
          className="t-body mb-4 flex items-start gap-2 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3 py-2 font-semibold"
        >
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <span>Arsitektur referensi — angka ilustratif kecuali backend Kafka/Flink tersambung</span>
        </p>

        <div className="flex flex-col justify-between gap-4 @4xl:flex-row @4xl:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]">
              <Workflow aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Mesin Pemrosesan Stream Apache Flink CEP
                </h2>
                <span className="rounded border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent)]">
                  CONFLUENT FLINK v1.20
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Rancangan stateful stream processing: tumbling event-time window, korelasi multi-sensor, dan evaluasi telemetri kegempaan Indonesia.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2.5 @xl:grid-cols-4">
            {ILLUSTRATIVE_FIGURES.map((figure) => (
              <div
                key={figure.label}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2"
              >
                <dt className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">{figure.label}</dt>
                <dd className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">
                  {figure.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* 4-Stage Pipeline DAG Topology */}
      <div className="matte-card p-5">
        <div className="mb-3 border-b border-[var(--border-hairline)] pb-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <GitBranch aria-hidden="true" className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Topologi Pipeline DAG (Confluent Cloud → Apache Flink → AI Hub)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 @4xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          {/* Stage 1: Kafka Sources */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className={`${STAGE_LABEL} text-[var(--text-muted)]`}>
              <Database aria-hidden="true" className="h-3 w-3" /> 1. Topik Sumber Kafka
            </div>
            {SOURCE_TOPICS.map((topic) => (
              <div
                key={topic.name}
                className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1.5"
              >
                <div className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                  {topic.name}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">{topic.sub}</div>
              </div>
            ))}
          </div>

          <StageArrow />

          {/* Stage 2: Flink SQL Processing */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] p-3">
            <div className={`${STAGE_LABEL} text-[var(--accent)]`}>
              <Cpu aria-hidden="true" className="h-3 w-3" /> 2. Pemrosesan Flink SQL
            </div>
            {FLINK_JOBS.map((job) => (
              <div
                key={job.tag}
                className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2"
              >
                <div className={`${NODE_TAG} text-[var(--accent)]`}>{job.tag}</div>
                <div className="text-xs font-bold text-[var(--text-primary)]">{job.name}</div>
                <div className={`mt-0.5 ${NODE_SUB}`}>{job.sub}</div>
              </div>
            ))}
          </div>

          <StageArrow />

          {/* Stage 3: Derived Sinks */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className={`${STAGE_LABEL} text-[var(--text-muted)]`}>
              <Database aria-hidden="true" className="h-3 w-3" /> 3. Topik Output Flink
            </div>
            {sinks.map((sink) => (
              <div
                key={sink.name}
                className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2"
              >
                <div className={`${NODE_TAG} text-[var(--text-muted)]`}>DERIVED SINK</div>
                <div className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                  {sink.name}
                </div>
                <div className={NODE_SUB}>{sink.sub}</div>
              </div>
            ))}
          </div>

          <StageArrow />

          {/* Stage 4: Intelligence Consumers */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className={`${STAGE_LABEL} text-[var(--info)]`}>
              <Sparkles aria-hidden="true" className="h-3 w-3" /> 4. Konsumer Intelijen
            </div>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className={`${NODE_TAG} text-[var(--info)]`}>AI ENGINE</div>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                Gemini 2.5 &amp; AWS Bedrock
              </div>
              <div className={`mt-0.5 ${NODE_SUB}`}>Evaluasi Risiko &amp; Agen OODA</div>
            </div>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className={`${NODE_TAG} text-[var(--accent)]`}>SSE HUB</div>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                Go Backend &amp; Next.js API
              </div>
              <div className={`mt-0.5 ${NODE_SUB}`}>Sinkronisasi kokpit lewat SSE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
