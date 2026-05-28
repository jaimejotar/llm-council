import { useState, useMemo } from 'react';
import './CouncilModal.css';

const TYPICAL_INPUT_TOKENS = 1500;
const TYPICAL_OUTPUT_TOKENS = 500;

function estimateCost(modelIds, catalog) {
  const index = Object.fromEntries(catalog.map((m) => [m.id, m]));
  let totalCost = 0;
  let knownCount = 0;
  let sumInput = 0;
  let sumOutput = 0;
  for (const id of modelIds) {
    const m = index[id];
    if (!m) continue;
    knownCount++;
    totalCost +=
      (m.input_price_per_1m * TYPICAL_INPUT_TOKENS) / 1_000_000 +
      (m.output_price_per_1m * TYPICAL_OUTPUT_TOKENS) / 1_000_000;
    sumInput += m.input_price_per_1m;
    sumOutput += m.output_price_per_1m;
  }
  return {
    perQuery: totalCost,
    avgInput: knownCount ? sumInput / knownCount : 0,
    avgOutput: knownCount ? sumOutput / knownCount : 0,
  };
}

function fmt(n, decimals = 4) {
  return n.toFixed(decimals);
}

// --- Presets tab ---
function PresetsTab({ councils, catalog, onEdit, onDelete, onStartNew }) {
  return (
    <div className="cm-presets">
      {councils.map((c) => {
        const cost = estimateCost(c.models, catalog);
        return (
          <div key={c.id} className="cm-card">
            <div className="cm-card-top">
              {c.is_preset && <span className="cm-badge">PRESET</span>}
              <div className="cm-card-name">{c.name}</div>
              <div className="cm-card-models">
                {c.models.slice(0, 3).map((m) => {
                  const label = m.split('/')[1] || m;
                  return (
                    <span key={m} className="cm-pill">{label}</span>
                  );
                })}
                {c.models.length > 3 && (
                  <span className="cm-pill cm-pill-more">+{c.models.length - 3}</span>
                )}
              </div>
              <div className="cm-card-cost">
                ~${fmt(cost.perQuery, 4)} / query
              </div>
            </div>
            <div className="cm-card-actions">
              <button className="cm-btn-sm" onClick={() => onEdit(c)}>Editar</button>
              <button className="cm-btn-sm cm-btn-danger" onClick={() => onDelete(c)}>Eliminar</button>
            </div>
          </div>
        );
      })}
      <button className="cm-card cm-card-add" onClick={onStartNew}>
        + Nuevo consejo
      </button>
    </div>
  );
}

