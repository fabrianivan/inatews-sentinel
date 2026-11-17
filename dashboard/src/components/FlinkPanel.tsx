'use client';

import { ArrowRight, Cpu, Database, GitBranch, Sparkles, Workflow } from 'lucide-react';
import type { ActivityIndex, SystemStatus } from '@/lib/types';

interface FlinkPanelProps {
  activityIndex: ActivityIndex | null;
  status: SystemStatus | null;
}

export default function FlinkPanel({ activityIndex, status }: FlinkPanelProps) {
  const intensity = activityIndex?.overall_percentage ?? status?.seismic_intensity ?? 15.0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header Banner */}
      <div className="matte-card p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Mesin Pemrosesan Stream Apache Flink CEP
                </h2>
                <span className="rounded border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent)]">
                  CONFLUENT FLINK v1.20
                </span>
                <span className="rounded border border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--sev-normal)]">
                  LIVE CEP
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Stateful stream processing dengan tumbling event-time window, korelasi multi-sensor, dan evaluasi real-time seluruh telemetri kegempaan Indonesia.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Compute Pool</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-[var(--text-primary)]">cpool-gempa-prod</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Throughput</div>
              <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">1,480 msg/s</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Watermark Lag</div>
              <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[var(--accent)]">&lt; 140 ms</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Checkpoints</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-[var(--sev-normal)]">100% OK</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Stage Pipeline DAG Topology */}
      <div className="matte-card p-5">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <GitBranch className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Topologi Pipeline DAG (Confluent Cloud → Apache Flink → AI Hub)</span>
          </span>
          <span className="rounded border border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--sev-normal)]">
            ALIRAN AKTIF
          </span>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          {/* Stage 1: Kafka Sources */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
              <Database className="h-3 w-3" /> 1. Topik Sumber Kafka
            </div>
            {[
              { name: 'gempa.seismic', sub: 'BMKG & USGS Quakes' },
              { name: 'gempa.stations', sub: '12 Seismometer Broadband' },
              { name: 'gempa.tsunami', sub: 'InaTEWS Buoys & IOC' },
              { name: 'gempa.satellite', sub: 'Deformasi InSAR' },
              { name: 'gempa.weather', sub: 'Open-Meteo Maritim' },
            ].map((topic) => (
              <div
                key={topic.name}
                className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1.5"
              >
                <div className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                  {topic.name}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">{topic.sub}</div>
              </div>
            ))}
          </div>

          <div className="hidden items-center justify-center text-[var(--text-muted)] lg:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Stage 2: Flink SQL Processing */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] p-3">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-[var(--accent)] uppercase">
              <Cpu className="h-3 w-3" /> 2. Pemrosesan Flink SQL
            </div>
            {[
              {
                tag: 'JOB #1',
                name: 'TUMBLE Window (1 Menit)',
                sub: 'Agregasi Indeks Intensitas (Mag + PGA + Slip + Laut)',
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
            ].map((job) => (
              <div
                key={job.tag}
                className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2"
              >
                <div className="font-mono text-[9px] font-bold text-[var(--accent)]">{job.tag}</div>
                <div className="text-xs font-bold text-[var(--text-primary)]">{job.name}</div>
                <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{job.sub}</div>
              </div>
            ))}
          </div>

          <div className="hidden items-center justify-center text-[var(--text-muted)] lg:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Stage 3: Derived Sinks */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-[var(--sev-normal)] uppercase">
              <Database className="h-3 w-3" /> 3. Topik Output Flink
            </div>
            {[
              { name: 'gempa.intensity_index', sub: `Indeks Aktif: ${intensity.toFixed(1)}%` },
              { name: 'gempa.correlated_alerts', sub: 'Peringatan Dini Multi-Lembaga' },
              { name: 'gempa.tsunami_scenarios', sub: 'Tinggi Gelombang & ETA Pantai' },
            ].map((sink) => (
              <div
                key={sink.name}
                className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2"
              >
                <div className="font-mono text-[9px] font-bold text-[var(--sev-normal)]">
                  DERIVED SINK
                </div>
                <div className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                  {sink.name}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">{sink.sub}</div>
              </div>
            ))}
          </div>

          <div className="hidden items-center justify-center text-[var(--text-muted)] lg:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Stage 4: Intelligence Consumers */}
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-[var(--satellite-purple)] uppercase">
              <Sparkles className="h-3 w-3" /> 4. Konsumer Intelijen
            </div>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className="font-mono text-[9px] font-bold text-[var(--satellite-purple)]">
                AI ENGINE
              </div>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                Gemini 2.5 &amp; AWS Bedrock
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                Evaluasi Risiko &amp; Agen OODA
              </div>
            </div>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className="font-mono text-[9px] font-bold text-[var(--accent)]">SSE HUB</div>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                Go Backend &amp; Next.js API
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                Sinkronisasi Kokpit Real-Time
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flink SQL Query Studio disembunyikan sesuai arahan */}
    </div>
  );
}
