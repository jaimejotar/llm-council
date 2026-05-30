/**
 * Shared cost UI primitives used by Stage1/Stage2/Stage3 and ChatInterface.
 *
 * - <CostBadge usage /> — compact pill: "↑ 1.2k · ↓ 234 · $0.0034"
 * - <StageCostBreakdown items /> — collapsible table per model, summed
 * - <TurnCostSummary message /> — one-line summary for a finished assistant message
 * - <ConversationCostSummary messages /> — final block with per-stage + grand total
 *
 * All cost data comes from OpenRouter's `usage.cost` field already attached
 * to every stage result by the backend.
 */

import { fmtUsd, fmtTokens, sumUsages, summarizeMessage, summarizeConversation } from '../utils/pricing';
import './CostElements.css';

const shortModel = (id) => (id ? id.split('/')[1] || id : '');

/* ---------- per-response inline badge ---------- */

export function CostBadge({ usage }) {
  if (!usage) return null;
  return (
    <span className="cost-badge" title="Tokens y costo de esta llamada (datos exactos de OpenRouter)">
      <span className="cb-arrow">↑</span>{fmtTokens(usage.prompt_tokens)}
      <span className="cb-dot">·</span>
      <span className="cb-arrow">↓</span>{fmtTokens(usage.completion_tokens)}
      <span className="cb-dot">·</span>
      <span className="cb-cost">{fmtUsd(usage.cost)}</span>
    </span>
  );
}

/* ---------- per-stage collapsible breakdown ---------- */

/**
 * @param items array of { model, usage }
 * @param label string shown in summary (e.g. "Costos del stage")
 */
export function StageCostBreakdown({ items, label = 'Ver costos del stage' }) {
  const rows = (items || []).filter((it) => it && it.usage);
  if (rows.length === 0) return null;
  const total = sumUsages(rows.map((r) => r.usage));
  return (
    <details className="cost-expand">
      <summary>
        <span className="ce-summary-label">+ {label}</span>
        <span className="ce-summary-totals">
          {fmtTokens(total.total_tokens)} tokens · {fmtUsd(total.cost)}
        </span>
      </summary>
      <table className="cost-table">
        <thead>
          <tr>
            <th>Modelo</th>
            <th className="num">Input</th>
            <th className="num">Output</th>
            <th className="num">Total tok</th>
            <th className="num">Costo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model}>
              <td>{shortModel(r.model)}</td>
              <td className="num">{fmtTokens(r.usage.prompt_tokens)}</td>
              <td className="num">{fmtTokens(r.usage.completion_tokens)}</td>
              <td className="num">{fmtTokens(r.usage.total_tokens)}</td>
              <td className="num">{fmtUsd(r.usage.cost)}</td>
            </tr>
          ))}
          <tr className="cost-total-row">
            <td>Total</td>
            <td className="num">{fmtTokens(total.prompt_tokens)}</td>
            <td className="num">{fmtTokens(total.completion_tokens)}</td>
            <td className="num">{fmtTokens(total.total_tokens)}</td>
            <td className="num">{fmtUsd(total.cost)}</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

/* ---------- per-turn one-liner ---------- */

export function TurnCostSummary({ message }) {
  const summary = summarizeMessage(message);
  if (!summary || !summary.total.has_any) return null;
  return (
    <div className="turn-summary">
      <span className="ts-label">Turno</span>
      <span className="ts-sep">·</span>
      <span className="ts-cost">{fmtUsd(summary.total.cost)}</span>
      <span className="ts-sep">·</span>
      <span className="ts-tokens">{fmtTokens(summary.total.total_tokens)} tokens</span>
      <span className="ts-detail">
        (S1 {fmtUsd(summary.stage1.cost)} · S2 {fmtUsd(summary.stage2.cost)} · S3 {fmtUsd(summary.stage3.cost)})
      </span>
    </div>
  );
}

/* ---------- conversation grand total ---------- */

function StageRow({ label, usage, models }) {
  const hasModels = (models || []).length > 0;
  return (
    <details className="cs-stage-row" open={false}>
      <summary>
        <span className="cs-stage-toggle">{hasModels ? '+' : ''}</span>
        <span className="cs-stage-label">{label}</span>
        <span className="cs-stage-in">↑ {fmtTokens(usage.prompt_tokens)}</span>
        <span className="cs-stage-out">↓ {fmtTokens(usage.completion_tokens)}</span>
        <span className="cs-stage-tot">{fmtTokens(usage.total_tokens)} tok</span>
        <span className="cs-stage-cost">{fmtUsd(usage.cost)}</span>
      </summary>
      {hasModels && (
        <div className="cs-stage-detail">
          <table className="cost-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th className="num">Llamadas</th>
                <th className="num">Input</th>
                <th className="num">Output</th>
                <th className="num">Total tok</th>
                <th className="num">Costo</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model}>
                  <td>{shortModel(m.model)}</td>
                  <td className="num">{m.usage.calls}</td>
                  <td className="num">{fmtTokens(m.usage.prompt_tokens)}</td>
                  <td className="num">{fmtTokens(m.usage.completion_tokens)}</td>
                  <td className="num">{fmtTokens(m.usage.total_tokens)}</td>
                  <td className="num">{fmtUsd(m.usage.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

export function ConversationCostSummary({ messages }) {
  const summary = summarizeConversation(messages);
  if (!summary || !summary.total.has_any) return null;
  return (
    <div className="conversation-summary">
      <div className="cs-header">
        Conversación completa <span className="cs-turns">({summary.turns} {summary.turns === 1 ? 'turno' : 'turnos'})</span>
      </div>
      <div className="cs-body">
        <StageRow label="Stage 1 — Respuestas individuales" usage={summary.stage1} models={summary.byStage.stage1} />
        <StageRow label="Stage 2 — Rankings peer"           usage={summary.stage2} models={summary.byStage.stage2} />
        <StageRow label="Stage 3 — Síntesis chairman"        usage={summary.stage3} models={summary.byStage.stage3} />
        <div className="cs-total-row-new">
          <span className="cs-stage-toggle">{' '}</span>
          <span className="cs-stage-label">Total</span>
          <span className="cs-stage-in">↑ {fmtTokens(summary.total.prompt_tokens)}</span>
          <span className="cs-stage-out">↓ {fmtTokens(summary.total.completion_tokens)}</span>
          <span className="cs-stage-tot">{fmtTokens(summary.total.total_tokens)} tok</span>
          <span className="cs-stage-cost cs-grand-cost">{fmtUsd(summary.total.cost)}</span>
        </div>
      </div>
    </div>
  );
}
