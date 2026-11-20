import React from 'react';
import { Checkbox } from './Checkbox';

export interface ValueLabelToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  className?: string;
}

/**
 * @deprecated Use canonical `Checkbox` from `src/components/ui/Checkbox` instead.
 */
export const ValueLabelToggle: React.FC<ValueLabelToggleProps> = ({
  id = 'cfg-show-values',
  checked,
  onChange,
  label = 'Show values on bars',
  hint,
  className = '',
}) => {
  return (
    <Checkbox
      id={id}
      checked={checked}
      onChange={onChange}
      label={label}
      hint={hint}
      className={className}
    />
  );
};
