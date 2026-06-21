import { useAppStore } from '../../store/context';
import { TABS } from '../../types';
import styles from './TabBar.module.css';

export function TabBar() {
  const { state, dispatch } = useAppStore();

  return (
    <nav className={styles.tabBar}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`${styles.tab} ${state.ui.activeTab === tab.id ? styles.active : ''}`}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
          title={tab.label}
          aria-label={tab.label}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
