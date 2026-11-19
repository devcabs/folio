import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import sampleNodes from './data/sample-nodes.json';
import { CURRENT_ENGINE_VERSION } from './migrations/ledger';
import type { NodeItem } from './types/node';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App
      config={{
        nodes: sampleNodes as NodeItem[],
        contentVersion: CURRENT_ENGINE_VERSION,
      }}
    />
  </React.StrictMode>
);
