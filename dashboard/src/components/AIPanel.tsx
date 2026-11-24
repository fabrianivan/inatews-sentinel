'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cpu,
  Info,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import type {
  AIAnalysis,
  AgentState,
  AgentThought,
  AgentTacticalAction,
} from '@/lib/types';
import { AUTO_SUMMARY_MODEL_LABEL, type TelemetryPromptContext } from '@/lib/aiContext';
import { TONE_LABEL, toTone } from '@/lib/severity';
import { formatWibDate, formatWibTime } from '@/lib/time';
import { fetchAIProvider, switchAIProvider, fetchAgentState } from '@/hooks/useSSE';

interface AIPanelProps {
  analysis: AIAnalysis;
  telemetryContext?: TelemetryPromptContext;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const SUGGESTION_HEADING = 'Saran sistem — keputusan pada BMKG / BPBD';

const SUGGESTED_PROMPTS = [
  'Apa keterangan BMKG tentang potensi tsunami gempa terkini?',
  'Siapa yang memutuskan evakuasi dan apa rujukan resminya?',
  'Data apa yang tersedia tentang infrastruktur pesisir?',
];

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini 2.5', icon: Sparkles },
  { id: 'bedrock', label: 'AWS Bedrock', icon: Cloud },
] as const;

const OODA_LABEL: Record<AgentThought['phase'], string> = {
  OBSERVE: 'Amati',
  ORIENT: 'Orientasi',
  DECIDE: 'Putuskan',
  ACT: 'Tindak',
};

const UNAVAILABLE = 'tidak tersedia';

/** A chat answer with the model that wrote it, or a failure to get one. */
type ChatReply =
  | { kind: 'answer'; text: string; model: string | null }
  | { kind: 'error'; text: string };

/**
 * Neutral three-step scale for suggestions to agencies. It is deliberately not
 * the tone scale: a priority is a to-do order, not a statement of severity.
 */
function priorityLabel(priority: string): 'Segera' | 'Penting' | 'Pantau' {
  switch (priority.trim().toUpperCase()) {
    case 'IMMEDIATE':
    case 'CRITICAL':
      return 'Segera';
    case 'URGENT':
    case 'HIGH':
      return 'Penting';
    default:
      return 'Pantau';
  }
}

function PriorityChip({ priority }: { priority: string }) {
  return (
    <span className="inline-flex min-h-6 shrink-0 items-center rounded-full border border-[var(--border-strong)] px-2 text-[11px] font-semibold text-[var(--text-secondary)]">
      {priorityLabel(priority)}
    </span>
  );
}

/** Says who wrote a block of text; template output is set apart from a model's. */
function ModelProvenance({ model }: { model: string | null | undefined }) {
  const label = model?.trim();
  if (label === AUTO_SUMMARY_MODEL_LABEL) {
    return (
      <span className="inline-flex min-h-6 items-center rounded-full border border-dashed border-[var(--border-strong)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">
        {AUTO_SUMMARY_MODEL_LABEL}
      </span>
    );
  }
  return <span className="t-meta">Model: {label || 'tidak diketahui'}</span>;
}

interface ReplyBlockProps {
  reply: ChatReply;
  title: string;
  /** Still streaming: the model is only named once the answer is complete. */
  pending?: boolean;
}

function ReplyBlock({ reply, title, pending = false }: ReplyBlockProps) {
  return (
    <div className="mt-3 rounded-xl bg-[var(--surface-1)] p-4 shadow-2xs">
      {reply.kind === 'answer' && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="t-micro inline-flex items-center gap-1.5">
            <Bot aria-hidden className="h-3.5 w-3.5" />
            {reply.model === AUTO_SUMMARY_MODEL_LABEL ? 'Ringkasan' : title}
          </span>
          {pending ? <span className="t-meta">Menjawab…</span> : <ModelProvenance model={reply.model} />}
        </div>
      )}
      <div className="t-body whitespace-pre-wrap">{reply.text}</div>
    </div>
  );
}

