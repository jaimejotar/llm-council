import { useState } from 'react';
import './NewConversationDialog.css';

export default function NewConversationDialog({
  isOpen,
  councils,
  onConfirm,
  onCancel,
  onOpenCouncilModal,
}) {
  const [selectedId, setSelectedId] = useState(councils[0]?.id || '');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedId || councils[0]?.id || null);
  };

  return (
    <div className="ncd-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ncd-dialog">
        <div className="ncd-title">Nueva conversación</div>
        <div className="ncd-label">¿Con qué consejo quieres trabajar?</div>

        <select
          className="ncd-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {councils.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button className="ncd-link" onClick={onOpenCouncilModal}>
          ⚙️ Configurar consejos
        </button>

        <div className="ncd-actions">
          <button className="ncd-btn-cancel" onClick={onCancel}>Cancelar</button>
          <button className="ncd-btn-confirm" onClick={handleConfirm} disabled={!selectedId}>
            Crear conversación
          </button>
        </div>
      </div>
    </div>
  );
}
