import React, { memo } from 'react';
import type { ChartElement } from '../../types/canvas';
import type { NodeCode } from '../../types/node';
import { ChartCard } from '../chart/ChartCard';
import { useSheetChartData } from '../../hooks/useSheetChartData';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './CanvasLeaf.module.css';

export interface CanvasChartProps {
  element: ChartElement;
  nodeId: string;
  nodeTitle?: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
}

/**
 * CanvasChart Component
 * Folio Engine — Task 8.3.3: Canvas Leaf Elements (Chart)
 *
 * Renders indicator data visualizers on the Dynamic Canvas:
 * - Wires useSheetChartData with element.chartId and nodeId
 * - Mounts canonical ChartCard.tsx
 * - Renders DataPendingCard fallback by default when unconfigured, with '✎ Edit' button wired to ChartConfigDrawer
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
}) => {
  const { isDevMode: isDevContext } = useDeveloperMode();
  const isDevMode = isDevModeProp ?? isDevContext;

  const { dataset, config, reload, status, errorMessage, syncLiveSheet } = useSheetChartData({
    chartId: element.chartId,
    nodeId: nodeId as NodeCode,
    isDevMode,
  });

  return (
    <div className={`${styles.chartContainer} ${className || ''}`.trim()}>
      <ChartCard
        chartId={element.chartId}
        dataset={dataset}
        config={config}
        status={status}
        errorMessage={errorMessage}
        nodeId={nodeId as NodeCode}
        nodeTitle={nodeTitle}
        accentColor={accentColor}
        editTriggerId={element.id}
        onConfigUpdated={() => {
          reload();
        }}
        onSync={syncLiveSheet}
        isSyncing={status === 'syncing'}
      />
    </div>
  );
});

CanvasChart.displayName = 'CanvasChart';

export default CanvasChart;
