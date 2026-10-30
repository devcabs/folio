import React from 'react';
import styles from './DrawerTier.module.css';

export interface DrawerTierProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const DrawerTier: React.FC<DrawerTierProps> = ({
  title,
  subtitle,
  children,
  className = '',
}) => {
  return (
    <section className={`${styles.tier} ${className}`.trim()} aria-label={title}>
      <div className={styles.tierHeader}>
        <h3 className={styles.tierTitle}>{title}</h3>
        {subtitle && <p className={styles.tierSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.tierContent}>{children}</div>
    </section>
  );
};
