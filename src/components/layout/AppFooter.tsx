import React from 'react';
import { ParametricShape } from '../ui/ParametricShape';
import type { NodeCode } from '../../types/node';
import { CURRENT_ENGINE_VERSION } from '../../migrations/ledger';
import styles from './AppFooter.module.css';

export interface AppFooterProps {
  orgName?: string;
  version?: string;
  onRoadmapClick?: (e?: React.MouseEvent) => void;
  onOverviewClick?: (e?: React.MouseEvent) => void;
  onNodeClick?: (nodeCode: NodeCode, e?: React.MouseEvent) => void;
}

const NODE_ITEMS: { code: NodeCode; label: string; href: string }[] = [
  { code: 'access', label: '01. Access', href: '/node/access/' },
  { code: 'equity', label: '02. Equity', href: '/node/equity/' },
  { code: 'quality', label: '03. Quality', href: '/node/quality/' },
  { code: 'resiliency', label: '04. Resiliency', href: '/node/resiliency/' },
  { code: 'governance', label: '05. Governance', href: '/node/governance/' },
];

export const AppFooter: React.FC<AppFooterProps> = ({
  orgName = 'the host application',
  version,
  onRoadmapClick,
  onOverviewClick,
  onNodeClick,
}) => {
  const cleanVersion = (version || CURRENT_ENGINE_VERSION || '0.1.6').replace(/^v/i, '');
  const versionText = `Folio V${cleanVersion}`;

  const handleBrandClick = (e: React.MouseEvent) => {
    if (onOverviewClick) {
      e.preventDefault();
      onOverviewClick(e);
    }
  };

  const handleNodeLinkClick = (nodeCode: NodeCode, e: React.MouseEvent) => {
    if (onNodeClick) {
      e.preventDefault();
      onNodeClick(nodeCode, e);
    }
  };

  return (
    <footer className={styles.siteFooter} role="contentinfo" aria-label="Portal Footer">
      <div className={styles.footerContainer}>
        {/* Multi-Column Navigation Grid — Single-Primary-Subject & Phase 1 Scope */}
        <nav className={styles.footerGrid} aria-label="Portal Navigation Links">
          {/* Column 1: Brand Anchor */}
          <div className={styles.brandColumn}>
            <a
              href="/"
              className={styles.brandGroup}
              onClick={handleBrandClick}
              aria-label="Portal Home"
            >
              <ParametricShape size="md" />
              <span className={styles.brandName}>Portal</span>
            </a>
          </div>

          {/* Column 2: 5 Nodes with clean path routing */}
          <div className={styles.navColumn}>
            <h3 className={styles.columnHeading}>Nodes</h3>
            <ul className={styles.columnList}>
              {NODE_ITEMS.map((item) => (
                <li key={item.code}>
                  <a
                    href={item.href}
                    className={styles.footerLink}
                    onClick={(e) => handleNodeLinkClick(item.code, e)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Portal & Transparency */}
          <div className={styles.navColumn}>
            <h3 className={styles.columnHeading}>Portal</h3>
            <ul className={styles.columnList}>
              <li>
                <a
                  href="/"
                  className={styles.footerLink}
                  onClick={(e) => {
                    if (onOverviewClick) {
                      e.preventDefault();
                      onOverviewClick(e);
                    }
                  }}
                >
                  Overview
                </a>
              </li>
              <li>
                <a
                  href="/#roadmap"
                  className={styles.footerLink}
                  onClick={(e) => {
                    if (onRoadmapClick) {
                      e.preventDefault();
                      onRoadmapClick(e);
                    }
                  }}
                >
                  Winding Roadmap
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Bottom Sub-Footer Bar */}
        <div className={styles.footerBottom}>
          <div className={styles.statusBlock}>
            <div
              className={styles.statusIndicator}
              role="status"
              aria-label="Folio Engine: Management, Accountability and Systematic collection of Data"
            >
              <div className={styles.statusHeader}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span className={styles.statusTitle}>Folio Engine</span>
              </div>
              <span className={styles.statusSeparator} aria-hidden="true">
                —
              </span>
              <span className={styles.statusDesc}>
                Management, Accountability and Systematic collection of Data
              </span>
            </div>
          </div>

          <div className={styles.legalBlock}>
            <p className={styles.copyright}>
              © {new Date().getFullYear()} {orgName}
            </p>

            <span className={styles.legalSeparator} aria-hidden="true">
              ·
            </span>

            <span className={styles.versionTag}>
              {versionText}
            </span>

            <span className={styles.legalSeparator} aria-hidden="true">
              ·
            </span>

            <a href="#privacy" className={styles.bottomLink}>
              Data Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
