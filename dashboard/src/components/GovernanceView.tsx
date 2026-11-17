'use client';

import { useState, useEffect } from 'react';
import { FileCode2, Lock, ShieldCheck } from 'lucide-react';
import type { GovernanceInfo } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const DEFAULT_GOVERNANCE: GovernanceInfo[] = [
  { topic: 'gempa.seismic', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'BMKG Seismology', access: 'Public' },
  { topic: 'gempa.stations', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'BMKG Network Ops', access: 'Public' },
  { topic: 'gempa.tsunami', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'InaTEWS Ocean Sensors', access: 'Public' },
  { topic: 'gempa.weather', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'BMKG Meteorology', access: 'Public' },
  { topic: 'gempa.satellite', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'BRIN / InSAR Ops', access: 'Public' },
  { topic: 'gempa.infrastructure', classification: 'Operational', pii: 'Potential', schema_version: 'v1.2 (Avro)', owner: 'PUPR & BNPB', access: 'Restricted' },
  { topic: 'gempa.population', classification: 'Sensitive', pii: 'Yes', schema_version: 'v2.0 (Avro + Enkripsi)', owner: 'BNPB Disaster Relief', access: 'Restricted' },
  { topic: 'gempa.intensity_index', classification: 'Derived', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'Apache Flink SQL', access: 'Internal' },
  { topic: 'gempa.correlated_alerts', classification: 'Derived', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'Apache Flink SQL', access: 'Internal' },
  { topic: 'gempa.tsunami_scenarios', classification: 'Derived', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'Apache Flink SQL', access: 'Internal' },
];

export default function GovernanceView() {
  const [governance, setGovernance] = useState<GovernanceInfo[]>(DEFAULT_GOVERNANCE);

  useEffect(() => {
    fetch(`${API_BASE}/api/governance`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setGovernance(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Banner */}
      <div className="matte-card p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] text-[var(--sev-normal)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Tata Kelola Data &amp; Schema Registry Confluent
                </h2>
                <span className="rounded border border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--sev-normal)]">
                  TERVALIDASI AVRO/JSON
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Katalog skema event streaming, kontrol akses topik Kafka, dan perlindungan data sensitif kependudukan terdampak (PII).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Schema Registry</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-[var(--sev-normal)]">ONLINE</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Total Topik</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-[var(--text-primary)]">10 Topik</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Proteksi PII</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-[var(--accent)]">gempa.population</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Flink Sinks</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-[var(--text-primary)]">3 Topik</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="matte-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <FileCode2 className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Katalog Kontrak Topik Kafka &amp; Kebijakan Akses</span>
          </span>
          <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
            {governance.length} TOPIK TERDAFTAR
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-2)] font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                <th className="px-4 py-2.5">Nama Topik</th>
                <th className="px-4 py-2.5">Klasifikasi</th>
                <th className="px-4 py-2.5">Status PII</th>
                <th className="px-4 py-2.5">Skema &amp; Versi</th>
                <th className="px-4 py-2.5">Penanggung Jawab</th>
                <th className="px-4 py-2.5">Kebijakan Akses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {governance.map((item) => (
                <tr key={item.topic} className="hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-2.5 font-mono font-bold text-[var(--accent)]">
                    {item.topic}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-primary)]">
                      {item.classification}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold ${
                        item.pii === 'Yes'
                          ? 'text-[var(--sev-critical)]'
                          : item.pii === 'Potential'
                          ? 'text-[var(--sev-elevated)]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {item.pii === 'Yes' && <Lock className="h-3 w-3" />}
                      {item.pii === 'Yes' ? 'Ya (Terenkripsi)' : item.pii}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    {item.schema_version}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                    {item.owner}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        item.access === 'Public'
                          ? 'border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] text-[var(--sev-normal)]'
                          : item.access === 'Restricted'
                          ? 'border-[var(--sev-elevated-border)] bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.access}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