// --- Editor tab ---
function EditorTab({ council, setCouncil, catalog, onSave, onCancel }) {
  const [search, setSearch] = useState('');

  const cost = useMemo(
    () => estimateCost(council.models, catalog),
    [council.models, catalog]
  );

  const catalogIndex = useMemo(
    () => Object.fromEntries(catalog.map((m) => [m.id, m])),
    [catalog]
  );

  const filteredCatalog = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const addModel = (modelId) => {
    if (council.models.includes(modelId)) return;
    const newModels = [...council.models, modelId];
    const newChairman = council.chairman || newModels[0];
    setCouncil({ ...council, models: newModels, chairman: newChairman });
  };

  const removeModel = (modelId) => {
    const newModels = council.models.filter((m) => m !== modelId);
    const newChairman =
      council.chairman === modelId ? newModels[0] || '' : council.chairman;
    setCouncil({ ...council, models: newModels, chairman: newChairman });
  };

  const isValid = council.name.trim() && council.models.length > 0 && council.chairman;

  return (
    <div className="cm-editor">
      <div className="cm-editor-name">
        <label>Nombre del consejo</label>
        <input
          className="cm-input"
          value={council.name}
          onChange={(e) => setCouncil({ ...council, name: e.target.value })}
          placeholder="Ej. Análisis Profundo"
        />
      </div>

      <div className="cm-editor-cols">
        {/* Left: member list */}
        <div className="cm-editor-col">
          <div className="cm-col-title">Miembros del consejo</div>

          {council.models.length === 0 && (
            <div className="cm-empty-members">Agrega modelos desde el panel derecho</div>
          )}

          {council.models.map((id) => {
            const m = catalogIndex[id];
            const label = m ? m.name : id.split('/')[1] || id;
            const isChair = council.chairman === id;
            return (
              <div key={id} className="cm-member-row">
                <div className="cm-member-info">
                  <span className="cm-member-name">{label}</span>
                  {isChair && <span className="cm-chair-badge">⭐ Chair</span>}
                  {m && (
                    <span className="cm-member-price">
                      ${m.input_price_per_1m}/${m.output_price_per_1m}
                    </span>
                  )}
                </div>
                <div className="cm-member-actions">
                  {!isChair && (
                    <button
                      className="cm-btn-sm"
                      title="Establecer como chairman"
                      onClick={() => setCouncil({ ...council, chairman: id })}
                    >
                      ⭐
                    </button>
                  )}
                  <button
                    className="cm-btn-remove"
                    onClick={() => removeModel(id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {council.models.length > 0 && (
            <div className="cm-cost-box">
              <div className="cm-cost-title">💰 Estimación de costos</div>
              <div className="cm-cost-row">
                <span>Por 1M tokens (input avg)</span>
                <span className="cm-cost-val">${fmt(cost.avgInput, 2)}</span>
              </div>
              <div className="cm-cost-row">
                <span>Por 1M tokens (output avg)</span>
                <span className="cm-cost-val">${fmt(cost.avgOutput, 2)}</span>
              </div>
              <div className="cm-cost-row">
                <span>Por query típica (~2k tokens)</span>
                <span className="cm-cost-val">~${fmt(cost.perQuery, 5)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: model search */}
        <div className="cm-editor-col">
          <div className="cm-col-title">Agregar modelo</div>
          <input
            className="cm-input"
            placeholder="🔍 Buscar modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="cm-catalog-list">
            {filteredCatalog.map((m) => {
              const inList = council.models.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`cm-catalog-row ${inList ? 'cm-catalog-row-added' : ''}`}
                  onClick={() => !inList && addModel(m.id)}
                >
                  <div>
                    <span className="cm-catalog-name">{m.name}</span>
                    {inList && <span className="cm-in-list"> ✓ ya en lista</span>}
                  </div>
                  <span className="cm-catalog-price">
                    ${m.input_price_per_1m}/${m.output_price_per_1m}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="cm-editor-footer">
        <button className="cm-btn-cancel" onClick={onCancel}>Cancelar</button>
        <button
          className="cm-btn-save"
          disabled={!isValid}
          onClick={() => onSave(council)}
        >
          Guardar consejo
        </button>
      </div>
    </div>
  );
}

// --- Catalog tab ---
function CatalogTab({ catalog }) {
  const [filterTier, setFilterTier] = useState('');
  const [filterProvider, setFilterProvider] = useState('');

  const providers = useMemo(
    () => [...new Set(catalog.map((m) => m.provider))].sort(),
    [catalog]
  );

  const filtered = useMemo(
    () =>
      catalog.filter(
        (m) =>
          (!filterTier || m.tier === filterTier) &&
          (!filterProvider || m.provider === filterProvider)
      ),
    [catalog, filterTier, filterProvider]
  );

  const tiers = ['cheap', 'mid', 'premium'];

  return (
    <div className="cm-catalog">
      <div className="cm-catalog-filters">
        <div className="cm-tier-chips">
          {tiers.map((t) => (
            <button
              key={t}
              className={`cm-tier-chip ${filterTier === t ? 'active' : ''}`}
              onClick={() => setFilterTier(filterTier === t ? '' : t)}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          className="cm-select"
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
        >
          <option value="">Todos los providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <table className="cm-table">
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Provider</th>
            <th>Input /1M</th>
            <th>Output /1M</th>
            <th>Context</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id}>
              <td className="cm-table-name">{m.name}</td>
              <td>{m.provider}</td>
              <td>${m.input_price_per_1m}</td>
              <td>${m.output_price_per_1m}</td>
              <td>{(m.context_window / 1000).toFixed(0)}k</td>
              <td>
                <span className={`cm-tier-label cm-tier-${m.tier}`}>{m.tier}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main modal ---
const EMPTY_COUNCIL = { name: '', models: [], chairman: '' };

export default function CouncilModal({ isOpen, onClose, councils, catalog, onSave, onDelete }) {
  const [activeTab, setActiveTab] = useState('presets');
  const [editingCouncil, setEditingCouncil] = useState(null);

  if (!isOpen) return null;

  const handleEdit = (council) => {
    setEditingCouncil({ ...council, models: [...council.models] });
    setActiveTab('editor');
  };

  const handleStartNew = () => {
    setEditingCouncil({ ...EMPTY_COUNCIL });
    setActiveTab('editor');
  };

  const handleSave = async (council) => {
    await onSave(council);
    setEditingCouncil(null);
    setActiveTab('presets');
  };

  const handleCancelEdit = () => {
    setEditingCouncil(null);
    setActiveTab('presets');
  };

  const handleDelete = async (council) => {
    if (!window.confirm(`¿Eliminar el consejo "${council.name}"?`)) return;
    await onDelete(council.id);
  };

  const tabs = [
    { id: 'presets', label: 'Presets' },
    { id: 'editor', label: editingCouncil?.id ? 'Editar' : 'Nuevo' },
    { id: 'catalog', label: 'Catálogo' },
  ];

  return (
    <div className="cm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cm-modal">
        <div className="cm-header">
          <span className="cm-title">⚙️ Configurar Consejos</span>
          <button className="cm-close" onClick={onClose}>×</button>
        </div>

        <div className="cm-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`cm-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="cm-body">
          {activeTab === 'presets' && (
            <PresetsTab
              councils={councils}
              catalog={catalog}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStartNew={handleStartNew}
            />
          )}
          {activeTab === 'editor' && (
            <EditorTab
              council={editingCouncil || { ...EMPTY_COUNCIL }}
              setCouncil={setEditingCouncil}
              catalog={catalog}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          )}
          {activeTab === 'catalog' && <CatalogTab catalog={catalog} />}
        </div>
      </div>
    </div>
  );
}
