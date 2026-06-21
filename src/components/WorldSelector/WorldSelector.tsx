import { useState, useRef } from 'react';
import { useWorldStore } from '../../store/worldContext';
import { importState, saveWorldState } from '../../utils/storage';
import type { WorldMeta } from '../../types';
import styles from './WorldSelector.module.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface WorldCardProps {
  world: WorldMeta;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

function WorldCard({ world, onSelect, onDelete, onRename }: WorldCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(world.name);

  function commitRename() {
    const name = draft.trim();
    if (name && name !== world.name) onRename(name);
    setEditing(false);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardIcon}>🌍</div>
      <div className={styles.cardBody}>
        {editing ? (
          <input
            className={styles.renameInput}
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(world.name); setEditing(false); }
            }}
          />
        ) : (
          <h3 className={styles.cardName} onClick={onSelect}>{world.name}</h3>
        )}
        <div className={styles.cardMeta}>
          <span>{world.eventCount} evento{world.eventCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>Atualizado {formatDate(world.updatedAt)}</span>
        </div>
      </div>
      <div className={styles.cardActions}>
        <button className="btn btn-ghost btn-sm" onClick={onSelect} title="Abrir mundo">
          Abrir
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setDraft(world.name); setEditing(true); }}
          title="Renomear"
        >
          ✏️
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (confirm(`Deletar "${world.name}"? Esta ação não pode ser desfeita.`)) onDelete();
          }}
          title="Deletar mundo"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

interface SelectorProps {
  onClose?: () => void;
}

export function WorldSelector({ onClose }: SelectorProps = {}) {
  const { worlds, createWorld, deleteWorld, renameWorld, switchWorld } = useWorldStore();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function select(id: string) {
    switchWorld(id);
    onClose?.();
  }

  function handleCreate() {
    const name = newName.trim() || 'Novo Mundo';
    const id = createWorld(name);
    select(id);
    setNewName('');
    setCreating(false);
  }

  function handleImportWorld(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importState(file)
      .then(state => {
        const id = createWorld(state.setup.worldName || file.name.replace('.json', ''));
        saveWorldState(id, state);
        select(id);
      })
      .catch(err => alert(err.message));
    e.target.value = '';
  }

  return (
    <div className={styles.overlay} onClick={onClose ? e => e.target === e.currentTarget && onClose() : undefined}>
      <div className={styles.container}>
        <div className={styles.header}>
          {onClose && (
            <button className={`btn btn-ghost btn-sm ${styles.closeBtn}`} onClick={onClose} aria-label="Fechar">✕</button>
          )}
          <span className={styles.headerIcon}>📖</span>
          <h1 className={styles.title}>Grimório do Mundo</h1>
          <p className={styles.subtitle}>Escolha ou crie uma campanha</p>
        </div>

        <div className={styles.worldList}>
          {worlds.length === 0 && (
            <p className={styles.empty}>Nenhuma campanha ainda. Crie a sua primeira!</p>
          )}
          {worlds.map(world => (
            <WorldCard
              key={world.id}
              world={world}
              onSelect={() => select(world.id)}
              onDelete={() => deleteWorld(world.id)}
              onRename={name => renameWorld(world.id, name)}
            />
          ))}
        </div>

        <div className={styles.footer}>
          {creating ? (
            <div className={styles.createForm}>
              <input
                className={styles.createInput}
                placeholder="Nome da campanha..."
                value={newName}
                autoFocus
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
              />
              <button className="btn btn-primary" onClick={handleCreate}>Criar</button>
              <button className="btn btn-ghost" onClick={() => { setCreating(false); setNewName(''); }}>
                Cancelar
              </button>
            </div>
          ) : (
            <div className={styles.footerActions}>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                ✦ Nova Campanha
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                title="Importar campanha de arquivo JSON"
              >
                ↑ Importar JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportWorld}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
