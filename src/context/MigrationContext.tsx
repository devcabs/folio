/**
 * MigrationContext
 *
 * Dedicated context and state provider for runtime migration inspection,
 * pending migration calculations, AI prompt generation, and modal presentation.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. ZERO IMPORTS from developer mode context (prevent circular dependencies).
 * 2. Developer mode provider must never re-render on migration modal lifecycle changes.
 * 3. Single-source watermark: resolved strictly from EngineConfig.contentVersion.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { EngineConfig } from '../config/engine.config';
import { getEngineConfig } from '../config/engine.config';
import { resolveContentWatermark } from '../utils/watermarkResolver';
import { getPendingMigrations } from '../services/migrationService';
import { generateAiMigrationPrompt } from '../utils/migrationPromptFormatter';
import type { PendingMigrationReport } from '../types/migration';

export interface MigrationContextType {
  pendingReport: PendingMigrationReport | null;
  isMigrationModalOpen: boolean;
  openMigrationModal(): void;
  closeMigrationModal(): void;
  markAsMigrated(): void;
  generatePrompt(): string;
}

export interface MigrationProviderProps {
  engineConfig?: EngineConfig;
  children?: React.ReactNode;
}

const MigrationContext = createContext<MigrationContextType | null>(null);

export const MigrationProvider: React.FC<MigrationProviderProps> = ({
  engineConfig,
  children,
}) => {
  const [pendingReport, setPendingReport] = useState<PendingMigrationReport | null>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState<boolean>(false);

  const activeConfig = engineConfig ?? getEngineConfig();

  // On mount, inspect ledger against EngineConfig.contentVersion
  useEffect(() => {
    const watermark = resolveContentWatermark(activeConfig?.contentVersion);
    const report = getPendingMigrations(watermark);
    setPendingReport(report);
  }, [activeConfig?.contentVersion]);

  const openMigrationModal = useCallback(() => {
    setIsMigrationModalOpen(true);
  }, []);

  const closeMigrationModal = useCallback(() => {
    setIsMigrationModalOpen(false);
  }, []);

  const markAsMigrated = useCallback(() => {
    const targetVersion =
      pendingReport?.currentEngineVersion ??
      getPendingMigrations().currentEngineVersion;

    setPendingReport({
      currentEngineVersion: targetVersion,
      contentVersionWatermark: targetVersion,
      hasPendingContentChanges: false,
      pendingContentChanges: [],
      unappliedVersions: [],
    });
  }, [pendingReport]);

  const generatePrompt = useCallback((): string => {
    if (!pendingReport) {
      return '';
    }
    return generateAiMigrationPrompt(pendingReport);
  }, [pendingReport]);

  const contextValue = useMemo<MigrationContextType>(
    () => ({
      pendingReport,
      isMigrationModalOpen,
      openMigrationModal,
      closeMigrationModal,
      markAsMigrated,
      generatePrompt,
    }),
    [
      pendingReport,
      isMigrationModalOpen,
      openMigrationModal,
      closeMigrationModal,
      markAsMigrated,
      generatePrompt,
    ]
  );

  return (
    <MigrationContext.Provider value={contextValue}>
      {children}
    </MigrationContext.Provider>
  );
};

export function useMigrationContext(): MigrationContextType {
  const context = useContext(MigrationContext);
  if (!context) {
    throw new Error('useMigrationContext must be used within a <MigrationProvider>');
  }
  return context;
}
