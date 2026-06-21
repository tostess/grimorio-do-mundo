import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorldProvider } from './store/worldContext';
import { SessionProvider } from './store/sessionContext';
import { App } from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <WorldProvider>
        <App />
      </WorldProvider>
    </SessionProvider>
  </React.StrictMode>
);
