import React, { memo } from 'react';
import type { ChartElement } from '../../types/canvas';
import type { NodeCode } from '../../types/node';
import { ChartCard } from '../chart/ChartCard';
import { useSheetChartData } from '../../hooks/useSheetChartData';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './CanvasLeaf.module.css';

import type { ChartDataset, SheetChartConfig } from '../../types/chart';

export interface CanvasChartProps {
  element: ChartElement;
  nodeId: string;
  nodeTitle?: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  onUpdateElement?: (
    elementId: string,
    updates: Partial<ChartElement>
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
}

/**
 * CanvasChart Component
 * Folio Engine — Task 8.3.3 & Subtask 7.7: Canvas Leaf Elements (Chart)
 *
 * Renders indicator data visualizers on the Dynamic Canvas:
 * - Wires useSheetChartData strictly with the self-contained ChartElement AST node
 * - Mounts canonical ChartCard.tsx
 * - Persists config & dataset updates directly into the NodeCanvasDocument AST via onUpdateElement
 * - Memoized with React.memo (Vercel Best Practice rerender-memo)
 * - Zero parentheses in UI and Universal Zero Outline Policy adherence
 */
export const CanvasChart: React.FC<CanvasChartProps> = memo(({
  element,
  nodeId,
  nodeTitle,
  accentColor,
  isDevMode: isDevModeProp,
  className,
  onUpdateElement,
}) => {
  const { isDevMode: isDevContext } = useDeveloperMode();
  const isDevMode = isDevModeProp ?? isDevContext;

  const handleElementUpdate = React.useCallback(
    (updates: Partial<ChartElement>) => {
      if (!onUpdateElement) return undefined;
      return onUpdateElement(element.id, updates);
    },
    [onUpdateElement, element.id]
  );

  const { dataset, config, status, errorMessage, syncLiveSheet } = useSheetChartData({
    chartId: element.chartId,
    nodeId: nodeId as NodeCode,
    element,
    isDevMode,
    onUpdateElement: onUpdateElement ? handleElementUpdate : undefined,
  });

  const handleConfigUpdated = React.useCallback(
    async (updatedConfig: SheetChartConfig, updatedDataset?: ChartDataset) => {
      if (!onUpdateElement) return undefined;
      return onUpdateElement(element.id, {
        config: updatedConfig,
        ...(updatedDataset ? { dataset: updatedDataset } : {}),
        title: updatedConfig.titleOverride || updatedDataset?.title || element.title,
        subtitle: updatedConfig.subtitleOverride ?? updatedDataset?.subtitle ?? element.subtitle,
      });
    },
    [onUpdateElement, element.id, element.title, element.subtitle]
  );

  return (
    <div className={`${styles.chartContainer} ${className || ''}`.trim()}>
      <ChartCard
        chartId={element.chartId}
        dataset={dataset}
        config={config as SheetChartConfig | null}
        status={status}
        errorMessage={errorMessage}
        nodeId={nodeId as NodeCode}
        nodeTitle={nodeTitle}
        accentColor={accentColor}
        editTriggerId={element.id}
        onConfigUpdated={handleConfigUpdated}
        onSync={syncLiveSheet}
        isSyncing={status === 'syncing'}
      />
    </div>
  );
});

CanvasChart.displayName = 'CanvasChart';

export default CanvasChart;
