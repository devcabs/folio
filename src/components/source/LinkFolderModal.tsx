import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { isValidDriveFolderUrl } from '../../utils/source';
import { upsertLiveSourceSource } from '../../services/sourceService';
import {
  verifyDriveFolderUrl,
  extractDriveFolderId,
  type DriveVerificationResult,
} from '../../services/driveVerificationService';
import { syncFolderPhotos } from '../../services/drivePhotoSyncService';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { Toast } from '../feedback/Toast';
import styles from './LinkFolderModal.module.css';

export interface LinkFolderModalProps {
  isOpen: boolean;
  pointId: string;
  initialTitle?: string;
  initialUrl?: string;
  onClose: () => void;
  onSuccess?: (updatedUrl: string, updatedTitle: string) => void;
}

/**
 * LinkFolderModal Component
 * Folio Engine — Subtask 5.4: Link Folder Modal & URL Validation Pipeline
 *
 * Quiet, restrained editorial dialog for coordinator to connect official Google Drive
 * Means of Verification (MOV) folders:
 * 1. Consumes canonical Modal: Reuses viewport portal, scroll locks, and keyboard handling.
 * 2. Automated Save Verification Gate: Verifies folder existence & public access on Save.
 * 3. Developer Mode Exit: Auto-closes immediately if developer mode is exited.
 * 4. Editorial Restraint: Zero ornamental clutter, no meta-narrative, calm color contrast.
 * 5. Preflight "Test Link": Clean anchor to inspect the folder before saving.
 * 6. Universal Zero Outline Policy: Strict outline: none across all states.
 */
