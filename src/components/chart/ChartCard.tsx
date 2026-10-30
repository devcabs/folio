import React from "react";
export interface ChartCardProps {
  chartId: string;
  nodeId?: string;
  className?: string;
  [key: string]: any;
}
export const ChartCard: React.FC<ChartCardProps> = ({ chartId }) => (
  <div data-chart-id={chartId}>Chart: {chartId}</div>
);
export default ChartCard;
