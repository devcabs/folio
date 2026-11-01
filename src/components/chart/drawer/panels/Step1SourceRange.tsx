import React, { useMemo } from 'react';
import {
  extractSpreadsheetId,
  type SheetMetadataTab,
} from '../../../../services/sheetsVerificationService';
import type { AccessStatus } from '../hooks/useSheetVerification';
import { Button } from '../../../ui';
import { DevHelpTooltip } from '../../../ui/DevHelpTooltip';
import styles from './Step1SourceRange.module.css';

export interface Step1SourceRangeProps {
  sheetUrl: string;
  setSheetUrl: (url: string) => void;
  accessStatus: AccessStatus;
  statusMessage: string;
  discoveredTabs: SheetMetadataTab[];
  tabName: string;
  sheetGid?: string;
  setTabName: (tab: string) => void;
  executeVerification: (url: string) => void;
  handleTabChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onResync?: () => void;
  isSyncing?: boolean;

  range: string;
  isRangeValid: boolean;
  isSelectingRange: boolean;
  setIsSelectingRange: (val: boolean | ((prev: boolean) => boolean)) => void;
  executeSync: (url?: string, tab?: string, gid?: string) => Promise<void> | void;
}

/**
 * Step1SourceRange Component
 * Folio Engine — Task 13.1: Full-Viewport Edge-to-Edge Spreadsheet Studio
 *
 * Streamlines Google Sheet connection and cell range selection into
 * a single focused setup panel. Range selection is triggered interactively
 * across the wide edge-to-edge sheet preview on the left.
 */
export const Step1SourceRange: React.FC<Step1SourceRangeProps> = ({
  sheetUrl,
  setSheetUrl,
  accessStatus,
  statusMessage: _statusMessage,
  discoveredTabs,
  tabName,
  sheetGid,
  setTabName: _setTabName,
  executeVerification,
  handleTabChange,
  onResync: _onResync,
  isSyncing = false,
  range,
  isRangeValid,
  isSelectingRange,
  setIsSelectingRange,
  executeSync,
}) => {
  const hasSpreadsheetId = Boolean(extractSpreadsheetId(sheetUrl.trim()));

  // Ensure options list contains current tab
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

  return (
    <div className={styles.stepPanel}>
      {/* 1. Google Sheet Source */}
      <div className={styles.sectionGroup}>
        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="cfg-sheet-url">
              <span className={styles.labelTitle}>
                <span>1. Paste your Google Sheets Link</span>
                {accessStatus === 'public' && (
                  <span className={styles.verifiedCheck} aria-label="Verified" title="Verified">
                    ✓
                  </span>
                )}
              </span>
            </label>
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.goToSourceBtn}
                title="Open spreadsheet in new tab"
              >
                <span>Open ↗</span>
              </a>
            )}
          </div>
          <div className={styles.fieldWithActionRow}>
            <input
              id="cfg-sheet-url"
              type="url"
              className={`${styles.input} ${accessStatus === 'invalid' ? styles.inputError : ''
                } ${accessStatus === 'public' ? styles.inputSuccess : ''}`}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => executeVerification(sheetUrl.trim())}
              disabled={!hasSpreadsheetId || accessStatus === 'checking'}
              className={styles.inlineActionBtn}
              aria-label="Verify"
            >
              Verify
            </Button>
          </div>

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
                    variant="secondary"
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
      </div>

      {/* 2. Sheet Tab Selection */}
      {(sheetUrl.trim() || accessStatus === 'public') && (
        <div className={styles.sectionGroup}>
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="cfg-tab-name">
                <span>2. Select a Tab</span>
              </label>
            </div>
            <div className={styles.fieldWithActionRow}>
              <select
                id="cfg-tab-name"
                className={styles.select}
                value={tabName || (tabOptions[0]?.title ?? 'Sheet1')}
                onChange={handleTabChange}
                disabled={tabOptions.length === 0}
                aria-label="Select Sheet Tab"
              >
                {tabOptions.map((tab) => (
                  <option key={String(tab.sheetId ?? tab.title)} value={tab.title}>
                    {tab.title}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => executeSync(sheetUrl, tabName, sheetGid)}
                disabled={accessStatus !== 'public' || !tabName || isSyncing}
                className={styles.inlineActionBtn}
                aria-label="Refresh"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cell Range & Extraction */}
      <div className={styles.sectionGroup}>
        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>
              <span>
                3. Select Range
                <DevHelpTooltip
                  text="The box of cells to use for this chart, like A1:D10."
                  label="Data Range"
                />
              </span>
            </label>
          </div>

          <div className={styles.rangeRow}>
            <div className={styles.rangeDisplayWrapper}>
              <span className={range ? styles.rangeBadge : styles.rangeBadgeEmpty}>
                {range || '—'}
              </span>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsSelectingRange((prev) => !prev)}
              className={styles.selectRangeBtn}
              aria-label={isSelectingRange ? 'Finish range selection' : 'Select range on sheet'}
            >
              {isSelectingRange ? 'Done' : 'Select'}
            </Button>
          </div>

          {!isRangeValid && range && (
            <p className={styles.errorText}>Invalid range</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step1SourceRange;
