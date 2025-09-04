import React, { useState } from 'react'

import * as Haptics from 'expo-haptics'
import { Stack } from 'expo-router'
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useWalletUi } from '@/components/solana/use-wallet-ui'
import { useNotification } from '@/components/ui/NotificationProvider'
import { ellipsify } from '@/utils/ellipsify'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Clipboard from '@react-native-clipboard/clipboard'

function DemoHeader() {
  const { account, disconnect } = useWalletUi()
  const insets = useSafeAreaInsets()
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const { showSuccess, showError } = useNotification()
  
  const handleCopyAddress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (account) {
      try {
        Clipboard.setString(account.publicKey.toString())
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showSuccess('Wallet address copied to clipboard', '✨ Address Copied')
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        showError('Failed to copy address to clipboard', '❌ Copy Failed')
      }
    }
    setShowWalletMenu(false)
  }

  const handleViewOnExplorer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (account) {
      const explorerUrl = `https://explorer.solana.com/address/${account.publicKey.toString()}`
      Linking.openURL(explorerUrl).catch(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        showError('Failed to open Solana Explorer', '🌐 Browser Error')
      })
    }
    setShowWalletMenu(false)
  }

  const handleDisconnect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // For disconnect, we can show a warning notification and then disconnect
    // Or keep the Alert for confirmation since it's a destructive action
    disconnect()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    showSuccess('Wallet disconnected successfully', '👋 Disconnected')
    setShowWalletMenu(false)
  }
  
  return (
    <>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: '#000814',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
      }}>
        {/* Page Title */}
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: '#fff',
            fontFamily: 'Sora-Bold',
            letterSpacing: 0.5,
          }}>
            Momentum Madness
          </Text>
          <Text style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Inter-Medium',
            letterSpacing: 0.2,
          }}>
            DEVNET
          </Text>
        </View>
        
        {/* Wallet Info */}
        {account ? (
          <TouchableOpacity 
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(153, 69, 255, 0.2)',
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: 'rgba(153, 69, 255, 0.3)',
            }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowWalletMenu(true)
            }}
          >
            <MaterialCommunityIcons 
              name="wallet" 
              size={16} 
              color="#9945FF" 
              style={{ marginRight: 8 }}
            />
            <View>
              <Text style={{
                fontSize: 12,
                color: '#9945FF',
                fontWeight: '600',
                fontFamily: 'Inter-SemiBold',
              }}>
                {ellipsify(account.publicKey.toString(), 4)}
              </Text>
              <Text style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Inter-Regular',
              }}>
                Connected
              </Text>
            </View>
            <MaterialCommunityIcons 
              name="chevron-down" 
              size={14} 
              color="rgba(255,255,255,0.7)" 
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(20, 241, 149, 0.2)',
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: 'rgba(20, 241, 149, 0.3)',
            }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          >
            <MaterialCommunityIcons 
              name="wallet-plus" 
              size={16} 
              color="#14F195" 
              style={{ marginRight: 8 }}
            />
            <Text style={{
              fontSize: 12,
              color: '#14F195',
              fontWeight: '600',
              fontFamily: 'Inter-SemiBold',
            }}>
              Connect Wallet
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Wallet Menu Modal */}
      <Modal
        visible={showWalletMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWalletMenu(false)}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowWalletMenu(false)}
        >
          <View style={{
            backgroundColor: '#001D3D',
            borderRadius: 16,
            padding: 20,
            width: '85%',
            maxWidth: 320,
            borderWidth: 1,
            borderColor: 'rgba(153, 69, 255, 0.3)',
          }}>
            {/* Header */}
            <View style={{ marginBottom: 20, alignItems: 'center' }}>
              <MaterialCommunityIcons name="wallet" size={32} color="#9945FF" />
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#fff',
                fontFamily: 'Sora-Bold',
                marginTop: 8,
              }}>
                Wallet Options
              </Text>
              <Text style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Inter-Regular',
                textAlign: 'center',
                marginTop: 4,
              }}>
                {ellipsify(account?.publicKey.toString() || '', 8)}
              </Text>
            </View>

            {/* Menu Options */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: 'rgba(20, 241, 149, 0.1)',
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: 'rgba(20, 241, 149, 0.2)',
              }}
              onPress={handleCopyAddress}
            >
              <MaterialCommunityIcons name="content-copy" size={20} color="#14F195" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#14F195',
                  fontFamily: 'Inter-SemiBold',
                }}>
                  Copy Address
                </Text>
                <Text style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Inter-Regular',
                }}>
                  Copy wallet address to clipboard
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 193, 7, 0.2)',
              }}
              onPress={handleViewOnExplorer}
            >
              <MaterialCommunityIcons name="open-in-new" size={20} color="#FFC107" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#FFC107',
                  fontFamily: 'Inter-SemiBold',
                }}>
                  View on Explorer
                </Text>
                <Text style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Inter-Regular',
                }}>
                  Open wallet in Solana Explorer
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                borderRadius: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(244, 67, 54, 0.2)',
              }}
              onPress={handleDisconnect}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#F44336" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#F44336',
                  fontFamily: 'Inter-SemiBold',
                }}>
                  Disconnect Wallet
                </Text>
                <Text style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Inter-Regular',
                }}>
                  Sign out from this wallet
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={{
                padding: 12,
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
              }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setShowWalletMenu(false)
              }}
            >
              <Text style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'Inter-Regular',
              }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

export default function DemoLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: true,
          header: () => <DemoHeader />,
          title: 'Demo'
        }} 
      />
    </Stack>
  )
}
