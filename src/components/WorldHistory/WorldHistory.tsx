import { useState } from 'react';
import { useWorldStore } from '../../store/worldContext';
import { useAppStore } from '../../store/context';
import type { Checkpoint } from '../../types';
import styles from './WorldHistory.module.css';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  onClose: () => void;
}

export function WorldHistory({ onClose }: Props) {
  const { checkpoints, saveCheckpoint, restoreCheckpoint, deleteCheckpoint } = useWorldStore();
  const { state, dispatch } = useAppStore();
  const [labelInput, setLabelInput] = useState('');

  function handleSave() {
    const label = labelInput.trim() || `Checkpoint — ${state.events.length} eventos`;
    saveCheckpoint(label, state);
    setLabelInput('');
  }

  function handleRestore(cp: Checkpoint) {
    if (!confirm(`Restaurar para "${cp.label}"?\nO estado atual será perdido (exceto checkpoints).`)) return;
    const restored = restoreCheckpoint(cp);
    dispatch({ type: 'IMPORT_STATE', payload: restored });
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>🕐 Histórico de Versões</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className={styles.saveArea}>
          <input
            className={styles.labelInput}
            placeholder="Nome do ponto de restauração (opcional)..."
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            Salvar checkpoint
          </button>
        </div>

        <p className={styles.hint}>
          Máximo 10 checkpoints. Salvar um novo remove o mais antigo quando o limite é atingido.
        </p>

        <div className={styles.list}>
          {checkpoints.length === 0 && (
            <p className={styles.empty}>Nenhum checkpoint salvo ainda.</p>
          )}
          {checkpoints.map(cp => (
            <div key={cp.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemLabel}>{cp.label}</span>
                <span className={styles.itemMeta}>
                  {formatDateTime(cp.timestamp)} · {cp.eventCount} evento{cp.eventCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRestore(cp)}
                  title="Restaurar este checkpoint"
                >
                  ↩ Restaurar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (confirm('Deletar este checkpoint?')) deleteCheckpoint(cp.id);
                  }}
                  title="Deletar checkpoint"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
