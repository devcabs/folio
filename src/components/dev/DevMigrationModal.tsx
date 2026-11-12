import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useMigrationContext, type MigrationContextType } from '../../context/MigrationContext';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { generateAiMigrationPrompt } from '../../utils/migrationPromptFormatter';
import type { PendingMigrationReport } from '../../types/migration';
import styles from './DevMigrationModal.module.css';

export interface DevMigrationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  report?: PendingMigrationReport | null;
  onMarkAsMigrated?: () => void;
  onGeneratePrompt?: () => string;
}

/**
 * Copies text to clipboard using Navigator Clipboard API with a safe DOM fallback.
 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select?.();
      const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * DevMigrationModal
 *
 * Accessible Dev Mode review modal for pending Folio Engine content migrations.
 * Consumes MigrationContext (isolated from DeveloperModeContext) and renders
 * version deltas, severity badges, affected entities, copyable AI prompts,
 * and watermark acknowledgment controls.
 */
export const DevMigrationModal: React.FC<DevMigrationModalProps> = ({
  isOpen: isOpenProp,
  onClose: onCloseProp,
  report: reportProp,
  onMarkAsMigrated: onMarkAsMigratedProp,
  onGeneratePrompt: onGeneratePromptProp,
}) => {
  let migration: MigrationContextType | null = null;
  try {
    migration = useMigrationContext();
  } catch {
    migration = null;
  }

  const { showToast } = useDeveloperMode();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = isOpenProp ?? migration?.isMigrationModalOpen ?? false;
  const pendingReport = reportProp !== undefined ? reportProp : (migration?.pendingReport ?? null);

  useEffect(() => {
    if (!isOpen) {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (onCloseProp) {
      onCloseProp();
    } else {
      migration?.closeMigrationModal();
    }
  }, [onCloseProp, migration]);

  const handleCopyPrompt = useCallback(async () => {
    const prompt = onGeneratePromptProp
      ? onGeneratePromptProp()
      : migration?.generatePrompt() ||
        (pendingReport ? generateAiMigrationPrompt(pendingReport) : '');

    if (!prompt) return;

    const ok = await copyTextToClipboard(prompt);
    if (ok) {
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 2000);
    } else {
      showToast('Unable to copy migration prompt to clipboard.', 'error');
    }
  }, [onGeneratePromptProp, migration, pendingReport, showToast]);

  const handleMarkAsMigrated = useCallback(() => {
    const targetVersion = pendingReport?.currentEngineVersion;

    if (onMarkAsMigratedProp) {
      onMarkAsMigratedProp();
    } else {
      migration?.markAsMigrated();
    }

    handleDismiss();

    showToast(
      targetVersion
        ? `Marked content as migrated to v${targetVersion}.`
        : 'Content migrations marked as complete.',
      'success'
    );
  }, [pendingReport, onMarkAsMigratedProp, migration, handleDismiss, showToast]);

  if (!isOpen || !pendingReport) {
    return null;
  }

  const changes = pendingReport.pendingContentChanges ?? [];
  const count = changes.length;
  const requiredCount = changes.filter((c) => c.required).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      maxWidth="620px"
      role="dialog"
      ariaLabelledBy="dev-migration-title"
      ariaDescribedBy="dev-migration-desc"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <span className={styles.versionBadge} aria-label="Engine version transition">
              <span>v{pendingReport.contentVersionWatermark}</span>
              <span className={styles.versionArrow} aria-hidden="true">
                ➔
              </span>
              <span>v{pendingReport.currentEngineVersion}</span>
            </span>

            <span className={styles.summaryPill}>
              {count} Pending Migration{count === 1 ? '' : 's'}
              {requiredCount > 0 ? ` (${requiredCount} Required)` : ''}
            </span>
          </div>

          <h2 id="dev-migration-title" className={styles.title}>
            Content Migrations Pending
          </h2>
          <p id="dev-migration-desc" className={styles.subtitle}>
            Folio Engine updated to v{pendingReport.currentEngineVersion}. Review the content
            schema and configuration updates below, or copy the prompt for your AI coding assistant.
          </p>
        </div>

        {count > 0 ? (
          <div className={styles.list} role="list" aria-label="Pending content migrations">
            {changes.map((change) => (
              <article key={change.id} className={styles.migrationCard} role="listitem">
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{change.title}</h3>
                  <span
                    className={`${styles.severityBadge} ${
                      change.required ? styles.badgeRequired : styles.badgeRecommended
                    }`}
                  >
                    {change.required ? 'REQUIRED' : 'RECOMMENDED'}
                  </span>
                </div>

                <p className={styles.cardDescription}>{change.description}</p>

                {change.affectedEntities && change.affectedEntities.length > 0 && (
                  <div className={styles.entitiesRow}>
                    <span className={styles.entitiesLabel}>Affected:</span>
                    {change.affectedEntities.map((entity) => (
                      <code key={entity} className={styles.entityChip}>
                        {entity}
                      </code>
                    ))}
                  </div>
                )}

                {change.migrationPrompt && (
                  <div className={styles.promptBlock}>
                    <span className={styles.promptLabel}>Required Changes & Instructions</span>
                    <pre className={styles.promptCode}>{change.migrationPrompt}</pre>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            All content migrations are up to date for v{pendingReport.currentEngineVersion}.
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.copyGroup}>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className={copied ? styles.copySuccessButton : undefined}
              onClick={handleCopyPrompt}
              disabled={count === 0}
            >
              {copied ? '✓ Copied Prompt' : 'Copy AI Migration Prompt'}
            </Button>
          </div>

          <div className={styles.primaryActions}>
            <Button variant="ghost" size="sm" type="button" onClick={handleDismiss}>
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleMarkAsMigrated}
              data-positive="true"
            >
              Mark as Migrated
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DevMigrationModal;

