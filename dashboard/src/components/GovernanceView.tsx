'use client';

import { useState, useEffect } from 'react';
import { FileCode2, Info, Lock, ShieldCheck } from 'lucide-react';
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

const PII_LABEL: Record<string, string> = {
  Yes: 'Ya (terenkripsi)',
  Potential: 'Berpotensi',
  None: 'Tidak ada',
};

const ACCESS_LABEL: Record<string, string> = {
  Public: 'Publik',
  Restricted: 'Terbatas',
  Internal: 'Internal',
};

const CELL_BADGE = 'rounded border px-2 py-0.5 font-mono text-[11px] font-semibold';

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

  // Counted from the catalogue below, so the tiles cannot disagree with the table.
  const summary = [
    { label: 'Format Skema', value: 'Avro / JSON' },
    { label: 'Total Topik', value: `${governance.length} topik` },
    { label: 'Topik ber-PII', value: `${governance.filter((item) => item.pii === 'Yes').length} topik` },
    { label: 'Topik Turunan Flink', value: `${governance.filter((item) => item.classification === 'Derived').length} topik` },
  ];

  return (
    <div className="@container flex flex-col gap-4">
      {/* Banner */}
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
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Tata Kelola Data &amp; Schema Registry Confluent
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Rancangan katalog skema event streaming, kontrol akses topik Kafka, dan perlindungan data sensitif kependudukan terdampak (PII).
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2.5 @xl:grid-cols-4">
            {summary.map((tile) => (
              <div
                key={tile.label}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2"
              >
                <dt className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">{tile.label}</dt>
                <dd className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">
                  {tile.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Table */}
      <div className="matte-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <FileCode2 aria-hidden="true" className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Katalog Kontrak Topik Kafka &amp; Kebijakan Akses</span>
          </span>
          <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
            {governance.length} TOPIK DALAM KATALOG
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                <th scope="col" className="px-4 py-2.5">Nama Topik</th>
                <th scope="col" className="px-4 py-2.5">Klasifikasi</th>
                <th scope="col" className="px-4 py-2.5">Status PII</th>
                <th scope="col" className="px-4 py-2.5">Skema &amp; Versi</th>
                <th scope="col" className="px-4 py-2.5">Penanggung Jawab</th>
                <th scope="col" className="px-4 py-2.5">Kebijakan Akses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {governance.map((item) => {
                const hasPii = item.pii === 'Yes';
                const restricted = item.access === 'Restricted';
                return (
                  <tr key={item.topic} className="hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2.5 font-mono font-bold text-[var(--accent)]">
                      {item.topic}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`${CELL_BADGE} border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-primary)]`}>
                        {item.classification}
                      </span>
                    </td>
                    {/* PII and access are data-handling attributes, not hazard severity: emphasis, icon and word carry them, never a tone colour. */}
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] ${
                          hasPii
                            ? 'font-bold text-[var(--text-primary)]'
                            : item.pii === 'Potential'
                            ? 'font-semibold text-[var(--text-secondary)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {hasPii && <Lock aria-hidden="true" className="h-3 w-3" />}
                        {PII_LABEL[item.pii] ?? item.pii}
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
                        className={`inline-flex items-center gap-1 ${CELL_BADGE} ${
                          restricted
                            ? 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)]'
                            : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {restricted && <Lock aria-hidden="true" className="h-3 w-3" />}
                        {ACCESS_LABEL[item.access] ?? item.access}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
