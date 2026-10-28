import React, { useState } from 'react';
import styles from './App.module.css';

export const App: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <span className={styles.badge}>@folio/engine v0.1.0</span>
        <h1 className={styles.title}>Folio Engine Showcase</h1>
        <p className={styles.subtitle}>
          Clean-room parametric narrative engine and responsive scrollytelling canvas.
        </p>
        <button
          type="button"
          className={styles.button}
          onClick={() => setCount((c) => c + 1)}
        >
          Interactions: {count}
        </button>
      </div>
    </main>
  );
};

export default App;
