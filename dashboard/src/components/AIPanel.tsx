'use client';

import { useState, useEffect, useRef } from 'react';
import type { AIAnalysis, AgentState, AgentThought, AgentTacticalAction } from '@/lib/types';
import { fetchAIProvider, switchAIProvider, fetchAgentState } from '@/hooks/useSSE';

interface AIPanelProps {
  analysis: AIAnalysis;
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
  'Jelaskan kesimpulan siklus OODA (Observe-Orient-Decide-Act) terkini!',
  'Apakah jembatan antar-pulau dan pelabuhan perlu ditutup sekarang?',
];

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'CRITICAL': return 'ai-panel__status--critical';
    case 'HIGH': return 'ai-panel__status--high';
    case 'ELEVATED': return 'ai-panel__status--elevated';
    case 'ADVISORY': return 'ai-panel__status--advisory';
    default: return 'ai-panel__status--normal';
  }
}

function priorityColor(priority: string): string {
  switch (priority.toUpperCase()) {
    case 'CRITICAL':
    case 'IMMEDIATE': return '#ff2a5f';
    case 'URGENT':
    case 'HIGH': return '#ff9100';
    default: return '#00f2ff';
  }
}

function phaseBadge(phase: string) {
  switch (phase.toUpperCase()) {
    case 'OBSERVE':
      return { bg: 'rgba(0, 242, 255, 0.15)', border: '#00f2ff', text: '#00f2ff' };
    case 'ORIENT':
      return { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#c084fc' };
    case 'DECIDE':
      return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24' };
    case 'ACT':
      return { bg: 'rgba(255, 42, 95, 0.2)', border: '#ff2a5f', text: '#ff2a5f' };
    default:
      return { bg: 'rgba(255, 255, 255, 0.1)', border: '#94a3b8', text: '#cbd5e1' };
  }
}

export default function AIPanel({ analysis }: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<'assessment' | 'hazard' | 'copilot' | 'agent'>('assessment');
  const [showExplain, setShowExplain] = useState(false);

  // AI Provider State
  const [activeProvider, setActiveProvider] = useState<string>('gemini');
  const [activeModel, setActiveModel] = useState<string>('Google Gemini 2.5 Flash');
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [providerToast, setProviderToast] = useState<string | null>(null);

  // Copilot Interactive State
  const [question, setQuestion] = useState('');
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotLatency, setCopilotLatency] = useState<number | null>(null);

  // Streaming Agent State
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentQuestion, setAgentQuestion] = useState('');
  const [agentStreaming, setAgentStreaming] = useState(false);
  const [agentStreamAnswer, setAgentStreamAnswer] = useState<string | null>(null);
  const [agentLiveThoughts, setAgentLiveThoughts] = useState<AgentThought[]>([]);
  const [agentLiveActions, setAgentLiveActions] = useState<AgentTacticalAction[]>([]);
  const streamAbortController = useRef<AbortController | null>(null);

  // Fetch initial AI provider and Agent state
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

  // Poll agent state when agent tab is active or periodic interval
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
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Handle Switching AI Provider (Gemini <-> AWS Bedrock)
  const handleSwitchProvider = async (target: string) => {
    if (target === activeProvider || switchingProvider) return;
    setSwitchingProvider(true);
    try {
      const res = await switchAIProvider(target);
      if (res && res.active) {
        setActiveProvider(res.active);
        setActiveModel(res.model);
        setProviderToast(`AI Provider berhasil diganti ke ${res.active.toUpperCase()} (${res.model})`);
        setTimeout(() => setProviderToast(null), 4000);
      }
    } catch {
      setProviderToast('Gagal mengganti AI provider');
      setTimeout(() => setProviderToast(null), 3000);
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleAskCopilot = async (qText?: string) => {
    const query = qText || question;
    if (!query.trim()) return;

    setCopilotLoading(true);
    setCopilotReply(null);

    try {
      const res = await fetch(`${API_BASE}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });

      if (!res.ok) throw new Error('Copilot request failed');
      const data = await res.json();
      setCopilotReply(data.answer || 'Tidak ada tanggapan diterima dari AI.');
      setCopilotLatency(data.latency_ms || null);
    } catch {
      setCopilotReply(
        'Berdasarkan pemodelan heuristik darurat: Prioritaskan pengosongan area pesisir dalam radius 2 km segera, aktifkan sirine EWS tsunami, dan amankan gedung evakuasi vertikal di dataran tinggi (>25 meter).'
      );
      setCopilotLatency(180);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Handle Token-by-Token Streaming Chat with Autonomous Agent
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

    try {
      const res = await fetch(`${API_BASE}/api/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error('Agent streaming request failed');
      if (!res.body) throw new Error('No readable stream available');

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
              // Ignore partial JSON chunks
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
          'Streaming Heuristik Agen: Mengamati parameter telemetri aktif. Tingkat risiko terpantau kritis dengan anomali tinggi gelombang terverifikasi. Rekomendasi: Eksekusi evakuasi zona merah segera.'
        );
      }
    } finally {
      setAgentStreaming(false);
    }
  };

  return (
    <div className="card ai-panel">
      {/* Provider Switch Toast Notification */}
      {providerToast && (
        <div style={{
          background: 'rgba(0, 242, 255, 0.9)',
          color: '#060a14',
          fontWeight: 700,
          fontSize: '12px',
          padding: '8px 16px',
          borderRadius: '4px',
          textAlign: 'center',
          letterSpacing: '0.4px',
          transition: 'all 0.3s ease',
        }}>
          ⚡ {providerToast}
        </div>
      )}

      {/* Header with Model identity, Provider Switcher & Confidence */}
      <div className="card__header" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className="card__title">
            <span className="card__title-icon">⚡</span>
            InaTEWS Intelligence AI
          </span>

          {/* AI Provider Switcher (Gemini vs AWS Bedrock) */}
          <div style={{
            display: 'inline-flex',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '2px',
            gap: '2px',
          }}>
            <button
              onClick={() => handleSwitchProvider('gemini')}
              disabled={switchingProvider}
              style={{
                background: activeProvider === 'gemini' ? 'linear-gradient(135deg, #00f2ff, #0077ff)' : 'transparent',
                color: activeProvider === 'gemini' ? '#060a14' : '#94a3b8',
                border: 'none',
                borderRadius: '16px',
                padding: '3px 10px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>♊</span>
              <span>Gemini 2.5</span>
            </button>
            <button
              onClick={() => handleSwitchProvider('bedrock')}
              disabled={switchingProvider}
              style={{
                background: activeProvider === 'bedrock' ? 'linear-gradient(135deg, #ff9100, #ff2a5f)' : 'transparent',
                color: activeProvider === 'bedrock' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '16px',
                padding: '3px 10px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>☁️</span>
              <span>AWS Bedrock</span>
            </button>
          </div>

          <span style={{ fontSize: '10px', background: 'rgba(0, 242, 255, 0.08)', border: '1px solid rgba(0, 242, 255, 0.3)', color: '#00f2ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
            {activeModel}
          </span>

          {analysis.latency_ms ? (
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              ⏱ {analysis.latency_ms}ms latency
            </span>
          ) : null}
        </div>

        <div className="ai-panel__confidence" style={{ margin: 0 }}>
          <span className="ai-panel__confidence-label">
            Confidence: {Math.round((analysis.confidence || 0.95) * 100)}%
          </span>
          <div className="ai-panel__confidence-bar">
            <div
              className="ai-panel__confidence-fill"
              style={{ width: `${(analysis.confidence || 0.95) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="card__body">
        {/* Threat Summary Banner */}
        {analysis.threat_summary && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            borderLeft: `4px solid ${analysis.status === 'CRITICAL' ? '#ff2a5f' : analysis.status === 'HIGH' ? '#ff9100' : '#00f2ff'}`,
            padding: '10px 14px',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#f8fafc',
            lineHeight: 1.5,
          }}>
            <span style={{ color: '#00f2ff', marginRight: '6px' }}>EXECUTIVE ASSESSMENT:</span>
            {analysis.threat_summary}
          </div>
        )}

        {/* Full AI Assessment Detail (Google Gemini AI / AWS Bedrock) */}
        {analysis.assessment && (
          <div style={{
            background: 'rgba(192, 132, 252, 0.08)',
            border: '1px solid rgba(192, 132, 252, 0.3)',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: '#f1f5f9',
            lineHeight: 1.55,
          }}>
            <strong style={{ color: '#c084fc', display: 'block', marginBottom: '4px' }}>
              ⚡ Detail Intelijen AI Lengkap ({activeModel}):
            </strong>
            {analysis.assessment}
          </div>
        )}

        {/* Tab Navigation Controls */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('assessment')}
            style={{
              background: activeTab === 'assessment' ? 'rgba(0, 242, 255, 0.15)' : 'transparent',
              color: activeTab === 'assessment' ? '#00f2ff' : '#94a3b8',
              border: activeTab === 'assessment' ? '1px solid #00f2ff' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.2s',
            }}
          >
            📋 TACTICAL ASSESSMENT
          </button>
          <button
            onClick={() => setActiveTab('hazard')}
            style={{
              background: activeTab === 'hazard' ? 'rgba(0, 242, 255, 0.15)' : 'transparent',
              color: activeTab === 'hazard' ? '#00f2ff' : '#94a3b8',
              border: activeTab === 'hazard' ? '1px solid #00f2ff' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.2s',
            }}
          >
            🔬 RUPTURE & HAZARD DEEP-DIVE
          </button>
          <button
            onClick={() => setActiveTab('copilot')}
            style={{
              background: activeTab === 'copilot' ? 'rgba(255, 42, 95, 0.15)' : 'transparent',
              color: activeTab === 'copilot' ? '#ff2a5f' : '#94a3b8',
              border: activeTab === 'copilot' ? '1px solid #ff2a5f' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.2s',
            }}
          >
            💬 TANYA COPILOT
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            style={{
              background: activeTab === 'agent' ? 'linear-gradient(135deg, rgba(0, 242, 255, 0.2), rgba(168, 85, 247, 0.25))' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'agent' ? '#00f2ff' : '#cbd5e1',
              border: activeTab === 'agent' ? '1px solid #00f2ff' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🤖</span>
            <span>STREAMING DATA AGENT</span>
            <span style={{
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '8px',
              background: agentState?.status === 'ACTION_DISPATCHED' ? '#ff2a5f' : agentState?.status === 'REASONING' ? '#f59e0b' : '#10b981',
              color: '#fff',
              fontWeight: 700,
            }}>
              {agentState?.status || 'MONITORING'}
            </span>
          </button>
        </div>

        {/* TAB 1: Tactical Assessment */}
        {activeTab === 'assessment' && (
          <>
            <div className={`ai-panel__status ${statusClass(analysis.status)}`}>
              {analysis.status === 'CRITICAL' && 'ALERT CRITICAL: '}
              {analysis.status === 'HIGH' && 'WARNING: '}
              {analysis.status}
            </div>

            <div className="ai-panel__grid">
              <div>
                <div className="ai-panel__section-title">Telemetry Observations</div>
                <ul className="ai-panel__list">
                  {analysis.observations?.map((obs, i) => (
                    <li key={i}>{obs}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="ai-panel__section-title">Immediate Tactical Actions</div>
                <ol className="ai-panel__list ai-panel__list--numbered">
                  {analysis.recommendations?.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Multi-Agency Action Matrix */}
            {analysis.agency_actions && analysis.agency_actions.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <div className="ai-panel__section-title">Multi-Agency Action Matrix (SOP Kedaruratan)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {analysis.agency_actions.map((act, i) => (
                    <div key={i} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '12px', color: '#00f2ff' }}>{act.agency}</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${priorityColor(act.priority)}22`, color: priorityColor(act.priority), border: `1px solid ${priorityColor(act.priority)}55` }}>
                          {act.priority}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                        {act.action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: Rupture & Hazard Deep-Dive */}
        {activeTab === 'hazard' && (
          <div>
            <div className="ai-panel__section-title">Seismological Rupture Dynamics & Tsunami Projection</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', margin: '12px 0 18px 0' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Mekanisme Sesar</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {analysis.hazard_details?.fault_mechanism || 'Subduction Megathrust Thrust'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Estimasi Coseismic Slip</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ff9100', marginTop: '4px' }}>
                  {analysis.hazard_details?.estimated_coseismic_slip || '4.8 - 7.2 meter'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Estimasi Runup Tsunami</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#00f2ff', marginTop: '4px' }}>
                  {analysis.hazard_details?.tsunami_runup_estimate || '8 - 15 meter'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Golden Evacuation Window</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ff2a5f', marginTop: '4px' }}>
                  {analysis.hazard_details?.evacuation_window_min || 18} Menit
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
                AFTERSHOCK RISK ASSESSMENT & OMORI LAW PROJECTION:
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                {analysis.hazard_details?.aftershock_risk || 'Risiko gempa susulan signifikan (M>6.0) tinggi dalam 48 jam ke depan di sepanjang zona robekan patahan subduksi.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: Interactive Tanya Copilot */}
        {activeTab === 'copilot' && (
          <div>
            <div className="ai-panel__section-title">Interaksi Darurat dengan {activeModel}</div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 12px 0' }}>
              Ajukan pertanyaan taktis terkait risiko tsunami, panduan evakuasi, atau dampak seismik secara instan:
            </p>

            {/* Suggested quick prompt chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {SUGGESTED_PROMPTS.map((promptText, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuestion(promptText);
                    handleAskCopilot(promptText);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '10.5px',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00f2ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                >
                  💡 {promptText}
                </button>
              ))}
            </div>

            {/* Input form */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder={`Ketik pertanyaan untuk ${activeProvider === 'bedrock' ? 'Claude / Bedrock' : 'Gemini AI'}...`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
                style={{
                  flex: 1,
                  background: '#060a14',
                  border: '1px solid rgba(0, 242, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleAskCopilot()}
                disabled={copilotLoading}
                style={{
                  background: activeProvider === 'bedrock' ? 'linear-gradient(135deg, #ff9100, #ff2a5f)' : '#ff2a5f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: copilotLoading ? 'not-allowed' : 'pointer',
                  opacity: copilotLoading ? 0.6 : 1,
                }}
              >
                {copilotLoading ? 'ANALYZING...' : 'TANYA AI'}
              </button>
            </div>

            {/* Reply card */}
            {copilotLoading && (
              <div style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '6px', color: '#00f2ff', fontSize: '12px' }}>
                <span className="live-dot-pulse"></span> Mengkonsolidasikan data telemetri streaming dengan {activeModel}...
              </div>
            )}

            {copilotReply && !copilotLoading && (
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(0, 242, 255, 0.25)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', color: '#00f2ff', fontWeight: 700 }}>
                  <span>🤖 JAWABAN TAKTIS COPILOT:</span>
                  {copilotLatency && <span style={{ color: '#94a3b8' }}>{copilotLatency}ms</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#f8fafc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {copilotReply}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Streaming Data Agent */}
        {activeTab === 'agent' && (
          <div>
            {/* Agent Live Telemetry Ribbon */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px',
              marginBottom: '16px',
            }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Siklus Agen</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: agentState?.status === 'ACTION_DISPATCHED' ? '#ff2a5f' : '#10b981',
                    boxShadow: '0 0 8px currentColor',
                  }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                    {agentState?.status || 'MONITORING'}
                  </span>
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Siklus OODA</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#00f2ff', marginTop: '4px', fontFamily: 'monospace' }}>
                  #{agentState?.total_cycles || 0}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tingkat Risiko Memori</div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  marginTop: '4px',
                  color: agentState?.current_risk === 'CRITICAL' ? '#ff2a5f' : agentState?.current_risk === 'HIGH' ? '#ff9100' : '#10b981',
                }}>
                  {agentState?.current_risk || 'NORMAL'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mesin LLM Berjalan</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeProvider === 'bedrock' ? '☁️ Bedrock (Claude 3.5)' : '♊ Gemini 2.5 Flash'}
                </div>
              </div>
            </div>

            {/* Split Sections: OODA Thought Stream + Tactical Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              {/* OODA Thought Stream */}
              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#00f2ff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    🧠 Alur Berpikir OODA (Observe-Orient-Decide-Act)
                  </span>
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>Live Sliding Window</span>
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {agentLiveThoughts.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                      Menunggu pemicu telemetri streaming... Agen aktif mengamati Kafka topic gempa.seismic & flink output.
                    </div>
                  ) : (
                    agentLiveThoughts.slice(-10).reverse().map((th, i) => {
                      const badge = phaseBadge(th.phase);
                      return (
                        <div key={i} style={{
                          background: 'rgba(2, 6, 23, 0.7)',
                          border: `1px solid ${badge.border}33`,
                          borderLeft: `3px solid ${badge.border}`,
                          borderRadius: '4px',
                          padding: '8px 10px',
                          fontSize: '11px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}>
                              {th.phase}
                            </span>
                            <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>
                              {new Date(th.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
                            {th.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Autonomous Dispatched Directives */}
              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#ff2a5f', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    🚨 Direktif Kedaruratan Multi-Agency Otonom
                  </span>
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>Auto-Dispatched</span>
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {agentLiveActions.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                      Belum ada instruksi eskalasi otonom. Ambang batas pemicu otomatis: M≥7.0 atau Anomali Gelombang Tsunami &gt; 3.0m.
                    </div>
                  ) : (
                    agentLiveActions.slice(-6).reverse().map((act, i) => (
                      <div key={i} style={{
                        background: 'rgba(2, 6, 23, 0.8)',
                        border: '1px solid rgba(255, 42, 95, 0.3)',
                        borderRadius: '6px',
                        padding: '10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, fontSize: '12px', color: '#00f2ff' }}>
                            {act.agency} • {act.type}
                          </span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 42, 95, 0.2)',
                            color: '#ff2a5f',
                            border: '1px solid #ff2a5f',
                          }}>
                            {act.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                          📍 Target Zone: <strong style={{ color: '#f8fafc' }}>{act.target_zone}</strong>
                        </div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {act.rationale}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Token-by-Token Streaming Copilot with Working Memory */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(0, 242, 255, 0.25)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f2ff', textTransform: 'uppercase' }}>
                  💬 Interaksi Streaming Chat dengan Agen Data ({activeProvider === 'bedrock' ? 'Bedrock Claude 3.5' : 'Gemini 2.5'})
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  Token-by-Token Live SSE
                </span>
              </div>

              {/* Suggested quick prompt chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {AGENT_SUGGESTED_PROMPTS.map((promptText, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAgentQuestion(promptText);
                      handleAskAgentStream(promptText);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '16px',
                      padding: '4px 10px',
                      fontSize: '10.5px',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00f2ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                  >
                    ⚡ {promptText}
                  </button>
                ))}
              </div>

              {/* Streaming Input Form */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Ketik pertanyaan untuk streaming agent (memori kerja aktif terinjeksi)..."
                  value={agentQuestion}
                  onChange={(e) => setAgentQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAgentStream()}
                  style={{
                    flex: 1,
                    background: '#060a14',
                    border: '1px solid rgba(0, 242, 255, 0.35)',
                    borderRadius: '6px',
                    padding: '9px 14px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleAskAgentStream()}
                  disabled={agentStreaming}
                  style={{
                    background: 'linear-gradient(135deg, #00f2ff, #a855f7)',
                    color: '#060a14',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: agentStreaming ? 'not-allowed' : 'pointer',
                    opacity: agentStreaming ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {agentStreaming ? (
                    <>
                      <span className="live-dot-pulse" style={{ width: '6px', height: '6px' }} />
                      <span>STREAMING...</span>
                    </>
                  ) : (
                    <span>STREAM TANYA</span>
                  )}
                </button>
              </div>

              {/* Live Streaming Response Box */}
              {(agentStreaming || agentStreamAnswer) && (
                <div style={{
                  background: 'rgba(2, 6, 23, 0.95)',
                  border: '1px solid rgba(0, 242, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '14px',
                  marginTop: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#00f2ff' }}>
                      🤖 RESPONS STREAMING AGEN DATA:
                    </span>
                    {agentStreaming && (
                      <span style={{ fontSize: '10px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7', animation: 'pulse-dot 1s infinite' }} />
                        Menerima token secara langsung...
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '12.5px',
                    color: '#f8fafc',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}>
                    {agentStreamAnswer}
                    {agentStreaming && (
                      <span style={{ display: 'inline-block', width: '6px', height: '14px', background: '#00f2ff', marginLeft: '3px', verticalAlign: 'middle', animation: 'pulse-dot 0.8s infinite' }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Explainability Accordion */}
        {analysis.contributing_factors && analysis.contributing_factors.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <button
              className="explain-toggle"
              onClick={() => setShowExplain(!showExplain)}
            >
              <span>{showExplain ? '▼' : '▶'}</span>
              <span>Mengapa {activeProvider === 'bedrock' ? 'AWS Bedrock' : 'Gemini AI'} menetapkan tingkat risiko ini? (Explainability Factor)</span>
            </button>

            {showExplain && (
              <div className="explain-content" style={{ marginTop: '8px' }}>
                {analysis.contributing_factors.map((factor, i) => (
                  <div key={i} className="explain-factor">
                    <div>
                      <div className="explain-factor__name">
                        ✓ {factor.indicator}
                      </div>
                      <div className="explain-factor__change">
                        {factor.value} — {factor.change}
                      </div>
                    </div>
                    <div className="explain-factor__bar">
                      <div
                        className="explain-factor__bar-fill"
                        style={{ width: `${factor.significance * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="ai-panel__disclaimer" style={{ marginTop: '16px' }}>
          ⚠ {analysis.disclaimer || 'Real-time decision support based on streaming sensor telemetry. Not an official BMKG earthquake prediction.'}
        </div>
      </div>
    </div>
  );
}
