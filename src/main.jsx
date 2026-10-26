import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { primeMobilePush } from './lib/mobilePush';

// Capture a cold-start notification tap as early as possible (native Android/
// iOS only; a complete no-op in a desktop browser). The buffered target is
// applied after the user is authenticated. See src/lib/mobilePush.js.
primeMobilePush();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
