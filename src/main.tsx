import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

import('./App.tsx')
  .then(({default: App}) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('Failed to start app:', error);
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div
        style={{
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          padding: '2rem',
          color: '#f87171',
          background: '#1a1a1a',
          minHeight: '100vh',
        }}
      >
        <h1 style={{color: '#fff', marginBottom: '1rem'}}>Failed to start app</h1>
        {message}
      </div>,
    );
  });
