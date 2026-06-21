import { useState, useEffect } from 'react';
import type { GrimoireEvent } from '../../types';
import { DEFAULT_TYPES } from '../../types';
import { useAppStore } from '../../store/context';
import styles from './EventModal.module.css';

interface Props {
  event: GrimoireEvent | null;
  onClose: () => void;
  defaultValues?: Partial<Omit<GrimoireEvent, 'id'>>;
}

function emptyEvent(eras: string[], defaults: Partial<Omit<GrimoireEvent, 'id'>> = {}): Omit<GrimoireEvent, 'id'> {
  return {
    era: eras[0] ?? '',
    startYear: 1,
    startMonth: null,
    startDay: null,
    endYear: null,
    endMonth: null,
    endDay: null,
    name: '',
    significance: 'Major / Global',
    type: DEFAULT_TYPES[0],
    timeline: 'Principal',
    summary: '',
    trigger: '',
    result: '',
    location: '',
    chars: '',
    orgs: '',
    article: '',
    other: '',
    spoiler: 'not',
    personal: 'not',
    tags: [],
    masterNotes: '',
    ...defaults,
  };
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');

  function addTag(raw: string) {
    const clean = raw.trim().toLowerCase().replace(/,/g, '');
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
    else if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1));
  }

  return (
    <div className={styles.tagInputWrapper}>
      {tags.map(tag => (
        <span key={tag} className={styles.tagChip}>
          #{tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))}>✕</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => input && addTag(input)}
        placeholder={tags.length === 0 ? 'Adicionar tag (Enter ou vírgula)...' : ''}
        className={styles.tagInputField}
      />
    </div>
  );
}

export function EventModal({ event, onClose, defaultValues }: Props) {
  const { state, dispatch } = useAppStore();
  const allTypes = [...DEFAULT_TYPES, ...state.customTypes];

  const [form, setForm] = useState<Omit<GrimoireEvent, 'id'>>(
    event ? { ...event } : emptyEvent(state.eras, defaultValues)
  );
  const [activeTab, setActiveTab] = useState<'main' | 'details' | 'meta'>('main');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setForm(event ? { ...event } : emptyEvent(state.eras, defaultValues));
  }, [event, state.eras]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof Omit<GrimoireEvent, 'id'>>(key: K, value: Omit<GrimoireEvent, 'id'>[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function numOrNull(val: string): number | null {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }

  function handleSave() {
    if (!form.name.trim()) { alert('Nome do evento é obrigatório.'); return; }
    if (!form.era) { alert('Era é obrigatória.'); return; }
    if (!form.startYear) { alert('Ano de início é obrigatório.'); return; }

    if (event) {
      dispatch({ type: 'UPDATE_EVENT', payload: { ...form, id: event.id } });
    } else {
      dispatch({ type: 'ADD_EVENT', payload: form });
    }
    onClose();
  }

  function handleDelete() {
    if (!event) return;
    if (confirm(`Excluir "${event.name}"?`)) {
      dispatch({ type: 'DELETE_EVENT', payload: event.id });
      onClose();
    }
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{event ? 'Editar Evento' : 'Novo Evento'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.tabs}>
          {(['main', 'details', 'meta'] as const).map(t => (
            <button
              key={t}
              className={`${styles.tabBtn} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'main' ? '📋 Principal' : t === 'details' ? '📝 Detalhes' : '⚙️ Meta'}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {activeTab === 'main' && (
            <div className={styles.grid}>
              <div className={styles.fullRow}>
                <label>Nome do Evento *</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Nome do evento..."
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Era *</label>
                <select value={form.era} onChange={e => set('era', e.target.value)} style={{ width: '100%' }}>
                  {state.eras.map(era => <option key={era}>{era}</option>)}
                </select>
              </div>

              <div>
                <label>Tipo</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%' }}>
                  {allTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label>Significância</label>
                <select value={form.significance} onChange={e => set('significance', e.target.value)} style={{ width: '100%' }}>
                  {state.significance.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label>Linha do Tempo</label>
                <input
                  value={form.timeline}
                  onChange={e => set('timeline', e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div className={styles.dateRow}>
                <label>Data de Início</label>
                <div className={styles.dateFields}>
                  <input
                    type="number"
                    placeholder="Ano *"
                    value={form.startYear}
                    onChange={e => set('startYear', parseInt(e.target.value, 10) || 1)}
                    style={{ width: '90px' }}
                  />
                  <input
                    type="number"
                    placeholder="Mês"
                    min={1}
                    value={form.startMonth ?? ''}
                    onChange={e => set('startMonth', numOrNull(e.target.value))}
                    style={{ width: '70px' }}
                  />
                  <input
                    type="number"
                    placeholder="Dia"
                    min={1}
                    value={form.startDay ?? ''}
                    onChange={e => set('startDay', numOrNull(e.target.value))}
                    style={{ width: '70px' }}
                  />
                </div>
              </div>

              <div className={styles.dateRow}>
                <label>Data de Fim</label>
                <div className={styles.dateFields}>
                  <input
                    type="number"
                    placeholder="Ano"
                    value={form.endYear ?? ''}
                    onChange={e => set('endYear', numOrNull(e.target.value))}
                    style={{ width: '90px' }}
                  />
                  <input
                    type="number"
                    placeholder="Mês"
                    min={1}
                    value={form.endMonth ?? ''}
                    onChange={e => set('endMonth', numOrNull(e.target.value))}
                    style={{ width: '70px' }}
                  />
                  <input
                    type="number"
                    placeholder="Dia"
                    min={1}
                    value={form.endDay ?? ''}
                    onChange={e => set('endDay', numOrNull(e.target.value))}
                    style={{ width: '70px' }}
                  />
                </div>
              </div>

              <div>
                <label>Localização</label>
                <input
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="Cidade, região..."
                  style={{ width: '100%' }}
                />
              </div>

              <div className={styles.fullRow}>
                <label>Resumo</label>
                <textarea
                  value={form.summary}
                  onChange={e => set('summary', e.target.value)}
                  placeholder="O que aconteceu..."
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>

              <div className={styles.fullRow}>
                <label>Tags</label>
                <TagInput tags={form.tags ?? []} onChange={tags => set('tags', tags)} />
                <div className={styles.hint}>Enter ou vírgula para adicionar · Backspace para remover</div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className={styles.grid}>
              <div className={styles.fullRow}>
                <label>Gatilho / Causa</label>
                <textarea
                  value={form.trigger}
                  onChange={e => set('trigger', e.target.value)}
                  placeholder="O que causou este evento..."
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>
              <div className={styles.fullRow}>
                <label>Resultado / Consequência</label>
                <textarea
                  value={form.result}
                  onChange={e => set('result', e.target.value)}
                  placeholder="O que resultou deste evento..."
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label>Personagens Envolvidos</label>
                <textarea
                  value={form.chars}
                  onChange={e => set('chars', e.target.value)}
                  placeholder="Nomes separados por vírgula..."
                  rows={2}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label>Organizações Envolvidas</label>
                <textarea
                  value={form.orgs}
                  onChange={e => set('orgs', e.target.value)}
                  placeholder="Guildas, reinos, facções..."
                  rows={2}
                  style={{ width: '100%' }}
                />
              </div>
              <div className={styles.fullRow}>
                <label>Link de Artigo / Nota</label>
                <input
                  value={form.article}
                  onChange={e => set('article', e.target.value)}
                  placeholder="URL ou referência..."
                  style={{ width: '100%' }}
                />
              </div>
              <div className={styles.fullRow}>
                <label>Outras Notas</label>
                <textarea
                  value={form.other}
                  onChange={e => set('other', e.target.value)}
                  placeholder="Informações adicionais..."
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'meta' && (
            <div className={styles.grid}>
              <div>
                <label>Nível de Spoiler</label>
                <select value={form.spoiler} onChange={e => set('spoiler', e.target.value as GrimoireEvent['spoiler'])} style={{ width: '100%' }}>
                  <option value="not">Sem spoiler</option>
                  <option value="minor">Spoiler menor</option>
                  <option value="major">Spoiler maior</option>
                </select>
              </div>
              <div>
                <label>Evento Pessoal (Mestre)</label>
                <select value={form.personal} onChange={e => set('personal', e.target.value as GrimoireEvent['personal'])} style={{ width: '100%' }}>
                  <option value="not">Público</option>
                  <option value="yes">Privado do Mestre</option>
                </select>
              </div>
              <div className={styles.fullRow}>
                <label>🔒 Notas do Mestre</label>
                <textarea
                  value={form.masterNotes ?? ''}
                  onChange={e => set('masterNotes', e.target.value)}
                  placeholder="Anotações privadas do mestre: segredos, ganchos, conexões ocultas..."
                  rows={6}
                  style={{ width: '100%' }}
                  className={styles.masterNotesField}
                />
                <div className={styles.hint}>Visível apenas para o mestre. Suporta texto livre.</div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {event && (
            <button className="btn btn-danger" onClick={handleDelete}>
              🗑️ Excluir
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {event ? '✓ Salvar' : '＋ Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
