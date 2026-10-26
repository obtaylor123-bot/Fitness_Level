import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

/** Shared defaults keep touch controls exposed to screen readers and keyboard focus. */
export default function AccessibleTouchable(props: TouchableOpacityProps) {
  return (
    <TouchableOpacity
      {...props}
      accessible
      focusable
      accessibilityRole={props.accessibilityRole ?? 'button'}
    />
  );
}
