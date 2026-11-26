import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal, ModalActions } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import { InlineAlert } from '../ui/InlineAlert';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { DocumentsLayout } from '../../types/canvas';
import { isValidDriveFolderUrl } from '../../utils/source';
import {
  verifyDriveFolderUrl,
  extractDriveFolderId,
  type DriveVerificationResult,
} from '../../services/driveVerificationService';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { Toast } from '../feedback/Toast';
import styles from './LinkFolderModal.module.css';

export interface LinkFolderModalProps {
  isOpen: boolean;
  pointId: string;
  initialTitle?: string;
  initialUrl?: string;
  showLayoutOption?: boolean;
  initialLayout?: DocumentsLayout;
  onClose: () => void;
  onSuccess?: (
    updatedUrl: string,
    updatedTitle: string,
    updatedLayout?: DocumentsLayout
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
}

const DOCUMENTS_LAYOUT_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'sm', label: 'Small' },
] as const;

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
  showLayoutOption = false,
  initialLayout = 'list',
  onClose,
  onSuccess,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();

  const [folderTitle, setFolderTitle] = useState(initialTitle);
  const [folderUrl, setFolderUrl] = useState(initialUrl);
  const [layout, setLayout] = useState<DocumentsLayout>(initialLayout);
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
      setLayout(initialLayout);
      setIsProcessing(false);
      setProcessingStage('idle');
      setVerificationResult(null);
      setErrorMessage(null);

      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTitle, initialUrl, initialLayout]);

  // Synchronous dirty state calculation for beforeunload reload protection
  const isFormDirty = useMemo(() => {
    if (!isOpen) return false;
    return (
      folderTitle.trim() !== initialTitle.trim() ||
      folderUrl.trim() !== initialUrl.trim() ||
      (showLayoutOption && layout !== initialLayout)
    );
  }, [isOpen, folderTitle, folderUrl, initialTitle, initialUrl, showLayoutOption, layout, initialLayout]);

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

      // Gate Check: Fail stop unless Google Drive API explicitly verified the folder as valid
      if (currentResult.status !== 'valid') {
        setErrorMessage(
          currentResult.message ||
          'Folder could not be verified. Set Google Drive folder permissions to "Anyone with the link can view" and ensure the API key is configured.'
        );
        setIsProcessing(false);
        setProcessingStage('idle');
        return;
      }

      // Gate Passed: Proceed to persist directly onto GalleryElement AST (PUT /api/draft)
      setProcessingStage('saving');
      const finalTitle =
        folderTitle.trim() || currentResult.folderTitle || 'Official Google Drive Folder';

      const persistResult = await onSuccess?.(
        trimmedUrl,
        finalTitle,
        showLayoutOption ? layout : undefined
      );
      if (
        persistResult &&
        typeof persistResult === 'object' &&
        'ok' in persistResult &&
        !persistResult.ok
      ) {
        throw new Error(persistResult.error || 'Failed to persist folder link to draft KV.');
      }

      setToastMessage('Folder link updated successfully.');
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
    showLayoutOption,
    layout,
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
          <FormField id="folder-title-input" label="Folder Label">
            <Input
              ref={titleInputRef}
              id="folder-title-input"
              type="text"
              value={folderTitle}
              onChange={(e) => setFolderTitle(e.target.value)}
              placeholder="e.g. Media & Documentation Folder"
              disabled={isProcessing}
            />
          </FormField>

          {/* Folder URL Field */}
          <FormField id="folder-url-input" label="Google Drive Folder URL">
            <div className={styles.urlInputRow}>
              <Input
                id="folder-url-input"
                type="url"
                invalid={isInvalidUrl}
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
          </FormField>

          {/* Inline Error Alert */}
          {errorMessage && (
            <InlineAlert variant="error">
              {errorMessage}
            </InlineAlert>
          )}

          {/* Display Layout Option (Documents Canvas Element) */}
          {showLayoutOption && (
            <FormField id="documents-layout-input" label="Display Layout" role="group">
              <SegmentedControl
                label="Display Layout"
                aria-label="Display Layout"
                options={DOCUMENTS_LAYOUT_OPTIONS}
                value={layout}
                onChange={(nextLayout) => setLayout(nextLayout)}
                disabled={isProcessing}
              />
            </FormField>
          )}

          {/* Actions Footer */}
          <ModalActions
            className={styles.actions}
            left={
              isValidUrl ? (
                <a
                  href={trimmedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.testLink}
                  title="Open folder in a new tab to verify access"
                >
                  Test Link ↗
                </a>
              ) : undefined
            }
          >
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
          </ModalActions>
        </div>
      </Modal>
      {toastMarkup}
    </>
  );
};

export default LinkFolderModal;
