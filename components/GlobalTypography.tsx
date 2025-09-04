import { useEffect } from 'react'
import { Text, TextInput } from 'react-native'

// Ensures Orbitron is the default font app-wide for any Text/TextInput
export default function GlobalTypography() {
  useEffect(() => {
    // Preserve any existing default styles and append our font family
    const defaultTextStyle = { fontFamily: 'Inter-Regular' as const }

    // @ts-ignore - React Native host components still support defaultProps
    Text.defaultProps = Text.defaultProps || {}
    // @ts-ignore
    Text.defaultProps.style = [Text.defaultProps.style, defaultTextStyle]

    // @ts-ignore - React Native host components still support defaultProps
    TextInput.defaultProps = TextInput.defaultProps || {}
    // @ts-ignore
    TextInput.defaultProps.style = [TextInput.defaultProps.style, defaultTextStyle]
  }, [])

  return null
}
