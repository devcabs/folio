import React, { memo } from 'react';
import styles from './HeroWelcomeGhostWireframe.module.css';

export const HeroWelcomeGhostWireframe: React.FC = memo(() => {
  return (
    <section
      id="hero-skeleton"
      className={styles.heroSection}
      aria-busy="true"
      aria-label="Loading portal introduction"
    >
      <div className={styles.heroBackgroundCard} aria-hidden="true">
        <div className={styles.ambientMesh} />
      </div>

      <div className={styles.heroContainer}>
        <div className={styles.kickerSkeleton} aria-hidden="true" />
        <div className={styles.titleSkeleton} aria-hidden="true" />
        <div className={styles.subtitleSkeleton} aria-hidden="true" />
        <div className={styles.ctaPlaceholder} aria-hidden="true" />
      </div>
    </section>
  );
});

HeroWelcomeGhostWireframe.displayName = 'HeroWelcomeGhostWireframe';
export default HeroWelcomeGhostWireframe;
