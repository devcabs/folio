import React from 'react';
import type { ChartProblemCategory } from '../../types/chart';
import { ParametricShape } from '../ui/ParametricShape';
import { Button } from '../ui/Button';
import { ChartGhostWireframe } from './ChartGhostWireframe';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './DataPendingCard.module.css';

export interface DataPendingCardProps {
  chartId?: string;
  nodeTitle?: string;
  category?: ChartProblemCategory;
  errorMessage?: string;
  hasSheetUrl?: boolean;
  onEdit?: () => void;
  className?: string;
  headline?: string;
  description?: string;
}

/**
 * DataPendingCard Component
 * Folio Engine — Subtask 7.4.5 & Task 8.10
 *
 * Universal dignified chart fallback when an indicator dataset has not yet been linked
 * or is encountering access/format issues.
 *
 * Visual Architecture:
 * - Background: Universal tokenized SVG ChartGhostWireframe skeleton.
 * - Public View: Quiet, dignified notice with brand mark.
 * - Developer Mode: 3-point diagnostic panel with concrete coordinator troubleshooting hints
 *   and the uniform administrative '✎ Edit' button wired to ChartConfigDrawer.
 */
export const DataPendingCard: React.FC<DataPendingCardProps> = ({
  chartId,
  nodeTitle,
  category = 'unlinked',
  errorMessage,
  hasSheetUrl = false,
  onEdit,
  className,
  headline,
  description,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const canEdit = isDevMode && isDesktop;

  // Derive resolved category if not explicitly specified
  const resolvedCategory: ChartProblemCategory = React.useMemo(() => {
    if (category && category !== 'none') return category;
    if (!hasSheetUrl) return 'unlinked';
    if (errorMessage) return 'connection_error';
    return 'data_format';
  }, [category, hasSheetUrl, errorMessage]);

  // Coordinator diagnostic details
  const diagnosticConfig = React.useMemo(() => {
    switch (resolvedCategory) {
      case 'connection_error':
        return {
          badgeClass: styles.diagBadgeConnection,
          badgeLabel: 'Connection Issue',
          title: 'Unable to Access Google Sheet',
          hint:
            errorMessage ||
            'Verify that the Google Sheet sharing permission is set to "Anyone with the link can view" and the sheet is online.',
        };
      case 'data_format':
        return {
          badgeClass: styles.diagBadgeDataFormat,
          badgeLabel: 'Data Range Issue',
          title: 'Empty or Unrecognized Data Range',
          hint:
            errorMessage ||
            'The selected tab or range contains no valid rows or numeric data. Check the tab name and cell coordinates.',
        };
      case 'unlinked':
      default:
        return {
          badgeClass: styles.diagBadgeUnlinked,
          badgeLabel: 'Unlinked Source',
          title: 'No Google Sheet Linked',
          hint:
            'Link an official Google Sheet to automatically ingest and publish validated indicator metrics.',
        };
    }
  }, [resolvedCategory, errorMessage]);

  return (
    <div
      className={`${styles.container} ${className || ''}`.trim()}
      role="region"
      aria-label="Indicator Data Notice"
      tabIndex={-1}
    >
      {/* Background Ghost Wireframe */}
      <ChartGhostWireframe />

      {/* Role-Bifurcated Overlay Content */}
      {canEdit ? (
        <div className={styles.diagnosticPanel}>
          <span className={`${styles.diagBadge} ${diagnosticConfig.badgeClass}`}>
            {diagnosticConfig.badgeLabel}
          </span>

          <h4 className={styles.diagTitle}>{diagnosticConfig.title}</h4>

          <p className={styles.diagHint}>{diagnosticConfig.hint}</p>

          {onEdit && (
            <div className={styles.actionRow}>
              <Button
                variant="admin"
                size="xs"
                onClick={onEdit}
                aria-label={chartId ? `Edit chart ${chartId}` : 'Edit chart'}
              >
                ✎ Edit
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.publicNoticeWrapper}>
          <div className={styles.logoWrapper}>
            <ParametricShape sides={8} waviness={0.15} radius={18} fill="var(--folio-primary)" />
          </div>

          <div className={styles.kicker}>
            {nodeTitle ? `${nodeTitle} Indicator` : 'Official Indicator'}
          </div>

          <h3 className={styles.title}>{headline || 'Indicator Data Pending'}</h3>

          <p className={styles.description}>
            {description || 'The designated coordinator is finalizing official validation and records encoding for this indicator. Data receipts will appear once published.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default DataPendingCard;
