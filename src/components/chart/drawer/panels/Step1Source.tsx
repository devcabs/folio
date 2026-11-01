import React, { useMemo } from 'react';
import type { SheetMetadataTab } from '../../../../services/sheetsVerificationService';
import type { AccessStatus } from '../hooks/useSheetVerification';
import { Button } from '../../../ui';
import styles from './Step1Source.module.css';

interface Step1SourceProps {
  sheetUrl: string;
  setSheetUrl: (url: string) => void;
  accessStatus: AccessStatus;
  statusMessage: string;
  discoveredTabs: SheetMetadataTab[];
  tabName: string;
  setTabName: (tab: string) => void;
  executeVerification: (url: string) => void;
  handleTabChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onResync?: () => void;
  isSyncing?: boolean;
}

export const Step1Source: React.FC<Step1SourceProps> = ({
  sheetUrl,
  setSheetUrl,
  accessStatus,
  statusMessage,
  discoveredTabs,
  tabName,
  setTabName: _setTabName,
  executeVerification,
  handleTabChange,
  onResync,
  isSyncing = false,
}) => {
  const isChecking = accessStatus === 'checking' || isSyncing;

  // Always ensure a comprehensive list of tabs for the select dropdown
  const tabOptions = useMemo(() => {
    if (discoveredTabs.length > 0) {
      const hasCurrent = discoveredTabs.some((t) => t.title === tabName);
      if (tabName && !hasCurrent) {
        return [{ title: tabName, sheetId: 'current' }, ...discoveredTabs];
      }
      return discoveredTabs;
    }
    return [{ title: tabName || 'Sheet1', sheetId: 'default' }];
  }, [discoveredTabs, tabName]);

  const handleResyncClick = () => {
    if (onResync) {
      onResync();
    } else {
      executeVerification(sheetUrl);
    }
  };

  return (
    <div className={styles.stepPanel}>
      <div className={styles.formGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor="cfg-sheet-url">
            Google Sheet URL
          </label>
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.goToSourceBtn}
              title="Open Google Sheet source in new tab"
            >
              <span>Go To Source</span>
              <span className={styles.goToSourceIcon} aria-hidden="true">↗</span>
            </a>
          ) : (
            <button
              type="button"
              className={`${styles.goToSourceBtn} ${styles.goToSourceBtnDisabled}`}
              disabled
              title="Enter a Google Sheet URL first"
            >
              <span>Go To Source</span>
            </button>
          )}
        </div>
        <input
          id="cfg-sheet-url"
          type="url"
          className={`${styles.input} ${
            accessStatus === 'invalid' ? styles.inputError : ''
          } ${accessStatus === 'public' ? styles.inputSuccess : ''}`}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          autoComplete="off"
        />

        {/* Source Status & Resync Controls */}
        {(sheetUrl.trim() || accessStatus !== 'idle') && (
          <div className={styles.statusRow}>
            <div
              className={`${styles.statusBadge} ${
                isChecking
                  ? styles.statusChecking
                  : accessStatus === 'public'
                  ? styles.statusPublic
                  : accessStatus === 'restricted'
                  ? styles.statusRestricted
                  : styles.statusInvalid
              }`}
            >
              <span className={styles.statusDot} aria-hidden="true" />
              <span className={styles.statusText}>
                {statusMessage || (accessStatus === 'idle' ? 'Ready to verify' : '')}
              </span>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleResyncClick}
              disabled={isChecking || !sheetUrl.trim()}
              className={styles.resyncBtn}
              aria-label="Resync Google Sheet source and discover tabs"
            >
              <span
                className={`${styles.syncIcon} ${isChecking ? styles.spinning : ''}`}
                aria-hidden="true"
              >
                ↻
              </span>
              <span>{isChecking ? 'Resyncing…' : 'Resync'}</span>
            </Button>
          </div>
        )}

        {accessStatus === 'restricted' && (
          <div className={styles.guidanceCard} role="alert">
            <div className={styles.guidanceHeader}>
              <div className={styles.guidanceTitleWrapper}>
                <span className={styles.guidanceIcon} aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span className={styles.guidanceTitle}>Enable Link Sharing</span>
              </div>
            </div>

            <p className={styles.guidanceText}>
              Google Sheets must be set to public view for live indicator charts to render.
            </p>

            <div className={styles.guidanceSteps}>
              <div className={styles.guidanceStepItem}>
                <span className={styles.stepNum}>1</span>
                <span>Click <strong>Share</strong> in Google Sheet</span>
              </div>
              <div className={styles.guidanceStepItem}>
                <span className={styles.stepNum}>2</span>
                <span>Change access to <strong>Anyone with the link</strong></span>
              </div>
              <div className={styles.guidanceStepItem}>
                <span className={styles.stepNum}>3</span>
                <span>Keep role set to <strong>Viewer</strong></span>
              </div>
            </div>

            <div className={styles.guidanceActions}>
              {sheetUrl && (
                <Button
                  as="a"
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="sm"
                >
                  Open Sheet ↗
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => executeVerification(sheetUrl)}
              >
                Re-verify Link
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sheet Tab selection — strictly a dropdown */}
      {(sheetUrl.trim() || accessStatus === 'public') && (
        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="cfg-tab-name">
              <span>Sheet Tab</span>
            </label>
            {isChecking && (
              <span className={styles.tabCheckingBadge}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span>Fetching tabs…</span>
              </span>
            )}
          </div>
          <select
            id="cfg-tab-name"
            className={styles.select}
            value={tabName || (tabOptions[0]?.title ?? 'Sheet1')}
            onChange={handleTabChange}
            disabled={isChecking && tabOptions.length === 0}
            aria-label="Select Google Sheet Tab"
          >
            {tabOptions.map((tab) => (
              <option key={String(tab.sheetId ?? tab.title)} value={tab.title}>
                {tab.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