export const LinkFolderModal: React.FC<LinkFolderModalProps> = ({
  isOpen,
  pointId,
  initialTitle = '',
  initialUrl = '',
  onClose,
  onSuccess,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();

  const [folderTitle, setFolderTitle] = useState(initialTitle);
  const [folderUrl, setFolderUrl] = useState(initialUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'verifying' | 'saving'>('idle');
  const [verificationResult, setVerificationResult] = useState<DriveVerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Automatically exit modal if developer mode is exited or inactive
  useEffect(() => {
    if (isOpen && (!isDevMode || !isDesktop)) {
      onClose();
    }
  }, [isOpen, isDevMode, isDesktop, onClose]);

  // Sync state whenever the modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      const isUrlEmpty = !initialUrl || initialUrl.trim().length === 0;
      const isDefaultTitle =
        initialTitle === 'Official Google Drive Folder' ||
        initialTitle === 'Evidence Folder' ||
        initialTitle === 'Attach Drive Folder';
      setFolderTitle(isUrlEmpty || isDefaultTitle ? '' : initialTitle);
      setFolderUrl(initialUrl);
      setIsProcessing(false);
      setProcessingStage('idle');
      setVerificationResult(null);
      setErrorMessage(null);

      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTitle, initialUrl]);

  // Synchronous dirty state calculation for beforeunload reload protection
  const isFormDirty = useMemo(() => {
    if (!isOpen) return false;
    return folderTitle.trim() !== initialTitle.trim() || folderUrl.trim() !== initialUrl.trim();
  }, [isOpen, folderTitle, folderUrl, initialTitle, initialUrl]);

  // Prevent accidental reload or navigation when folder form has unsaved modifications
  useUnsavedChangesPrompt(isOpen && isFormDirty, `link-folder-${pointId}`);

  const trimmedUrl = folderUrl.trim();
  const isValidUrl = isValidDriveFolderUrl(trimmedUrl);
  const isInvalidUrl = trimmedUrl.length > 0 && !isValidUrl;
  const canSave = isValidUrl && !isProcessing;

  // Optional manual verify to pre-populate folder name or inspect permissions early
  const handleVerify = useCallback(async () => {
    if (!isValidUrl || !trimmedUrl) return;

    setIsProcessing(true);
    setProcessingStage('verifying');
    setErrorMessage(null);

    try {
      const result = await verifyDriveFolderUrl(trimmedUrl);
      setVerificationResult(result);

      if (result.status === 'valid') {
        if (!folderTitle.trim() && result.folderTitle) {
          setFolderTitle(result.folderTitle);
        }
      } else if (result.status === 'restricted' || result.status === 'not_a_folder') {
        setErrorMessage(result.message || null);
      } else if (result.status === 'unverified' && result.message?.includes('[')) {
        setErrorMessage(result.message);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsProcessing(false);
      setProcessingStage('idle');
    }
  }, [isValidUrl, trimmedUrl, folderTitle]);

  // Save handler with Automated Verification Gate
  const handleSave = useCallback(async () => {
    if (!isValidUrl || !trimmedUrl || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const currentFolderId = extractDriveFolderId(trimmedUrl);
      let currentResult = verificationResult;

      // Automated Verification Gate: If not already verified for this folder ID, run verification now
      if (!currentResult || currentResult.folderId !== currentFolderId) {
        setProcessingStage('verifying');
        currentResult = await verifyDriveFolderUrl(trimmedUrl);
        setVerificationResult(currentResult);
      }

      // Gate Check: Block save if folder is invalid format or points to an individual file
      if (
        currentResult.status === 'not_a_folder' ||
        currentResult.status === 'invalid_format'
      ) {
        setErrorMessage(currentResult.message || 'Invalid folder format.');
        setIsProcessing(false);
        setProcessingStage('idle');
        return;
      }

      // Gate Check: If marked restricted, warn coordinator and block saving
      if (currentResult.status === 'restricted') {
        setErrorMessage(
          currentResult.message ||
            'Access restricted. Set Google Drive folder permissions to "Anyone with the link can view".'
        );
        setIsProcessing(false);
        setProcessingStage('idle');
        return;
      }

      // Gate Passed: Proceed to persist
      setProcessingStage('saving');
      const finalTitle =
        folderTitle.trim() || currentResult.folderTitle || 'Official Google Drive Folder';

      await upsertLiveSourceSource({
        pointId,
        folderUrl: trimmedUrl,
        folderTitle: finalTitle,
        updatedBy: 'Administrator',
      });

      // Task 6.3.4: Automated Initial Photo Sync Pipeline
      try {
        void syncFolderPhotos(pointId, trimmedUrl, []);
      } catch {
        // Non-blocking: background sync will be picked up on next view
      }

      setToastMessage('Folder link updated successfully.');
      onSuccess?.(trimmedUrl, finalTitle);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update folder link.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('idle');
    }
  }, [
    isValidUrl,
    trimmedUrl,
    isProcessing,
    verificationResult,
    folderTitle,
    pointId,
    onSuccess,
    onClose,
  ]);

  // Toast feedback can remain visible even if modal closes
  const toastMarkup = toastMessage ? (
    <Toast
      message={toastMessage}
      type="success"
      onDismiss={() => setToastMessage(null)}
    />
  ) : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={canSave ? () => handleSave() : undefined}
        title="Link Folder"
        maxWidth="480px"
        role="dialog"
        aria-modal="true"
        ariaLabelledBy="link-folder-title"
        ariaDescribedBy="link-folder-desc"
      >
        <p id="link-folder-desc" className={styles.subtitle}>
          Attach a Google Drive folder for photos and documents.
        </p>

        {/* Form Body */}
        <div className={styles.body}>
          {/* Folder Title Field */}
          <div className={styles.fieldGroup}>
            <label htmlFor="folder-title-input" className={styles.label}>
              Folder Label
            </label>
            <input
              ref={titleInputRef}
              id="folder-title-input"
              type="text"
              className={styles.input}
              value={folderTitle}
              onChange={(e) => setFolderTitle(e.target.value)}
              placeholder="e.g. Media & Documentation Folder"
              disabled={isProcessing}
            />
          </div>

          {/* Folder URL Field */}
          <div className={styles.fieldGroup}>
            <label htmlFor="folder-url-input" className={styles.label}>
              Google Drive Folder URL
            </label>
            <div className={styles.urlInputRow}>
              <input
                id="folder-url-input"
                type="url"
                className={`${styles.input} ${isInvalidUrl ? styles.inputInvalid : ''}`}
                value={folderUrl}
                onChange={(e) => {
                  setFolderUrl(e.target.value);
                  setVerificationResult(null);
                  setErrorMessage(null);
                }}
                placeholder="https://drive.google.com/drive/folders/..."
                disabled={isProcessing}
              />
              <Button
                variant="secondary"
                size="xs"
                type="button"
                onClick={handleVerify}
                disabled={!isValidUrl || isProcessing}
                title="Verify public access via Google Drive API"
              >
                {processingStage === 'verifying' && isProcessing ? 'Checking...' : 'Verify'}
              </Button>
            </div>

            {/* Verification feedback */}
            {processingStage === 'verifying' && isProcessing && (
              <div className={styles.feedbackChecking}>
                Checking Google Drive permissions...
              </div>
            )}
            {processingStage !== 'verifying' && verificationResult?.status === 'valid' && (
              <div className={styles.feedbackSuccess}>
                ✓ Public folder verified ({verificationResult.folderTitle})
              </div>
            )}
            {processingStage !== 'verifying' && isInvalidUrl && (
              <div className={styles.feedbackText}>
                Please enter a valid Google Drive folder link.
              </div>
            )}
          </div>

          {/* Inline Error Alert */}
          {errorMessage && (
            <div className={styles.errorAlert} role="alert">
              {errorMessage}
            </div>
          )}

          {/* Actions Footer */}
          <div className={styles.actions}>
            <div className={styles.actionAuxiliary}>
              {isValidUrl && (
                <a
                  href={trimmedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.testLink}
                  title="Open folder in a new tab to verify access"
                >
                  Test Link ↗
                </a>
              )}
            </div>

            <div className={styles.actionPrimary}>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={() => handleSave()}
                disabled={!canSave}
              >
                {processingStage === 'verifying'
                  ? 'Verifying...'
                  : processingStage === 'saving'
                  ? 'Saving...'
                  : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      {toastMarkup}
    </>
  );
};

export default LinkFolderModal;
