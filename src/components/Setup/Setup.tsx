import { useState } from 'react';
import { useAppStore } from '../../store/context';
import type { CalendarMonth, Setup as SetupType } from '../../types';
import { STANDARD_MONTHS } from '../../types';
import { clamp } from '../../utils/dateUtils';
import styles from './Setup.module.css';

export function Setup() {
  const { state, dispatch } = useAppStore();
  const { setup } = state;
  const [newMonthName, setNewMonthName] = useState('');
  const [newMonthDays, setNewMonthDays] = useState('30');

  const activeMonths = setup.calendar.type === 'standard' ? STANDARD_MONTHS : setup.calendar.customMonths;
  const maxMonth = activeMonths.length;
  const maxDay = activeMonths[Math.max(0, (setup.currentMonth ?? 1) - 1)]?.days ?? 30;

  function updateSetup(patch: Partial<SetupType>) {
    dispatch({ type: 'UPDATE_SETUP', payload: patch });
  }

  function setYear(v: string) { updateSetup({ currentYear: parseInt(v, 10) || 1 }); }
  function setMonth(v: string) { updateSetup({ currentMonth: clamp(parseInt(v, 10) || 1, 1, maxMonth) }); }
  function setDay(v: string) { updateSetup({ currentDay: clamp(parseInt(v, 10) || 1, 1, maxDay) }); }

  function addCustomMonth() {
    const name = newMonthName.trim();
    const days = Math.max(1, parseInt(newMonthDays, 10) || 30);
    if (!name) return;
    const updated: CalendarMonth[] = [...setup.calendar.customMonths, { name, days }];
    updateSetup({ calendar: { ...setup.calendar, customMonths: updated } });
    setNewMonthName('');
    setNewMonthDays('30');
  }

  function removeCustomMonth(i: number) {
    const updated = setup.calendar.customMonths.filter((_, idx) => idx !== i);
    updateSetup({ calendar: { ...setup.calendar, customMonths: updated } });
  }

  function updateCustomMonth(i: number, patch: Partial<CalendarMonth>) {
    const updated = setup.calendar.customMonths.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    updateSetup({ calendar: { ...setup.calendar, customMonths: updated } });
  }

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🌍 Informações do Mundo</h2>
        <div className={styles.field}>
          <label>Nome do Mundo</label>
          <input
            value={setup.worldName}
            onChange={e => updateSetup({ worldName: e.target.value })}
            placeholder="Nome do seu mundo..."
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>
        <div className={styles.field}>
          <label>Lore / Descrição</label>
          <textarea
            value={setup.worldDesc}
            onChange={e => updateSetup({ worldDesc: e.target.value })}
            placeholder="Descreva o lore, a premissa e o tom do seu mundo..."
            rows={5}
            style={{ width: '100%', maxWidth: '640px' }}
          />
        </div>
      </div>

      <hr className="gold-divider" />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📅 Data Atual da Campanha</h2>
        <p className={styles.hint}>Esta data é a âncora temporal para cálculos de "há X anos" e "em X meses".</p>
        <div className={styles.dateRow}>
          <div className={styles.field}>
            <label>Ano</label>
            <input
              type="number"
              value={setup.currentYear}
              onChange={e => setYear(e.target.value)}
              style={{ width: '100px' }}
            />
          </div>
          <div className={styles.field}>
            <label>Mês (1–{maxMonth})</label>
            <input
              type="number"
              min={1}
              max={maxMonth}
              value={setup.currentMonth}
              onChange={e => setMonth(e.target.value)}
              style={{ width: '80px' }}
            />
            <span className={styles.monthName}>{activeMonths[(setup.currentMonth ?? 1) - 1]?.name ?? ''}</span>
          </div>
          <div className={styles.field}>
            <label>Dia (1–{maxDay})</label>
            <input
              type="number"
              min={1}
              max={maxDay}
              value={setup.currentDay}
              onChange={e => setDay(e.target.value)}
              style={{ width: '80px' }}
            />
          </div>
        </div>
      </div>

      <hr className="gold-divider" />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🗓️ Calendário</h2>
        <div className={styles.calendarToggle}>
          <button
            className={`btn ${setup.calendar.type === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => updateSetup({ calendar: { ...setup.calendar, type: 'standard' } })}
          >
            📅 Calendário Padrão (12 meses reais)
          </button>
          <button
            className={`btn ${setup.calendar.type === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => updateSetup({ calendar: { ...setup.calendar, type: 'custom' } })}
          >
            ✨ Calendário Fantástico (customizado)
          </button>
        </div>

        {setup.calendar.type === 'standard' && (
          <div className={styles.stdMonths}>
            {STANDARD_MONTHS.map((m, i) => (
              <div key={i} className={styles.stdMonth}>
                <span>{i + 1}.</span>
                <span>{m.name}</span>
                <span className={styles.days}>{m.days} dias</span>
              </div>
            ))}
          </div>
        )}

        {setup.calendar.type === 'custom' && (
          <div className={styles.customMonths}>
            <p className={styles.hint}>Defina os meses do seu calendário fantástico.</p>
            <div className={styles.monthList}>
              {setup.calendar.customMonths.map((m, i) => (
                <div key={i} className={styles.monthRow}>
                  <span className={styles.monthNum}>{i + 1}.</span>
                  <input
                    value={m.name}
                    onChange={e => updateCustomMonth(i, { name: e.target.value })}
                    placeholder="Nome do mês"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={1}
                    value={m.days}
                    onChange={e => updateCustomMonth(i, { days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    style={{ width: '70px' }}
                  />
                  <span className={styles.daysLabel}>dias</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeCustomMonth(i)}
                    disabled={setup.calendar.customMonths.length <= 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.addMonth}>
              <input
                value={newMonthName}
                onChange={e => setNewMonthName(e.target.value)}
                placeholder="Nome do novo mês..."
                style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && addCustomMonth()}
              />
              <input
                type="number"
                min={1}
                value={newMonthDays}
                onChange={e => setNewMonthDays(e.target.value)}
                style={{ width: '70px' }}
              />
              <span className={styles.daysLabel}>dias</span>
              <button className="btn btn-primary" onClick={addCustomMonth}>＋ Adicionar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
