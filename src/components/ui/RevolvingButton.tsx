import React from 'react';
import { Button, ButtonProps } from './Button';

export type RevolvingButtonProps = Omit<ButtonProps, 'variant'>;

export const RevolvingButton: React.FC<RevolvingButtonProps> = (props) => {
  return <Button variant="revolving-outline" {...props} />;
};

export default RevolvingButton;
