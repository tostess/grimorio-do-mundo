import { useRef } from 'react';
import { useAppStore } from '../../store/context';
import { useWorldStore } from '../../store/worldContext';
import { useSessionStore } from '../../store/sessionContext';
import { exportState, importState } from '../../utils/storage';
import styles from './Header.module.css';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  onOpenSearch?: () => void;
  onOpenWorlds?: () => void;
  onOpenHistory?: () => void;
}

export function Header({ onOpenSearch, onOpenWorlds, onOpenHistory }: Props) {
  const { state, dispatch, savedAt } = useAppStore();
  const { worlds, activeWorldId } = useWorldStore();
  const { session } = useSessionStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const worldName = worlds.find(w => w.id === activeWorldId)?.name ?? state.setup.worldName;
  const worldSwitchLocked = session.role !== 'offline';

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importState(file)
      .then(imported => dispatch({ type: 'IMPORT_STATE', payload: imported }))
      .catch(err => alert(err.message));
    e.target.value = '';
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.icon}>📖</span>
        <div className={styles.titles}>
          <h1 className={styles.appName}>Grimório do Mundo</h1>
          <p className={styles.worldName}>{worldName}</p>
        </div>
      </div>
      <div className={styles.right}>
        {savedAt && (
          <span className={styles.savedAt} title={`Salvo em ${savedAt.toLocaleDateString('pt-BR')} às ${formatTime(savedAt)}`}>
            ✓ {formatTime(savedAt)}
          </span>
        )}
        {onOpenSearch && (
          <button className="btn btn-ghost btn-sm" onClick={onOpenSearch} title="Busca global (Ctrl+K)">
            <span className={styles.btnIcon}>🔍</span>
            <span className={styles.btnLabel}>Buscar</span>
          </button>
        )}
        {onOpenHistory && (
          <button className="btn btn-ghost btn-sm" onClick={onOpenHistory} title="Histórico de versões">
            <span className={styles.btnIcon}>🕐</span>
            <span className={styles.btnLabel}>Histórico</span>
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => exportState(state)} title="Exportar dados como JSON">
          <span className={styles.btnIcon}>↓</span>
          <span className={styles.btnLabel}>Exportar</span>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} title="Importar dados de arquivo JSON">
          <span className={styles.btnIcon}>↑</span>
          <span className={styles.btnLabel}>Importar</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        {onOpenWorlds && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={worldSwitchLocked ? undefined : onOpenWorlds}
            disabled={worldSwitchLocked}
            title={worldSwitchLocked ? 'Encerre a sessao antes de trocar de mundo' : 'Gerenciar campanhas'}
          >
            <span className={styles.btnIcon}>🌍</span>
            <span className={styles.btnLabel}>Mundos</span>
          </button>
        )}
      </div>
    </header>
  );
}
