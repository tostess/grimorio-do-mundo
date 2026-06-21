import { useState, useEffect } from 'react';
import { AppProvider, useAppStore } from './store/context';
import { useWorldStore } from './store/worldContext';
import { useSessionStore } from './store/sessionContext';
import { parseJoinCode } from './net/qr';
import { WorldSelector } from './components/WorldSelector/WorldSelector';
import { WorldHistory } from './components/WorldHistory/WorldHistory';
import { Header } from './components/Header/Header';
import { TabBar } from './components/TabBar/TabBar';
import { Timeline } from './components/Timeline/Timeline';
import { Setup } from './components/Setup/Setup';
import { Stats } from './components/Stats/Stats';
import { Prompts } from './components/Prompts/Prompts';
import { EventIdeas } from './components/EventIdeas/EventIdeas';
import { TypesData } from './components/TypesData/TypesData';
import { GlobalSearch } from './components/GlobalSearch/GlobalSearch';
import { SessionLobby } from './components/Session/SessionLobby/SessionLobby';
import { SessionGuestShell } from './components/Session/SessionGuestShell/SessionGuestShell';
import { CharacterList } from './components/Characters/CharacterList/CharacterList';
import styles from './App.module.css';

function TabContent() {
  const { state } = useAppStore();
  switch (state.ui.activeTab) {
    case 'timeline': return <Timeline />;
    case 'setup':    return <Setup />;
    case 'stats':    return <Stats />;
    case 'prompts':  return <Prompts />;
    case 'ideas':    return <EventIdeas />;
    case 'types':    return <TypesData />;
    case 'session':  return <SessionLobby />;
    case 'chars':    return <CharacterList />;
    default:         return <Timeline />;
  }
}

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [worldsOpen, setWorldsOpen] = useState(false);
  const { dispatch } = useAppStore();
  const { session } = useSessionStore();

  // Auto-navigate to session tab when URL has ?join=<code>
  useEffect(() => {
    if (parseJoinCode()) {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'session' });
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Guests get a lightweight shell after joining
  if (session.role === 'guest') return <SessionGuestShell />;

  return (
    <div className={styles.app}>
      <Header
        onOpenSearch={() => setSearchOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenWorlds={() => setWorldsOpen(true)}
      />
      <TabBar />
      <main className={styles.main}>
        <TabContent />
      </main>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {historyOpen && <WorldHistory onClose={() => setHistoryOpen(false)} />}
      {worldsOpen && <WorldSelector onClose={() => setWorldsOpen(false)} />}
    </div>
  );
}

export function App() {
  const { activeWorldId } = useWorldStore();
  const { session } = useSessionStore();
  const joinCode = parseJoinCode();

  // Guest without a world: after joining, show guest shell; before joining, show join form
  if (!activeWorldId && (session.role === 'guest' || joinCode)) {
    if (session.role === 'guest') return <SessionGuestShell />;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
      }}>
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border-gold)',
          borderRadius: 10, padding: '2rem', maxWidth: 380, width: '100%', margin: '0 1rem',
        }}>
          <SessionLobby />
        </div>
      </div>
    );
  }

  if (!activeWorldId) {
    return <WorldSelector />;
  }

  return (
    <AppProvider key={activeWorldId} worldId={activeWorldId}>
      <AppShell />
    </AppProvider>
  );
}