export default function AIPanel({ analysis, telemetryContext }: AIPanelProps) {
  const isDrill = telemetryContext?.mode === 'SIMULASI';
  // Only this app's own routes are sent the drill context, so a drill question never goes to the backend.
  const primaryBase = isDrill ? '' : API_BASE;

  const [showExplain, setShowExplain] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const [activeProvider, setActiveProvider] = useState<string>('gemini');
  const [activeModel, setActiveModel] = useState<string>('Google Gemini 2.5 Flash');
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [providerToast, setProviderToast] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [copilotReply, setCopilotReply] = useState<ChatReply | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentQuestion, setAgentQuestion] = useState('');
  const [agentStreaming, setAgentStreaming] = useState(false);
  const [agentReply, setAgentReply] = useState<ChatReply | null>(null);
  const [agentLiveThoughts, setAgentLiveThoughts] = useState<AgentThought[]>([]);
  const [agentLiveActions, setAgentLiveActions] = useState<AgentTacticalAction[]>([]);
  const streamAbortController = useRef<AbortController | null>(null);

  const questionId = useId();
  const agentQuestionId = useId();
  const detailsId = useId();
  const factorsId = useId();

  useEffect(() => {
    fetchAIProvider()
      .then((data) => {
        if (data?.active) {
          setActiveProvider(data.active);
          setActiveModel(data.model || data.active);
        }
      })
      .catch(() => {});

    fetchAgentState()
      .then((data) => {
        if (data && typeof data === 'object') {
          const st = data as AgentState;
          setAgentState(st);
          if (st.recent_thoughts) setAgentLiveThoughts(st.recent_thoughts);
          if (st.recent_actions) setAgentLiveActions(st.recent_actions);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchAgentState()
        .then((data) => {
          if (data && typeof data === 'object') {
            const st = data as AgentState;
            setAgentState(st);
            if (st.recent_thoughts && st.recent_thoughts.length > 0) {
              setAgentLiveThoughts(st.recent_thoughts);
            }
            if (st.recent_actions && st.recent_actions.length > 0) {
              setAgentLiveActions(st.recent_actions);
            }
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  const handleSwitchProvider = async (target: string) => {
    if (target === activeProvider || switchingProvider) return;
    setSwitchingProvider(true);
    try {
      const res = await switchAIProvider(target);
      if (res && res.active) {
        setActiveProvider(res.active);
        setActiveModel(res.model);
        setProviderToast(`Penyedia model dialihkan ke ${res.model}`);
        setTimeout(() => setProviderToast(null), 3500);
        fetchAgentState()
          .then((data) => {
            if (data && typeof data === 'object') {
              setAgentState(data as AgentState);
            }
          })
          .catch(() => {});
      }
    } catch {
      setProviderToast('Gagal mengganti penyedia model');
      setTimeout(() => setProviderToast(null), 3000);
    } finally {
      setSwitchingProvider(false);
    }
  };

  const buildRequestContext = (): TelemetryPromptContext => ({
    ...telemetryContext,
    provider: activeProvider === 'bedrock' ? 'bedrock' : 'gemini',
  });

  const handleAskCopilot = async (qText?: string) => {
    const query = qText || question;
    if (!query.trim()) return;

    setCopilotLoading(true);
    setCopilotReply(null);

    const payload = JSON.stringify({
      question: query,
      context: buildRequestContext(),
    });

    try {
      let res = await fetch(`${primaryBase}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (!res.ok && primaryBase) {
        res = await fetch('/api/ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      }

      if (!res.ok) throw new Error('Copilot request failed');
      const data = await res.json();
      setCopilotReply(
        data.answer
          ? { kind: 'answer', text: data.answer, model: typeof data.model === 'string' ? data.model : null }
          : { kind: 'error', text: 'Tidak ada jawaban yang diterima.' }
      );
    } catch {
      setCopilotReply({
        kind: 'error',
        text: 'Jawaban tidak tersedia: layanan kopilot tidak dapat dihubungi. Rujuk buletin resmi BMKG.',
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleAskAgentStream = async (qText?: string) => {
    const query = qText || agentQuestion;
    if (!query.trim() || agentStreaming) return;

    setAgentStreaming(true);
    setAgentReply({ kind: 'answer', text: '', model: null });

    if (streamAbortController.current) {
      streamAbortController.current.abort();
    }
    const abortController = new AbortController();
    streamAbortController.current = abortController;

    const payload = JSON.stringify({
      question: query,
      context: buildRequestContext(),
    });

    try {
      let res = await fetch(`${primaryBase}/api/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: abortController.signal,
      });

      if (!res.ok && primaryBase) {
        res = await fetch('/api/agent/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: abortController.signal,
        });
      }

      if (!res.ok || !res.body) throw new Error('Agent streaming request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let model: string | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (typeof parsed.model === 'string') model = parsed.model;
              if (parsed.token) {
                fullText += parsed.token;
              } else if (parsed.answer) {
                fullText = parsed.answer;
              }
              setAgentReply({ kind: 'answer', text: fullText, model });
            } catch {
              // ignore partial chunks
            }
          }
        }
      }

      if (fullText.trim() === '') {
        setAgentReply({ kind: 'error', text: 'Tidak ada jawaban yang diterima.' });
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setAgentReply({
          kind: 'error',
          text: 'Jawaban agen tidak tersedia: layanan tidak dapat dihubungi. Rujuk buletin resmi BMKG.',
        });
      }
    } finally {
      setAgentStreaming(false);
    }
  };

  const tone = toTone(analysis.status);
  const hazard = analysis.hazard_details;
  const hazardCards: Array<{ label: string; value: string | undefined }> = isDrill
    ? [
        { label: 'Mekanisme sesar', value: hazard?.fault_mechanism },
        { label: 'Slip koseismik', value: hazard?.estimated_coseismic_slip },
        { label: 'Tinggi gelombang skenario', value: hazard?.tsunami_runup_estimate },
        {
          label: 'Tiba gelombang pertama',
          value:
            hazard && hazard.evacuation_window_min > 0
              ? `≈ ${hazard.evacuation_window_min} menit setelah gempa utama`
              : undefined,
        },
      ]
    : [
        { label: 'Mekanisme sesar', value: hazard?.fault_mechanism },
        { label: 'Slip koseismik', value: hazard?.estimated_coseismic_slip },
        { label: 'Gempa susulan', value: hazard?.aftershock_risk },
        // No public feed carries a wave height or an arrival time, whatever a payload claims.
        {
          label: 'Tinggi dan waktu tiba gelombang',
          value: 'tidak tersedia dari umpan publik — rujuk peringatan dini BMKG',
        },
      ];

  return (
    <div className={`@container matte-card overflow-hidden ${isDrill ? 'drill-frame' : ''}`}>
      <div role="status">
        {providerToast && (
          <div className="border-b border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-2 text-center text-xs font-semibold text-[var(--accent)]">
            {providerToast}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4 @xl:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="t-heading inline-flex items-center gap-2">
            <Bot aria-hidden className="h-4 w-4 text-[var(--accent)]" />
            Pendukung Keputusan Sentinel
          </h3>
          {isDrill && <span className="drill-chip">SIMULASI</span>}

          <div
            role="group"
            aria-label="Penyedia model AI"
            className="inline-flex rounded-full bg-[var(--surface-2)] p-0.5"
          >
            {PROVIDERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeProvider === id}
                onClick={() => handleSwitchProvider(id)}
                disabled={switchingProvider}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
                  activeProvider === id
                    ? 'bg-[var(--accent-strong)] text-white shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon aria-hidden className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <ModelProvenance model={analysis.model_used} />
      </div>

      <div className="space-y-6 p-5 @xl:p-6">
        {/* Summary */}
        <section data-tone={tone} className="border-l-2 border-[var(--tone)] pl-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h4 className="t-micro">Ringkasan situasi</h4>
            <span className="tone-chip" data-tone={tone}>
              {TONE_LABEL[tone]}
            </span>
            <span className="t-meta">
              {isDrill ? 'skala dasbor · nilai latihan' : 'skala dasbor · tidak resmi'}
            </span>
          </div>
          <p className="text-base leading-relaxed font-medium text-[var(--text-primary)] @xl:text-lg">
            {analysis.threat_summary || analysis.assessment || `Ringkasan ${UNAVAILABLE}.`}
          </p>
          {analysis.threat_summary && analysis.assessment && (
            <p className="t-body mt-2 text-[var(--text-secondary)]">{analysis.assessment}</p>
          )}
        </section>

        {/* Facts and suggestions */}
        <div className="grid grid-cols-1 gap-6 border-t border-[var(--border-hairline)] pt-5 @2xl:grid-cols-2">
          <div>
            <h4 className="t-micro mb-2.5">
              {isDrill ? 'Nilai skenario (latihan)' : 'Fakta dan sumbernya'}
            </h4>
            {analysis.observations?.length ? (
              <ul className="t-body space-y-2 text-[var(--text-secondary)]">
                {analysis.observations.map((obs, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]"
                    />
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body text-[var(--text-secondary)]">Fakta {UNAVAILABLE}.</p>
            )}
          </div>

          <div>
            <h4 className="t-micro mb-2.5">{SUGGESTION_HEADING}</h4>
            {analysis.recommendations?.length ? (
              <ol className="t-body list-decimal space-y-2 pl-5 marker:text-[var(--text-muted)]">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ol>
            ) : (
              <p className="t-body text-[var(--text-secondary)]">Saran {UNAVAILABLE}.</p>
            )}
          </div>
        </div>

        {/* Copilot chat */}
        <section className="rounded-2xl bg-[var(--surface-2)] p-4 @xl:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--text-primary)]">
              <MessageSquare aria-hidden className="h-3.5 w-3.5 text-[var(--accent)]" />
              Tanya kopilot
            </h4>
            <span className="t-meta">Penyedia terpilih: {activeModel}</span>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => {
                  setQuestion(promptText);
                  handleAskCopilot(promptText);
                }}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--surface-1)] px-3 py-1 text-left text-xs font-medium text-[var(--text-secondary)] shadow-2xs transition-colors hover:text-[var(--text-primary)]"
              >
                <Lightbulb aria-hidden className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                <span>{promptText}</span>
              </button>
            ))}
          </div>

          <label htmlFor={questionId} className="t-micro mb-1.5 block">
            Pertanyaan untuk kopilot
          </label>
          <div className="flex gap-2">
            <input
              id={questionId}
              type="text"
              placeholder="Tulis pertanyaan tentang data yang tampil…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent-border)]"
            />
            <button
              type="button"
              onClick={() => handleAskCopilot()}
              disabled={copilotLoading}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send aria-hidden className="h-3.5 w-3.5" />
              <span>{copilotLoading ? 'Memproses…' : 'Tanya'}</span>
            </button>
          </div>

          <div aria-live="polite">
            {copilotLoading && <p className="t-meta mt-3">Menyusun jawaban…</p>}
            {copilotReply && !copilotLoading && (
              <ReplyBlock reply={copilotReply} title="Jawaban kopilot" />
            )}
          </div>
        </section>

        {/* Hazard details, agency roles and the agent log */}
        <div className="border-t border-[var(--border-hairline)] pt-4">
          <button
            type="button"
            aria-expanded={showTechnicalDetails}
            aria-controls={detailsId}
            onClick={() => setShowTechnicalDetails((prev) => !prev)}
            className="flex min-h-9 w-full items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3.5 py-1.5 text-left text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] @xl:inline-flex @xl:w-auto @xl:rounded-full"
          >
            {showTechnicalDetails ? (
              <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>Rincian bahaya, peran lembaga dan log agen</span>
          </button>

          {showTechnicalDetails && (
            <div id={detailsId} className="mt-4 space-y-5">
              <div>
                <dl className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
                  {hazardCards.map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-[var(--surface-2)] p-3">
                      <dt className="t-micro">{label}</dt>
                      <dd className="t-body mt-1 font-semibold">{value?.trim() || UNAVAILABLE}</dd>
                    </div>
                  ))}
                </dl>
                <p className="t-meta mt-2">
                  {isDrill
                    ? 'Nilai latihan — bukan hasil pemodelan dan bukan data BMKG / PVMBG.'
                    : 'Bukan pengukuran. Parameter resmi hanya dari BMKG.'}
                </p>
              </div>

              {analysis.agency_actions && analysis.agency_actions.length > 0 && (
                <div>
                  <h4 className="t-micro mb-2.5">{SUGGESTION_HEADING}</h4>
                  <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
                    {analysis.agency_actions.map((act, i) => (
                      <li key={i} className="rounded-xl bg-[var(--surface-2)] p-3.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-[var(--text-primary)]">
                            {act.agency}
                          </span>
                          <PriorityChip priority={act.priority} />
                        </div>
                        <p className="t-body text-[var(--text-secondary)]">{act.action}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Agent log and stream */}
              <section className="rounded-2xl bg-[var(--surface-2)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-primary)]">
                    <Cpu aria-hidden className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Log agen pemantau
                  </h4>
                  {!isDrill && agentState && <ModelProvenance model={agentState.active_model} />}
                </div>

                {isDrill ? (
                  // The log is built from the real feeds; under a drill frame it would read as drill data.
                  <p className="t-meta">
                    Log agen membaca umpan nyata dan tidak ditampilkan selama latihan.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
                    <div className="rounded-xl bg-[var(--surface-1)] p-3">
                      <h5 className="t-micro mb-2 flex items-center gap-1.5">
                        <Brain aria-hidden className="h-3.5 w-3.5" />
                        Catatan agen
                      </h5>
                      {agentLiveThoughts.length === 0 ? (
                        <p className="t-meta">Belum ada catatan.</p>
                      ) : (
                        <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
                          {agentLiveThoughts
                            .slice(-4)
                            .reverse()
                            .map((th, i) => (
                              <li
                                key={i}
                                className="rounded-lg border-l-2 border-l-[var(--border-strong)] bg-[var(--surface-2)] p-2"
                              >
                                <div className="mb-0.5 flex items-center justify-between gap-2">
                                  <span className="t-micro">{OODA_LABEL[th.phase] ?? 'Catatan'}</span>
                                  <time dateTime={th.timestamp} className="t-meta tabular-nums">
                                    {formatWibDate(th.timestamp, { year: false })} · {formatWibTime(th.timestamp)}
                                  </time>
                                </div>
                                <p className="text-xs leading-snug text-[var(--text-secondary)]">
                                  {th.message}
                                </p>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl bg-[var(--surface-1)] p-3">
                      <h5 className="t-micro mb-2 flex items-center gap-1.5">
                        <ListChecks aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        {SUGGESTION_HEADING}
                      </h5>
                      {agentLiveActions.length === 0 ? (
                        <p className="t-meta">Belum ada saran tercatat.</p>
                      ) : (
                        <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
                          {agentLiveActions
                            .slice(-4)
                            .reverse()
                            .map((act, i) => (
                              <li key={i} className="rounded-lg bg-[var(--surface-2)] p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-xs font-bold text-[var(--text-primary)]">
                                    {act.agency}
                                  </span>
                                  <PriorityChip priority={act.priority} />
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                                  {act.target_zone}: {act.rationale}
                                </p>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                <label htmlFor={agentQuestionId} className="t-micro mt-3 mb-1.5 block">
                  Pertanyaan untuk agen
                </label>
                <div className="flex gap-2">
                  <input
                    id={agentQuestionId}
                    type="text"
                    placeholder="Tulis pertanyaan untuk agen…"
                    value={agentQuestion}
                    onChange={(e) => setAgentQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAgentStream()}
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAskAgentStream()}
                    disabled={agentStreaming}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-3.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Send aria-hidden className="h-3.5 w-3.5" />
                    <span>{agentStreaming ? 'Menjawab…' : 'Kirim'}</span>
                  </button>
                </div>

                {/* aria-busy holds the announcement until the stream has finished */}
                <div aria-live="polite" aria-busy={agentStreaming}>
                  {agentReply && (
                    <ReplyBlock reply={agentReply} title="Jawaban agen" pending={agentStreaming} />
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* What the summary was built from */}
        {analysis.contributing_factors && analysis.contributing_factors.length > 0 && (
          <div className="border-t border-[var(--border-hairline)] pt-4">
            <button
              type="button"
              aria-expanded={showExplain}
              aria-controls={factorsId}
              onClick={() => setShowExplain((prev) => !prev)}
              className="flex min-h-9 w-full items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3.5 py-1.5 text-left text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] @xl:inline-flex @xl:w-auto @xl:rounded-full"
            >
              {showExplain ? (
                <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>Data yang dirangkum ({analysis.contributing_factors.length})</span>
            </button>

            {showExplain && (
              <dl id={factorsId} className="mt-3 grid grid-cols-1 gap-2 @xl:grid-cols-2">
                {analysis.contributing_factors.map((factor, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-2.5"
                  >
                    <dt className="text-xs font-semibold text-[var(--text-primary)]">
                      {factor.indicator}
                    </dt>
                    <dd className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="t-data text-[var(--text-primary)]">{factor.value}</span>
                      <span className="t-micro">{factor.change}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p
          role="note"
          className="t-meta flex items-start gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2"
        >
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span>
            {analysis.disclaimer ||
              'Pendukung keputusan tidak resmi. Rujukan resmi tetap BMKG, PVMBG dan BPBD setempat.'}
          </span>
        </p>
      </div>
    </div>
  );
}
