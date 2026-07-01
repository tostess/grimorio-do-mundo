import { useState, useEffect } from 'react';
import { useSessionStore } from '../../../store/sessionContext';
import { parseJoinCode } from '../../../net/qr';
import type { SessionMessage } from '../../../net/protocol';
import { MasterDashboard } from '../MasterDashboard/MasterDashboard';
import styles from './SessionLobby.module.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function Portrait({ name, src, small = false }: { name: string; src?: string; small?: boolean }) {
  return (
    <span className={`${styles.portrait} ${small ? styles.portraitSmall : ''}`}>
      {src
        ? <img src={src} alt={name} className={styles.portraitImg} />
        : <span>{initials(name)}</span>}
    </span>
  );
}

// ── Dice Roller ───────────────────────────────────────────────────────────────

function DiceRoller() {
  const { rollDice } = useSessionStore();
  const [notation, setNotation] = useState('');
  const [lastResult, setLastResult] = useState<{ total: number; breakdown: string } | null>(null);
  const [invalid, setInvalid] = useState(false);

  const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

  function handleRoll(n: string) {
    const r = rollDice(n);
    if (r) {
      setLastResult({ total: r.total, breakdown: r.breakdown });
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (notation.trim()) handleRoll(notation.trim());
  }

  return (
    <div className={styles.diceRoller}>
      <div className={styles.quickDice}>
        {QUICK.map(d => (
          <button key={d} className={`btn btn-sm ${styles.dieBadge}`} onClick={() => { setNotation(d); handleRoll(d); }}>
            {d}
          </button>
        ))}
      </div>
      <form className={styles.diceForm} onSubmit={handleSubmit}>
        <input
          className={`${styles.diceInput} ${invalid ? styles.diceInputError : ''}`}
          value={notation}
          onChange={e => { setNotation(e.target.value); setInvalid(false); }}
          placeholder="ex: 2d6+3"
          aria-label="Notação de dados"
        />
        <button className="btn btn-sm btn-primary" type="submit">🎲 Rolar</button>
      </form>
      {lastResult && (
        <div className={styles.diceResult}>
          <span className={styles.diceTotal}>{lastResult.total}</span>
          <span className={styles.diceBreakdown}>{lastResult.breakdown}</span>
        </div>
      )}
      {invalid && <p className={styles.diceError}>Notação inválida. Use: 1d20, 2d6+3, d8-1</p>}
    </div>
  );
}

// ── Host View — delegates to MasterDashboard ──────────────────────────────────

function HostView() {
  const { closeSession } = useSessionStore();
  return <MasterDashboard onClose={closeSession} />;
}

// ── Join Form (offline, entering session as guest) ────────────────────────────

function JoinForm() {
  const { joinSession } = useSessionStore();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);

  // Pre-fill code from URL; auto-reconnect if sessionStorage has saved name from previous session
  useEffect(() => {
    const urlCode = parseJoinCode();
    if (!urlCode) return;
    setCode(urlCode.toLowerCase());
    const savedName = sessionStorage.getItem('grimorio_join_name');
    const savedHost = sessionStorage.getItem('grimorio_join_host');
    if (savedName && savedHost === urlCode.toLowerCase()) {
      // Page was refreshed mid-session — reconnect automatically
      setName(savedName);
      setJoining(true);
      joinSession(urlCode.toLowerCase(), savedName);
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimCode = code.trim().toLowerCase();
    const trimName = name.trim();
    if (!trimCode || !trimName) return;
    setJoining(true);
    joinSession(trimCode, trimName);
  }

  return (
    <div className={styles.joinForm}>
      <h3 className={styles.joinTitle}>Entrar na Sessão</h3>
      <p className={styles.joinHint}>
        Receba o código ou link do mestre da campanha
      </p>
      <form onSubmit={handleJoin} className={styles.form}>
        <label className={styles.label}>
          Seu nome
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do jogador"
            maxLength={30}
            required
          />
        </label>
        <label className={styles.label}>
          Código da sessão
          <input
            className={styles.input}
            value={code}
            onChange={e => setCode(e.target.value.toLowerCase())}
            placeholder="abc123"
            maxLength={6}
            pattern="[a-z0-9]{1,6}"
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={joining || !code.trim() || !name.trim()}>
          {joining ? 'Conectando...' : 'Entrar na Sessão'}
        </button>
      </form>
    </div>
  );
}

// ── Offline View (mestre, sem sessão ativa) ────────────────────────────────────

function OfflineView() {
  const { openSession } = useSessionStore();
  const [opened, setOpened] = useState(false);

  function handleOpen() {
    openSession();
    setOpened(true);
  }

  return (
    <div className={styles.offlineView}>
      <div className={styles.hostSection}>
        <h2 className={styles.sectionTitle}>Mesa Digital</h2>
        <p className={styles.desc}>
          Abra uma sessão para conectar jogadores em tempo real via P2P.
          O dispositivo do mestre é a fonte da verdade — nenhum dado passa por servidor.
        </p>
        <button className="btn btn-primary" onClick={handleOpen} disabled={opened}>
          ⚔️ Abrir Sessão
        </button>
      </div>

      <div className={styles.divider} />

      <JoinForm />
    </div>
  );
}

// ── Guest Connected View ───────────────────────────────────────────────────────

function GuestConnectedView() {
  const { session, closeSession, sendMessage } = useSessionStore();
  const [chatInput, setChatInput] = useState('');
  const { combat } = session;
  const myCharacter = session.myCharacter;

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg: SessionMessage = {
      type: 'CHAT_MESSAGE',
      peerId: session.myPeerId ?? '',
      playerName: session.myPlayerName,
      text: chatInput.trim(),
    };
    sendMessage(msg);
    setChatInput('');
  }

  function avatarForEntry(peerId?: string, characterId?: string): string | undefined {
    if (peerId) return session.assignedCharacters[peerId]?.avatarDataUrl;
    if (myCharacter && characterId === myCharacter.id) return myCharacter.avatarDataUrl;
    return undefined;
  }

  function avatarForPeer(peerId: string): string | undefined {
    return session.assignedCharacters[peerId]?.avatarDataUrl;
  }

  function characterLabelForPeer(peerId: string): string | null {
    const assigned = session.assignedCharacters[peerId];
    return assigned ? `${assigned.name} - ${assigned.class} ${assigned.level}` : null;
  }

  return (
    <div className={styles.guestView}>
      <div className={styles.guestStatus}>
        <Portrait
          name={myCharacter?.name ?? session.myPlayerName}
          src={myCharacter?.avatarDataUrl}
        />
        <div className={styles.guestStatusText}>
          <span className={styles.connectedLine}>
            <span className={styles.connectedDot} />
            Conectado como <strong>{session.myPlayerName}</strong>
          </span>
          {myCharacter ? (
            <span className={styles.guestCharacterLine}>
              {myCharacter.name} - {myCharacter.class} {myCharacter.level} - HP {myCharacter.hpCurrent}/{myCharacter.hpMax}
            </span>
          ) : (
            <span className={styles.guestCharacterLine}>Aguardando ficha do mestre.</span>
          )}
        </div>
        <span className={styles.sessionCode}>{session.hostPeerId?.toUpperCase()}</span>
      </div>
      {/* Initiative order — visible only during active combat */}
      {combat.active && (
        <div className={styles.peersPanel}>
          <h3 className={styles.sectionTitle}>⚔️ Iniciativa — Round {combat.round}</h3>
          {combat.entries[combat.currentTurnIndex] && (
            <div className={styles.currentTurnGuest}>
              Turno de <strong>{combat.entries[combat.currentTurnIndex].name}</strong>
            </div>
          )}
          <ul className={styles.initiativeList}>
            {combat.entries.map((entry, idx) => (
              <li
                key={entry.id}
                className={`${styles.initiativeItem} ${idx === combat.currentTurnIndex ? styles.initiativeActive : ''}`}
              >
                <span className={styles.iniIni}>{entry.initiative}</span>
                <Portrait name={entry.name} src={avatarForEntry(entry.peerId, entry.characterId)} small />
                <span className={styles.iniName}>{entry.name}</span>
                <span className={styles.iniHp}>{entry.hp}/{entry.hpMax}</span>
                {entry.conditions.length > 0 && (
                  <span className={styles.iniConds}>
                    {entry.conditions.length} cond.
                  </span>
                )}
                {idx === combat.currentTurnIndex && (
                  <span className={styles.iniTurnArrow}>←</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.peersPanel}>
        <h3 className={styles.sectionTitle}>Jogadores na Mesa</h3>
        <ul className={styles.peerList}>
          <li className={styles.peerItem}>
            <span className={`${styles.peerDot} ${styles.peerDotHost}`} />
            <span className={styles.peerName}>Mestre</span>
          </li>
          {session.peers.map(p => (
            <li key={p.peerId} className={styles.peerItem}>
              <Portrait name={p.playerName} src={avatarForPeer(p.peerId)} small />
              <span className={styles.peerDot} />
              <span className={styles.peerName}>
                {p.playerName}
                {p.peerId === session.myPeerId && ' (você)'}
              </span>
              {characterLabelForPeer(p.peerId) && (
                <span className={styles.peerCharacter}>{characterLabelForPeer(p.peerId)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.diceSection}>
        <h3 className={styles.sectionTitle}>🎲 Dados</h3>
        <DiceRoller />
      </div>

      <div className={styles.logPanel}>
        <h3 className={styles.sectionTitle}>Log da Sessão</h3>
        <div className={styles.logList}>
          {session.log.length === 0 ? (
            <p className={styles.empty}>Nenhuma atividade ainda.</p>
          ) : (
            [...session.log].reverse().map(entry => (
              <div key={entry.id} className={`${styles.logEntry} ${styles[`log_${entry.type}`]}`}>
                <span className={styles.logTime}>
                  {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={styles.logText}>{entry.text}</span>
              </div>
            ))
          )}
        </div>
        <form className={styles.chatForm} onSubmit={sendChat}>
          <input
            className={styles.chatInput}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Sua mensagem..."
          />
          <button className="btn btn-sm" type="submit">Enviar</button>
        </form>
      </div>

      <div className={styles.actions}>
        <button className="btn btn-danger btn-sm" onClick={closeSession}>
          Sair da Sessão
        </button>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function SessionLobby() {
  const { session } = useSessionStore();

  if (session.role === 'host') return <HostView />;
  if (session.role === 'guest') return <GuestConnectedView />;
  return <OfflineView />;
}
