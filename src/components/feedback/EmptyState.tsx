import React from "react";
export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionLabel?: string;
  variant?: string;
  onAction?: () => void;
  className?: string;
  [key: string]: any;
}
export const EmptyState: React.FC<EmptyStateProps> = ({ title = "No items found" }) => (
  <div>{title}</div>
);
export default EmptyState;
