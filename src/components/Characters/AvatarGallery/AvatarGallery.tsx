import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadAvatars,
  saveAvatar,
  deleteAvatar,
  readFileAsDataUrl,
  type AvatarEntry,
} from '../../../utils/avatarStorage';
import styles from './AvatarGallery.module.css';

export function AvatarGallery() {
  const [avatars, setAvatars] = useState<AvatarEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAvatars().then(a => {
      setAvatars(a);
      setLoading(false);
    });
  }, []);

  async function importFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (list.length === 0) return;
    const added: AvatarEntry[] = [];
    for (const file of list) {
      const dataUrl = await readFileAsDataUrl(file);
      const entry: AvatarEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: file.name.replace(/\.[^.]+$/, ''),
        dataUrl,
        createdAt: new Date().toISOString(),
      };
      await saveAvatar(entry);
      added.push(entry);
    }
    setAvatars(prev => [...prev, ...added]);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este avatar?')) return;
    await deleteAvatar(id);
    setAvatars(prev => prev.filter(a => a.id !== id));
    if (selected === id) setSelected(null);
  }

  async function handleRename(id: string, newName: string) {
    const avatar = avatars.find(a => a.id === id);
    if (!avatar || !newName.trim()) return;
    const updated = { ...avatar, name: newName.trim() };
    await saveAvatar(updated);
    setAvatars(prev => prev.map(a => (a.id === id ? updated : a)));
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    await importFiles(e.dataTransfer.files);
  }, []);

  if (loading) return <div className={styles.loading}>Carregando avatares...</div>;

  return (
    <div
      className={`${styles.gallery} ${dragging ? styles.dragging : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {avatars.length} avatar{avatars.length !== 1 ? 'es' : ''}
        </span>
        <button className={styles.addBtn} onClick={() => fileRef.current?.click()}>
          + Adicionar Avatares
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files) importFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {dragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropMsg}>🖼️ Solte as imagens aqui</div>
        </div>
      )}

      {avatars.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🖼️</div>
          <p className={styles.emptyTitle}>Nenhum avatar ainda</p>
          <p className={styles.emptyHint}>
            Clique em "Adicionar Avatares" ou arraste imagens para cá.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {avatars.map(avatar => (
            <AvatarCard
              key={avatar.id}
              avatar={avatar}
              selected={selected === avatar.id}
              onSelect={() => setSelected(selected === avatar.id ? null : avatar.id)}
              onDelete={() => handleDelete(avatar.id)}
              onRename={name => handleRename(avatar.id, name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AvatarCardProps {
  avatar: AvatarEntry;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

function AvatarCard({ avatar, selected, onSelect, onDelete, onRename }: AvatarCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(avatar.name);

  function commit() {
    if (editName.trim()) onRename(editName.trim());
    else setEditName(avatar.name);
    setEditing(false);
  }

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      title={avatar.name}
    >
      <div className={styles.imgWrap}>
        <img src={avatar.dataUrl} alt={avatar.name} className={styles.img} loading="lazy" />
        <button
          className={styles.deleteBtn}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Remover avatar"
        >
          ×
        </button>
        {selected && <div className={styles.selectedBadge}>✓</div>}
      </div>

      {editing ? (
        <input
          className={styles.nameInput}
          value={editName}
          autoFocus
          onChange={e => setEditName(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setEditName(avatar.name); setEditing(false); }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className={styles.name}
          onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
          title="Duplo-clique para renomear"
        >
          {avatar.name}
        </div>
      )}
    </div>
  );
}
