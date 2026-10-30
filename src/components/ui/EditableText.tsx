import React from 'react';
import { useContent } from '../../hooks/useContent';
import { DevActionAffordance } from '../dev/DevActionAffordance';

export interface EditableTextProps {
  /** Dynamic content key in Content DB (e.g. 'hero.title', 'footer.orgName') */
  pointId: string;
  /** Hardcoded initial fallback text */
  defaultText: string;
  /** HTML element or component to render as (defaults to 'span') */
  as?: React.ElementType;
  /** Optional CSS class name */
  className?: string;
  /** Optional wrapper CSS class name for dev mode affordance */
  wrapperClassName?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Optional child element or render prop `(text: string) => React.ReactNode` */
  children?: React.ReactNode | ((resolvedText: string) => React.ReactNode);
  /** Accessibility label */
  ariaLabel?: string;
  /** Direct update handler if custom action needed on save */
  onSave?: (newValue: string) => void;
  /** Direct reset handler */
  onReset?: () => void;
  /** Optional custom edit handler to intercept edit clicks and delegate up */
  onEditText?: () => void;
  /** Whether to render as an inline container in dev mode */
  inline?: boolean;
  /** Whether the target content belongs to a section heading */
  isSection?: boolean;
  /** Whether the section is currently numbered */
  isNumbered?: boolean;
  /** Default numbering fallback */
  defaultNumbered?: boolean;
  /** Callback when section numbering is toggled */
  onNumberedChange?: (isNumbered: boolean) => void;
  /** Optional deterministic trigger identifier for canvas controls targeting */
  editTriggerId?: string;
}

/**
 * EditableText Component (Canonical Typography Primitive)
 *
 * Implements universal in-place editing across all portal views in Developer Mode:
 * - Reads reactively from Content DB via useContent
 * - Displays discrete '✎ Edit' button on hover when Developer Mode is active (PIN 1997)
 * - Returns pure rendered content with ZERO wrapping markup in public mode
 * - Strictly adheres to Uniform Administrative Edit Button Standard and Universal Zero Outline Policy
 */
export const EditableText: React.FC<EditableTextProps> = ({
  pointId,
  defaultText,
  as: Component = 'span',
  className,
  wrapperClassName,
  style,
  children,
  ariaLabel,
  onSave,
  onReset,
  onEditText,
  inline = false,
  isSection,
  isNumbered,
  defaultNumbered,
  onNumberedChange,
  editTriggerId,
}) => {
  const { text } = useContent(pointId, defaultText);

  let renderedContent: React.ReactNode;
  if (typeof children === 'function') {
    renderedContent = children(text);
  } else if (children !== undefined && children !== null) {
    renderedContent = children;
  } else {
    renderedContent = (
      <Component className={className} style={style} aria-label={ariaLabel}>
        {text}
      </Component>
    );
  }

  return (
    <DevActionAffordance
      pointId={pointId}
      type="text"
      defaultValue={defaultText}
      currentValue={text}
      onEditText={onEditText}
      onSave={onSave}
      onReset={onReset}
      className={wrapperClassName}
      inline={inline}
      isSection={isSection}
      isNumbered={isNumbered}
      defaultNumbered={defaultNumbered}
      onNumberedChange={onNumberedChange}
      editTriggerId={editTriggerId}
    >
      {renderedContent}
    </DevActionAffordance>
  );
};

export default EditableText;
