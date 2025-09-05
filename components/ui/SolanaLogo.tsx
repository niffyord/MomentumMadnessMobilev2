import React from 'react'
import Svg, { Defs, LinearGradient, Stop, Rect, G } from 'react-native-svg'

export function SolanaLogo({ size = 18 }: { size?: number }) {
  const w = size
  const h = size
  const barW = size * 0.7
  const barH = Math.max(2, Math.round(size * 0.18))
  const rx = barH / 2
  const cx = w / 2
  const startX = cx - barW / 2
  const gap = Math.max(2, Math.round(size * 0.16))

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id="solGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#9945FF" />
          <Stop offset="100%" stopColor="#14F195" />
        </LinearGradient>
      </Defs>
      <G transform={`rotate(-14 ${cx} ${h / 2})`}>
        <Rect x={startX} y={h / 2 - barH - gap} width={barW} height={barH} rx={rx} fill="url(#solGrad)" />
        <Rect x={startX} y={h / 2 - barH / 2} width={barW} height={barH} rx={rx} fill="url(#solGrad)" />
        <Rect x={startX} y={h / 2 + gap} width={barW} height={barH} rx={rx} fill="url(#solGrad)" />
      </G>
    </Svg>
  )
}

export default SolanaLogo

