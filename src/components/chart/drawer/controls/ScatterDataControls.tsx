import React from 'react';
import { ColumnSelect, AccordionSection } from '../../../ui';

interface ScatterDataControlsProps {
  effectiveScatterX: number;
  setScatterXColIndex: (val: number) => void;
  effectiveScatterY: number;
  setScatterYColIndex: (val: number) => void;
  effectiveScatterLabel: number;
  setScatterLabelColIndex: (val: number) => void;
  scatterGroupColIndex?: number;
  setScatterGroupColIndex: (val?: number) => void;
  detectedColumns: Array<{ index: number; label: string }>;
}

export const ScatterDataControls: React.FC<ScatterDataControlsProps> = ({
  effectiveScatterX,
  setScatterXColIndex,
  effectiveScatterY,
  setScatterYColIndex,
  effectiveScatterLabel,
  setScatterLabelColIndex,
  scatterGroupColIndex,
  setScatterGroupColIndex,
  detectedColumns,
}) => {
  return (
    <>
      <AccordionSection name="chart-data" title="Axes Mapping" defaultOpen={true}>
        <ColumnSelect
          id="cfg-scatter-x-col"
          label="X-Axis Metric (Horizontal)"
          value={effectiveScatterX}
          onChange={(newCol: number) => setScatterXColIndex(newCol)}
          columns={detectedColumns.map((c) => ({
            index: c.index,
            label: c.label,
            type: 'number',
          }))}
        />

        <ColumnSelect
          id="cfg-scatter-y-col"
          label="Y-Axis Metric (Vertical)"
          value={effectiveScatterY}
          onChange={(newCol: number) => setScatterYColIndex(newCol)}
          columns={detectedColumns.map((c) => ({
            index: c.index,
            label: c.label,
            type: 'number',
          }))}
        />
      </AccordionSection>

      <AccordionSection name="chart-data" title="Point Labels & Grouping" defaultOpen={false}>
        <ColumnSelect
          id="cfg-scatter-label-col"
          label="Point Tooltip Label"
          value={effectiveScatterLabel}
          onChange={(newCol: number) => setScatterLabelColIndex(newCol)}
          columns={detectedColumns.map((c) => ({
            index: c.index,
            label: c.label,
            type: 'text',
          }))}
        />

        <ColumnSelect
          id="cfg-scatter-group-col"
          label="Grouping Category (Color)"
          value={scatterGroupColIndex ?? -1}
          onChange={(newCol: number) => setScatterGroupColIndex(newCol >= 0 ? newCol : undefined)}
          columns={[
            { index: -1, label: 'Single Color', type: 'text' },
            ...detectedColumns.map((c) => ({
              index: c.index,
              label: c.label,
              type: 'text' as const,
            })),
          ]}
        />
      </AccordionSection>
    </>
  );
};


