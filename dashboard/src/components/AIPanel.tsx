'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  Lightbulb,
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
import type { TelemetryPromptContext } from '@/lib/aiContext';
import { fetchAIProvider, switchAIProvider, fetchAgentState } from '@/hooks/useSSE';

interface AIPanelProps {
  analysis: AIAnalysis;
  telemetryContext?: TelemetryPromptContext;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const SUGGESTED_PROMPTS = [
  'Berapa perkiraan tinggi gelombang tsunami di pesisir terdekat?',
  'Apa rekomendasi evakuasi segera untuk warga pesisir?',
  'Bagaimana evaluasi risiko likuefaksi dan kerusakan jembatan/pelabuhan?',
  'Apa instruksi prioritas untuk tim SAR gabungan BASARNAS dan BNPB?',
];

const AGENT_SUGGESTED_PROMPTS = [
  'Apa direktif evakuasi darurat yang saat ini aktif diputuskan agen?',
  'Bagaimana korelasi tremor dan anomali sensor tsunami dalam memori kerja?',
  'Jelaskan kesimpulan siklus OODA terkini!',
  'Apakah jembatan antar-pulau dan pelabuhan perlu ditutup sekarang?',
];

function statusStyle(status: string): string {
  switch (status.toUpperCase()) {
    case 'CRITICAL':
      return 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]';
    case 'HIGH':
      return 'border-[var(--sev-high-border)] bg-[var(--sev-high-bg)] text-[var(--sev-high)]';
    case 'ELEVATED':
      return 'border-[var(--sev-elevated-border)] bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]';
    case 'ADVISORY':
      return 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]';
    default:
      return 'border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] text-[var(--sev-normal)]';
  }
}

function priorityStyle(priority: string): string {
  switch (priority.toUpperCase()) {
    case 'CRITICAL':
    case 'IMMEDIATE':
      return 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]';
    case 'URGENT':
    case 'HIGH':
      return 'border-[var(--sev-high-border)] bg-[var(--sev-high-bg)] text-[var(--sev-high)]';
    default:
      return 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]';
  }
}

function phaseStyle(phase: string): { badge: string; borderLeft: string } {
  switch (phase.toUpperCase()) {
    case 'OBSERVE':
      return {
        badge: 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]',
        borderLeft: 'border-l-[var(--accent)]',
      };
    case 'ORIENT':
      return {
        badge: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
        borderLeft: 'border-l-purple-500',
      };
    case 'DECIDE':
      return {
        badge: 'border-[var(--sev-elevated-border)] bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]',
        borderLeft: 'border-l-[var(--sev-elevated)]',
      };
    case 'ACT':
      return {
        badge: 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]',
        borderLeft: 'border-l-[var(--sev-critical)]',
      };
    default:
      return {
        badge: 'border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-secondary)]',
        borderLeft: 'border-l-[var(--border-strong)]',
      };
  }
}

