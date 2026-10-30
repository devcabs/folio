import { useState, useEffect, useMemo } from 'react';
import { useContent } from './useContent';
import { getContent, subscribeToContentChange } from '../utils/contentDb';
import { useDeveloperMode } from './useDeveloperMode';
import type { SectionElement } from '../types/canvas';

export interface DynamicSectionItem {
  id: string;
  isNumbered: boolean;
}

/**
 * Pure function to compute sequential section numbers skipping unnumbered sections.
 * e.g.:
 *   [numbered, numbered] -> { sec1: "01", sec2: "02" }
 *   [unnumbered, numbered] -> { sec1: null, sec2: "01" } (preceding section skipped in iteration)
 *   [numbered, unnumbered, numbered] -> { sec1: "01", sec2: null, sec3: "02" }
 */
export function computeDynamicSectionNumbers(
  sections: DynamicSectionItem[]
): Record<string, string | null> {
  let counter = 1;
  const numbers: Record<string, string | null> = {};

  for (const section of sections) {
    if (section.isNumbered) {
      numbers[section.id] = String(counter).padStart(2, '0');
      counter++;
    } else {
      numbers[section.id] = null;
    }
  }

  return numbers;
}

export interface UseNodeSectionNumbersReturn {
  isSourceNumbered: boolean;
  isChartNumbered: boolean;
  sourceNumber: string | null;
  chartNumber: string | null;
}

/**
 * Reactive hook providing dynamic section numbers for PillarPage.
 * If Evidence Gallery is unnumbered, Indicator Chart dynamically increments from 01.
 */
export function useNodeSectionNumbers(nodeId: string): UseNodeSectionNumbersReturn {
  const sourceKey = `node.${nodeId}.section.source.title.isNumbered`;
  const chartKey = `node.${nodeId}.section.chart.title.isNumbered`;

  const { text: sourceNumberedVal } = useContent(sourceKey, 'true');
  const { text: chartNumberedVal } = useContent(chartKey, 'true');

  const isSourceNumbered = sourceNumberedVal === 'true';
  const isChartNumbered = chartNumberedVal === 'true';

  const numbers = computeDynamicSectionNumbers([
    { id: 'source', isNumbered: isSourceNumbered },
    { id: 'chart', isNumbered: isChartNumbered },
  ]);

  return {
    isSourceNumbered,
    isChartNumbered,
    sourceNumber: numbers['source'],
    chartNumber: numbers['chart'],
  };
}

/**
 * Reactive hook providing sequential section numbers for dynamic canvas sections.
 * Reactively recalculates whenever a section's numbering toggle is updated in Content DB.
 */
export function useDynamicCanvasSectionNumbers(
  nodeId: string,
  sections: SectionElement[]
): Record<string, string | null> {
  const { isDevMode } = useDeveloperMode();
  const [contentVersion, setContentVersion] = useState(0);

  useEffect(() => {
    return subscribeToContentChange((detail) => {
      const changedKey = detail?.key;
      if (!changedKey || changedKey === '*' || (typeof changedKey === 'string' && changedKey.includes('.isNumbered'))) {
        setContentVersion((v) => v + 1);
      }
    }, isDevMode);
  }, [isDevMode]);

  return useMemo(() => {
    const items: DynamicSectionItem[] = sections.map((sec) => {
      const titlePointId = sec.titlePointId || `node.${nodeId}.section.${sec.id}.title`;
      const isNumberedKey = `${titlePointId}.isNumbered`;
      const stored = getContent(isNumberedKey, '', isDevMode);
      const defaultNumbered = sec.isNumbered !== undefined
        ? sec.isNumbered
        : (sec.number !== undefined && sec.number !== null);
      const isNumbered = stored !== '' ? stored === 'true' : defaultNumbered;

      return {
        id: sec.id,
        isNumbered,
      };
    });

    return computeDynamicSectionNumbers(items);
  }, [nodeId, sections, contentVersion, isDevMode]);
}

export default useNodeSectionNumbers;
