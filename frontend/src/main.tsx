import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { App, OwnerApproval } from './App.js';
import { linkToken } from './contract.js';
import './style.css';

// An owner approval link (?approve=<token>) opens the one-cart approval page.
// Keep the bearer token out of the address bar, history and anything third-party
// scripts (the PayPal SDK) could read from the URL; this tab remembers it for refresh.
const KEY = 'spendconsent-approval-link';
const fromUrl = new URLSearchParams(window.location.search).get('approve');
if (fromUrl) window.history.replaceState(null, '', window.location.pathname);
let token = fromUrl;
try {
  if (linkToken(fromUrl)) window.sessionStorage.setItem(KEY, fromUrl);
  token ??= window.sessionStorage.getItem(KEY);
} catch { /* Without storage a refresh simply returns to the workspace. */ }
createRoot(document.getElementById('root')!).render(linkToken(token) ? <OwnerApproval token={token} /> : <App />);