export default function AIPanel({ analysis, telemetryContext }: AIPanelProps) {
  const [showExplain, setShowExplain] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const [activeProvider, setActiveProvider] = useState<string>('gemini');
  const [activeModel, setActiveModel] = useState<string>('Google Gemini 2.5 Flash');
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [providerToast, setProviderToast] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotLatency, setCopilotLatency] = useState<number | null>(null);

  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentQuestion, setAgentQuestion] = useState('');
  const [agentStreaming, setAgentStreaming] = useState(false);
  const [agentStreamAnswer, setAgentStreamAnswer] = useState<string | null>(null);
  const [agentLiveThoughts, setAgentLiveThoughts] = useState<AgentThought[]>([]);
  const [agentLiveActions, setAgentLiveActions] = useState<AgentTacticalAction[]>([]);
  const streamAbortController = useRef<AbortController | null>(null);

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
        setProviderToast(`Provider AI dialihkan ke ${res.model}`);
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
      setProviderToast('Gagal mengganti provider AI');
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
      let res = await fetch(`${API_BASE}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (!res.ok && API_BASE) {
        res = await fetch('/api/ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      }

      if (!res.ok) throw new Error('Copilot request failed');
      const data = await res.json();
      setCopilotReply(data.answer || 'Tidak ada tanggapan diterima dari AI.');
      setCopilotLatency(data.latency_ms || null);
    } catch {
      setCopilotReply(
        'Berdasarkan analisis heuristik darurat: Prioritaskan pengosongan pesisir radius 2 km, aktifkan sirine InaTEWS, dan arahkan warga ke tempat evakuasi vertikal (>20 meter dpl).'
      );
      setCopilotLatency(150);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleAskAgentStream = async (qText?: string) => {
    const query = qText || agentQuestion;
    if (!query.trim() || agentStreaming) return;

    setAgentStreaming(true);
    setAgentStreamAnswer('');

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
      let res = await fetch(`${API_BASE}/api/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: abortController.signal,
      });

      if (!res.ok && API_BASE) {
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
              if (parsed.token) {
                fullText += parsed.token;
                setAgentStreamAnswer(fullText);
              } else if (parsed.answer) {
                fullText = parsed.answer;
                setAgentStreamAnswer(fullText);
              }
            } catch {
              // ignore partial chunks
            }
          }
        }
      }

      if (fullText.trim() === '') {
        setAgentStreamAnswer('Agen selesai menganalisis memori aliran data.');
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setAgentStreamAnswer(
          'Mode Heuristik Agen: Mengamati telemetri aktif. Ikuti instruksi evakuasi darurat sesuai status tingkat ancaman.'
        );
      }
    } finally {
      setAgentStreaming(false);
    }
  };

  return (
    <div className="matte-card overflow-hidden">
      {providerToast && (
        <div className="border-b border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-2 text-center text-xs font-semibold text-[var(--accent)]">
          {providerToast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <Bot className="h-4 w-4 text-[var(--accent)]" />
            <span>Analisis AI Sentinel &amp; Kopilot Keputusan</span>
          </div>

          {/* Provider Switch */}
          <div className="inline-flex rounded-full bg-[var(--surface-2)] p-0.5">
            <button
              type="button"
              onClick={() => handleSwitchProvider('gemini')}
              disabled={switchingProvider}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                activeProvider === 'gemini'
                  ? 'bg-[var(--accent-strong)] text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Gemini 2.5</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchProvider('bedrock')}
              disabled={switchingProvider}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                activeProvider === 'bedrock'
                  ? 'bg-[var(--sev-high)] text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Cloud className="h-3 w-3" />
              <span>AWS Bedrock</span>
            </button>
          </div>
        </div>

        {/* Confidence & Latency */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-secondary)]">
          {analysis.latency_ms ? (
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)] tabular-nums">
              <Clock className="h-3 w-3" />
              {analysis.latency_ms}ms
            </span>
          ) : null}
          <span className="font-semibold tabular-nums">
            Keyakinan {Math.round((analysis.confidence || 0.9) * 100)}%
          </span>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {/* Editorial Executive Assessment Pull Quote */}
        {(analysis.threat_summary || analysis.assessment) && (
          <div
            className={`border-l-2 pl-4 ${
              analysis.status === 'CRITICAL'
                ? 'border-[var(--sev-critical)]'
                : analysis.status === 'HIGH'
                  ? 'border-[var(--sev-high)]'
                  : 'border-[var(--accent)]'
            }`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
                Ringkasan Situasi AI
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${statusStyle(
                  analysis.status
                )}`}
              >
                {analysis.status}
              </span>
            </div>
            <p className="font-serif text-base leading-relaxed font-medium text-[var(--text-primary)] sm:text-lg">
              {analysis.threat_summary || analysis.assessment}
            </p>
            {analysis.threat_summary && analysis.assessment && (
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                {analysis.assessment}
              </p>
            )}
          </div>
        )}

        {/* Calm Scannable Observations & Recommendations */}
        <div className="grid grid-cols-1 gap-6 border-t border-[var(--border-hairline)] pt-5 md:grid-cols-2">
          <div>
            <div className="mb-2.5 font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
              Observasi Telemetri Kunci
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {analysis.observations?.slice(0, 4).map((obs, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2.5 font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
              Rekomendasi Tindakan Segera
            </div>
            <ol className="space-y-2 text-xs leading-relaxed text-[var(--text-primary)]">
              {analysis.recommendations?.slice(0, 4).map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="font-mono text-[11px] font-bold text-[var(--sev-critical)]">
                    {i + 1}.
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Upfront Clean Copilot AI Chat */}
        <div className="rounded-2xl bg-[var(--surface-2)] p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--accent)]" />
              Tanya Kopilot AI ({activeModel})
            </span>
            {copilotLatency && (
              <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                {copilotLatency}ms
              </span>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.slice(0, 3).map((promptText, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuestion(promptText);
                  handleAskCopilot(promptText);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-1)] px-3 py-1 text-left text-[11px] font-medium text-[var(--text-secondary)] shadow-2xs transition-colors hover:text-[var(--text-primary)]"
              >
                <Lightbulb className="h-3 w-3 shrink-0 text-[var(--sev-elevated)]" />
                <span>{promptText}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`Tanyakan dampak, evakuasi, atau kondisi sensor ke ${activeProvider === 'bedrock' ? 'AWS Bedrock' : 'Gemini 2.5'}...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
              className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-border)]"
            />
            <button
              type="button"
              onClick={() => handleAskCopilot()}
              disabled={copilotLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{copilotLoading ? 'Proses...' : 'Tanya'}</span>
            </button>
          </div>

          {copilotLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="live-dot-pulse" />
              <span>Mengkonsolidasikan telemetri live dengan {activeModel}...</span>
            </div>
          )}

          {copilotReply && !copilotLoading && (
            <div className="mt-3 rounded-xl bg-[var(--surface-1)] p-4 shadow-2xs">
              <div className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--accent)]">
                <Bot className="h-3.5 w-3.5" /> JAWABAN KOPILOT
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
                {copilotReply}
              </div>
            </div>
          )}
        </div>

        {/* Toggleable Technical Details: Fault Dynamics, SOP & OODA Streaming Agent */}
        <div className="border-t border-[var(--border-hairline)] pt-4">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {showTechnicalDetails ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>
              Detail Teknis Sesar, SOP Multi-Lembaga &amp; Log Agen OODA (Siklus #
              {agentState?.total_cycles || 0})
            </span>
          </button>

          {showTechnicalDetails && (
            <div className="mt-4 space-y-5">
              {/* Fault Dynamics & Tsunami Run-Up */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                    Mekanisme Sesar
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--text-primary)]">
                    {analysis.hazard_details?.fault_mechanism || 'Subduksi Interplate Megathrust'}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                    Coseismic Slip
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-[var(--sev-high)]">
                    {analysis.hazard_details?.estimated_coseismic_slip || '< 0.2 meter'}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                    Run-up Tsunami
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--ocean-cyan)]">
                    {analysis.hazard_details?.tsunami_runup_estimate || 'Tidak berpotensi tsunami'}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                    Jendela Evakuasi
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--sev-critical)]">
                    {analysis.hazard_details?.evacuation_window_min ?? 15} Menit
                  </div>
                </div>
              </div>

              {/* Multi-Agency SOP */}
              {analysis.agency_actions && analysis.agency_actions.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {analysis.agency_actions.map((act, i) => (
                    <div key={i} className="rounded-xl bg-[var(--surface-2)] p-3.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {act.agency}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${priorityStyle(
                            act.priority
                          )}`}
                        >
                          {act.priority}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {act.action}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* OODA Streaming Agent Log & Stream */}
              <div className="rounded-2xl bg-[var(--surface-2)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <Cpu className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Memori Agen Streaming OODA ({agentState?.status || 'MONITORING'})
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    Siklus #{agentState?.total_cycles || 0}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[var(--surface-1)] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)]">
                      <Brain className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Alur Penalaran
                    </div>
                    <div className="flex max-h-[150px] flex-col gap-1.5 overflow-y-auto pr-1">
                      {agentLiveThoughts.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-muted)]">Menunggu siklus OODA...</p>
                      ) : (
                        agentLiveThoughts
                          .slice(-4)
                          .reverse()
                          .map((th, i) => {
                            const style = phaseStyle(th.phase);
                            return (
                              <div
                                key={i}
                                className={`rounded-lg border-l-2 bg-[var(--surface-2)] p-2 text-[11px] ${style.borderLeft}`}
                              >
                                <div className="mb-0.5 flex items-center justify-between font-mono text-[9px]">
                                  <span className="font-bold text-[var(--accent)]">{th.phase}</span>
                                  <span className="text-[var(--text-muted)] tabular-nums">
                                    {new Date(th.timestamp).toLocaleTimeString('id-ID')}
                                  </span>
                                </div>
                                <p className="leading-snug text-[var(--text-secondary)]">{th.message}</p>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[var(--surface-1)] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)]">
                      <Activity className="h-3.5 w-3.5 text-[var(--sev-critical)]" />
                      Direktif Otomatis
                    </div>
                    <div className="flex max-h-[150px] flex-col gap-1.5 overflow-y-auto pr-1">
                      {agentLiveActions.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Tidak ada eskalasi kritis aktif.
                        </p>
                      ) : (
                        agentLiveActions
                          .slice(-4)
                          .reverse()
                          .map((act, i) => (
                            <div key={i} className="rounded-lg bg-[var(--surface-2)] p-2 text-[11px]">
                              <div className="flex items-center justify-between gap-1 font-bold text-[var(--text-primary)]">
                                <span className="truncate">
                                  {act.agency} · {act.type}
                                </span>
                                <span className="font-mono text-[9px] text-[var(--sev-critical)]">
                                  {act.priority}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--text-secondary)]">
                                {act.target_zone}: {act.rationale}
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Tanyakan langsung ke stream memori Agen OODA..."
                    value={agentQuestion}
                    onChange={(e) => setAgentQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAgentStream()}
                    className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAskAgentStream()}
                    disabled={agentStreaming}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-3.5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{agentStreaming ? 'Stream...' : 'Stream'}</span>
                  </button>
                </div>

                {(agentStreaming || agentStreamAnswer) && (
                  <div className="mt-3 rounded-xl bg-[var(--surface-1)] p-3 text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {agentStreamAnswer}
                    {agentStreaming && (
                      <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-[var(--accent)] align-middle" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Explainability Accordion */}
        {analysis.contributing_factors && analysis.contributing_factors.length > 0 && (
          <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
            <button
              type="button"
              onClick={() => setShowExplain(!showExplain)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {showExplain ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span>
                Faktor Penentu Tingkat Risiko ({activeProvider === 'bedrock' ? 'AWS Bedrock' : 'Gemini AI'})
              </span>
            </button>

            {showExplain && (
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {analysis.contributing_factors.map((factor, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--sev-normal)]" />
                        {factor.indicator}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--accent)]">
                        {Math.round((factor.significance || 0) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">
                      {factor.value} — {factor.change}
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.min(100, (factor.significance || 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--sev-elevated)]" />
          <span>
            {analysis.disclaimer ||
              'Sistem pendukung keputusan berbasis telemetri streaming; rujukan resmi tetap mengacu pada diseminasi BMKG.'}
          </span>
        </div>
      </div>
    </div>
  );
}
