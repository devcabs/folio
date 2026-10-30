import React from 'react';

export function App(): React.JSX.Element {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display, serif)',
            fontSize: 'var(--text-display, 2.5rem)',
            color: 'var(--folio-primary)',
            margin: '0 0 var(--space-2)',
          }}
        >
          Folio Engine
        </h1>
        <p
          style={{
            fontSize: 'var(--text-body, 1rem)',
            color: 'var(--text-secondary)',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          Universal scrollytelling, dynamic document canvas, and vector chart studio.
        </p>
      </div>
    </main>
  );
}

export default App;
