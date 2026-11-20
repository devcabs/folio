import React from 'react';

export interface PageIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

/**
 * Thin-stroke editorial page/sheet outline icon.
 * Consumed by CanvasAddBar, CanvasPageLink, and page navigation controls.
 */
export const PageIcon: React.FC<PageIconProps> = ({
  size = 16,
  strokeWidth = 1.75,
  className,
  'aria-hidden': ariaHidden = true,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);

export default PageIcon;
