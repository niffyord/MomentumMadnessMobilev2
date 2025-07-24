import React, { ReactNode } from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import {
  Image,
  StyleSheet,
  View,
} from 'react-native'

import NeonTrackBackground from './NeonTrackBackground'

interface Props {
  children: ReactNode;
}

export default function CosmicBackground({children}: Props) {
  return (
    <View style={styles.container}>
      {/* Layer 1 – cosmic gradient */}
      <LinearGradient
        colors={['#000814', '#001D3D', '#003566', '#000814']}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2 – star field */}
      <Image
        source={require('../assets/images/starfield_sprite2.png')}
        style={[StyleSheet.absoluteFill, {opacity: 0.6}]}
        resizeMode="cover"
        fadeDuration={0}
      />

      {/* Layer 2b – star glow overlay */}
      <Image
        source={require('../assets/images/starfield_sprite.png')}
        style={[StyleSheet.absoluteFill, {opacity: 0.3, tintColor: '#00FFFF'}]}
        blurRadius={12}
        resizeMode="cover"
        fadeDuration={0}
      />

      {/* Layer 3 – animated neon racing tracks */}
      <NeonTrackBackground />

      {/* Layer 4 – vignette for depth */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.3)']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[StyleSheet.absoluteFill, {opacity: 0.5}]}
      />

      {/* children go above all background layers */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 