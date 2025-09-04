import React from 'react'

import {
  StyleSheet,
  Text,
  TextStyle,
} from 'react-native'

interface NeonTextProps {
  children: string;
  style?: TextStyle;
  color?: string;
  glowColor?: string;
}

export default function NeonText({
  children,
  style,
  color = '#00FFFF',
  glowColor = '#FF00FF',
}: NeonTextProps) {
  return (
    <Text
      style={[
        styles.neonText,
        {
          color: color,
          textShadowColor: glowColor,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  neonText: {
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
    fontWeight: '700',
    fontFamily: 'Sora-ExtraBold',
  },
}); 
