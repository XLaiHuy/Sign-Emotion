import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './app/App';
import './styles.css';
import './shared/ui/responsive.css';
import './shared/ui/conversation-session.css';
import { emitAudit, initializeAudit } from './infrastructure/audit/log';

initializeAudit(import.meta.env.VITE_BUILD_ID || 'development');

registerSW({
  onNeedRefresh() {
    emitAudit('update-available');
    window.dispatchEvent(new Event('signemo-update'));
  },
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
