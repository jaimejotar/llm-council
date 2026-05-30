/**
 * Cost / token formatting helpers.
 *
 * Real costs come straight from OpenRouter's `usage.cost` (USD) attached to
 * every model response by the backend. This module only handles formatting
 * and aggregation — it does NOT recompute prices from a catalog.
 *
 * The legacy `estimateCost(modelIds, catalog)` is kept for the CouncilModal,
 * which estimates costs *before* a query is made (no usage data exists yet).
 */

const TYPICAL_INPUT_TOKENS = 1500;
const TYPICAL_OUTPUT_TOKENS = 500;

/**
 * Format a number with fixed decimals. Returns '-' for null/undefined.
 */
export function fmt(n, decimals = 4) {
  if (n == null || Number.isNaN(n)) return '-';
  return n.toFixed(decimals);
}

/**
 * Format a USD amount with adaptive precision.
 * <$0.01 → 5 decimals · <$1 → 4 decimals · else 2 decimals.
 */
export function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return '-';
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  let dec = 2;
  if (abs < 0.01) dec = 5;
  else if (abs < 1) dec = 4;
  return `$${n.toFixed(dec)}`;
}

/**
 * Format a token count with k/M suffixes for readability.
 *   1234   → '1.2k'
 *   12345  → '12.3k'
 *   1234567 → '1.23M'
 *   only smaller than 1000 → exact integer
 */
export function fmtTokens(n) {
  if (n == null || Number.isNaN(n)) return '-';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/**
 * Sum a list of `usage` objects produced by the backend.
 * Skips null/undefined entries gracefully.
 * Returns { prompt_tokens, completion_tokens, total_tokens, cost, has_partial }
 * where `has_partial` is true if any entry was missing.
 */
export function sumUsages(usages) {
  let prompt = 0;
  let completion = 0;
  let total = 0;
  let cost = 0;
  let hasAny = false;
  let hasPartial = false;
  for (const u of usages) {
    if (!u) {
      hasPartial = true;
      continue;
    }
    hasAny = true;
    prompt += u.prompt_tokens || 0;
    completion += u.completion_tokens || 0;
    total += u.total_tokens || 0;
    cost += typeof u.cost === 'number' ? u.cost : 0;
  }
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    cost,
    has_any: hasAny,
    has_partial: hasPartial,
  };
}

/**
 * Collect every usage from a full assistant message (stage1 + stage2 + stage3)
 * and return per-stage + total aggregates.
 */
export function summarizeMessage(message) {
  if (!message || message.role !== 'assistant') return null;
  const stage1Usages = (message.stage1 || []).map((s) => s.usage);
  const stage2Usages = (message.stage2 || []).map((s) => s.usage);
  const stage3Usage = message.stage3?.usage ? [message.stage3.usage] : [];
  const stage1 = sumUsages(stage1Usages);
  const stage2 = sumUsages(stage2Usages);
  const stage3 = sumUsages(stage3Usage);
  const total = sumUsages([
    { prompt_tokens: stage1.prompt_tokens + stage2.prompt_tokens + stage3.prompt_tokens,
      completion_tokens: stage1.completion_tokens + stage2.completion_tokens + stage3.completion_tokens,
      total_tokens: stage1.total_tokens + stage2.total_tokens + stage3.total_tokens,
      cost: stage1.cost + stage2.cost + stage3.cost,
    },
  ]);
  return { stage1, stage2, stage3, total };
}

/**
 * Aggregate cost summary across all assistant messages of a conversation.
 *
 * Returns:
 *   stage1, stage2, stage3, total  → aggregated usage objects
 *   turns                          → number of completed assistant turns
 *   byStage                        → { stage1: [{model, usage}], stage2: [...], stage3: [...] }
 *                                    each entry sums all calls to that model across every turn
 */
export function summarizeConversation(messages) {
  const assistantMsgs = (messages || []).filter((m) => m.role === 'assistant');
  const perTurn = assistantMsgs.map(summarizeMessage).filter(Boolean);
  if (perTurn.length === 0) return null;

  const stage1 = sumUsages(perTurn.map((t) => t.stage1));
  const stage2 = sumUsages(perTurn.map((t) => t.stage2));
  const stage3 = sumUsages(perTurn.map((t) => t.stage3));
  const total = sumUsages([
    {
      prompt_tokens: stage1.prompt_tokens + stage2.prompt_tokens + stage3.prompt_tokens,
      completion_tokens: stage1.completion_tokens + stage2.completion_tokens + stage3.completion_tokens,
      total_tokens: stage1.total_tokens + stage2.total_tokens + stage3.total_tokens,
      cost: stage1.cost + stage2.cost + stage3.cost,
    },
  ]);

  // Per-stage per-model aggregation across all turns.
  function aggregateByModel(getItems) {
    const byModel = new Map();
    for (const msg of assistantMsgs) {
      const items = getItems(msg) || [];
      for (const item of items) {
        if (!item || !item.usage) continue;
        const prev = byModel.get(item.model) || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost: 0,
          calls: 0,
        };
        prev.prompt_tokens += item.usage.prompt_tokens || 0;
        prev.completion_tokens += item.usage.completion_tokens || 0;
        prev.total_tokens += item.usage.total_tokens || 0;
        prev.cost += typeof item.usage.cost === 'number' ? item.usage.cost : 0;
        prev.calls += 1;
        byModel.set(item.model, prev);
      }
    }
    // Sort by cost desc, then total_tokens desc.
    return [...byModel.entries()]
      .map(([model, usage]) => ({ model, usage }))
      .sort((a, b) => (b.usage.cost - a.usage.cost) || (b.usage.total_tokens - a.usage.total_tokens));
  }

  const byStage = {
    stage1: aggregateByModel((m) => m.stage1),
    stage2: aggregateByModel((m) => m.stage2),
    stage3: aggregateByModel((m) => (m.stage3 ? [m.stage3] : [])),
  };

  return { stage1, stage2, stage3, total, turns: perTurn.length, byStage };
}

// --- Estimation (pre-query, no usage data) -----------------------------------
// Used by CouncilModal where the user picks models before running a query.

export function buildCatalogIndex(catalog) {
  return Object.fromEntries((catalog || []).map((m) => [m.id, m]));
}

/**
 * Estimate cost of one council query given the member model ids and the
 * pricing catalog. Uses TYPICAL token counts as a rough projection.
 *
 * Returns { perQuery, avgInput, avgOutput }.
 */
export function estimateCost(modelIds, catalog) {
  const index = buildCatalogIndex(catalog);
  let totalCost = 0;
  let known = 0;
  let sumInput = 0;
  let sumOutput = 0;
  for (const id of modelIds) {
    const m = index[id];
    if (!m) continue;
    known++;
    totalCost +=
      (m.input_price_per_1m * TYPICAL_INPUT_TOKENS) / 1_000_000 +
      (m.output_price_per_1m * TYPICAL_OUTPUT_TOKENS) / 1_000_000;
    sumInput += m.input_price_per_1m;
    sumOutput += m.output_price_per_1m;
  }
  return {
    perQuery: totalCost,
    avgInput: known ? sumInput / known : 0,
    avgOutput: known ? sumOutput / known : 0,
  };
}
