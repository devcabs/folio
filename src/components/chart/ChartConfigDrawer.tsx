import React from "react";
export interface ChartConfigDrawerProps {
  isOpen: boolean;
  chartId?: string;
  nodeId?: any;
  mode?: "add" | "edit";
  onClose: () => void;
  onSave?: (config: any) => void;
  onDeployed?: (config: any) => void;
  [key: string]: any;
}
export const ChartConfigDrawer: React.FC<ChartConfigDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return <div>ChartConfigDrawer <button type="button" onClick={onClose}>Close</button></div>;
};
export default ChartConfigDrawer;
