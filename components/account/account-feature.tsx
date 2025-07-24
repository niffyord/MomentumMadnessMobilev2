import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useRaceStore } from '../../store/useRaceStore'
import { useConnection } from '../solana/solana-provider'
import { useWalletUi } from '../solana/use-wallet-ui'

// Responsive design tokens
const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
const isTablet = screenWidth >= 768
const isLandscape = screenWidth > screenHeight

// Accessibility constants
const MIN_TOUCH_TARGET = 44
const ANIMATION_REDUCE_MOTION = false

// Design tokens for consistency (matching race screen)
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

const COLORS = {
  success: '#00FF88',
  error: '#FF4444',
  warning: '#FFD700',
  primary: '#9945FF',
  secondary: '#14F195',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.8)',
    tertiary: 'rgba(255,255,255,0.6)',
  },
  accent: {
    purple: '#9945FF',
    green: '#14F195',
    gold: '#FFD700',
    orange: '#FFA500',
  }
} as const

const TYPOGRAPHY = {
  display: { fontSize: isTablet ? 32 : 28, lineHeight: isTablet ? 40 : 36 },
  title: { fontSize: isTablet ? 24 : 20, lineHeight: isTablet ? 32 : 28 },
  subtitle: { fontSize: isTablet ? 18 : 16, lineHeight: isTablet ? 26 : 24 },
  body: { fontSize: isTablet ? 16 : 14, lineHeight: isTablet ? 24 : 20 },
  caption: { fontSize: isTablet ? 14 : 12, lineHeight: isTablet ? 20 : 18 },
  small: { fontSize: isTablet ? 12 : 10, lineHeight: isTablet ? 18 : 16 },
} as const

// Enhanced TypeScript interfaces
interface UserPosition {
  raceId: number
  assetIdx: number
  assetSymbol: string
  amount: number
  claimed: boolean
  isWinner: boolean | null
  potentialPayout: number | null
  raceState: 'Betting' | 'Running' | 'Settled'
  performance?: number
  timestamp?: number
}

interface PortfolioStats {
  totalBets: number
  totalWagered: number
  totalWon: number
  totalClaimed: number
  winRate: number
  netProfit: number
  activeBets: number
  unclaimedRewards: number
  unclaimedValue: number
}

interface HistoryGroup {
  date: string
  positions: UserPosition[]
  totalWon: number
  totalLost: number
  netResult: number
}

// Enhanced Position Card Component
const PositionCard: React.FC<{
  position: UserPosition
  onClaim: (raceId: number) => void
  onViewRace: (raceId: number) => void
  formatValue: (value: number) => string
  isHistory?: boolean
  isUnclaimed?: boolean
}> = React.memo(({ position, onClaim, onViewRace, formatValue, isHistory = false, isUnclaimed = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  // Status determination with enhanced logic
  const statusInfo = useMemo(() => {
    if (position.claimed) {
      return {
        color: COLORS.text.tertiary,
        text: 'CLAIMED',
        icon: 'check-circle' as any,
        gradient: ['rgba(102, 102, 102, 0.2)', 'rgba(102, 102, 102, 0.05)', 'rgba(0, 0, 0, 0.8)'] as const
      }
    }
    if (position.isWinner) {
      return {
        color: COLORS.success,
        text: 'WON',
        icon: 'trophy' as any,
        gradient: ['rgba(0, 255, 136, 0.3)', 'rgba(255, 215, 0, 0.2)', 'rgba(0, 0, 0, 0.8)'] as const
      }
    }
    if (position.raceState === 'Betting' || position.raceState === 'Running') {
      return {
        color: COLORS.secondary,
        text: 'ACTIVE',
        icon: 'play-circle' as any,
        gradient: ['rgba(20, 241, 149, 0.3)', 'rgba(153, 69, 255, 0.2)', 'rgba(0, 0, 0, 0.8)'] as const
      }
    }
    return {
      color: COLORS.error,
      text: 'LOST',
      icon: 'close-circle' as any,
      gradient: ['rgba(255, 68, 68, 0.2)', 'rgba(255, 68, 68, 0.1)', 'rgba(0, 0, 0, 0.8)'] as const
    }
  }, [position.claimed, position.isWinner, position.raceState])

  // Winner glow animation
  useEffect(() => {
    if (position.isWinner && !position.claimed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start()
    }
  }, [position.isWinner, position.claimed])

  const handleClaim = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start()
    
    // Medium impact for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    onClaim(position.raceId)
  }, [onClaim, position.raceId, scaleAnim])

  const handleViewRace = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onViewRace(position.raceId)
  }, [onViewRace, position.raceId])

  return (
    <TouchableOpacity 
      activeOpacity={0.98}
      onPress={() => {
        // Light haptic feedback for card interaction
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
    >
      <Animated.View 
        style={[
          styles.positionCard,
          isHistory && styles.historyCard,
          { 
            transform: [{ scale: scaleAnim }],
            shadowOpacity: position.isWinner && !position.claimed ? 0.6 : 0.3,
            shadowColor: position.isWinner ? COLORS.success : COLORS.primary,
          }
        ]}
      >
        <LinearGradient
          colors={statusInfo.gradient}
          style={styles.cardGradient}
        >
          {/* Enhanced Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitle}>
              <View style={styles.raceIdContainer}>
                <MaterialCommunityIcons name="flag-checkered" size={16} color={COLORS.primary} />
                <Text style={styles.raceIdText}>Race #{position.raceId}</Text>
              </View>
              <View style={styles.assetContainer}>
                <View style={[styles.assetDot, { backgroundColor: COLORS.accent.purple }]} />
                <Text style={styles.assetText}>{position.assetSymbol}</Text>
                {position.performance !== undefined && (
                  <Text style={[
                    styles.performanceText,
                    { color: position.performance >= 0 ? COLORS.success : COLORS.error }
                  ]}>
                    {position.performance >= 0 ? '+' : ''}{position.performance.toFixed(2)}%
                  </Text>
                )}
              </View>
            </View>
            
            <Animated.View style={[
              styles.statusBadge,
              { 
                backgroundColor: statusInfo.color,
                opacity: position.isWinner && !position.claimed ? glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }) : 1,
              }
            ]}>
              <MaterialCommunityIcons name={statusInfo.icon} size={14} color="#000" />
              <Text style={styles.statusText}>{statusInfo.text}</Text>
            </Animated.View>
          </View>

          {/* Enhanced Content */}
          <View style={styles.cardContent}>
            <View style={styles.betDetails}>
              <View style={styles.betDetail}>
                <Text style={styles.betDetailLabel}>Amount Bet</Text>
                <Text style={styles.betDetailValue}>{formatValue(position.amount)}</Text>
              </View>
              
              {position.potentialPayout && (
                <View style={styles.betDetail}>
                  <Text style={styles.betDetailLabel}>
                    {position.isWinner ? 'Payout' : 'Potential'}
                  </Text>
                  <Text style={[
                    styles.betDetailValue,
                    { color: position.isWinner ? COLORS.success : COLORS.warning }
                  ]}>
                    {formatValue(position.potentialPayout)}
                  </Text>
                </View>
              )}
            </View>

            {/* Profit/Loss Display - Only show for truly settled races */}
            {position.raceState === 'Settled' && (
              <View style={[
                styles.profitLossContainer,
                isHistory && styles.historyProfitLoss,
                position.isWinner && isHistory && styles.winnerProfitLoss
              ]}>
                <Text style={styles.profitLossLabel}>Net Result</Text>
                <Text style={[
                  styles.profitLossValue,
                  { 
                    color: position.isWinner ? COLORS.success : COLORS.error 
                  }
                ]}>
                  {position.isWinner 
                    ? `+${formatValue((position.potentialPayout || 0) - position.amount)}`
                    : `-${formatValue(position.amount)}`
                  }
                </Text>
              </View>
            )}
          </View>

          {/* Enhanced Actions */}
          <View style={[styles.cardActions, isHistory && styles.historyCardActions]}>
            {position.isWinner && !position.claimed && position.raceState === 'Settled' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.claimButton, isHistory && styles.historyClaimButton]}
                onPress={handleClaim}
                activeOpacity={0.8}
                accessibilityLabel={`Claim reward for race ${position.raceId}`}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[COLORS.success, COLORS.warning]}
                  style={styles.claimButtonGradient}
                >
                  <MaterialCommunityIcons name="wallet-plus" size={16} color="#000" />
                  <Text style={styles.claimButtonText}>Claim Reward</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {!isHistory && !isUnclaimed && (
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  styles.viewButton,
                  position.isWinner && !position.claimed && styles.secondaryAction
                ]}
                onPress={handleViewRace}
                activeOpacity={0.8}
                accessibilityLabel={`View details for race ${position.raceId}`}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="eye" size={16} color={COLORS.primary} />
                <Text style={styles.viewButtonText}>View Race</Text>
              </TouchableOpacity>
            )}
            
            {isHistory && !position.isWinner && !position.claimed && (
              <View style={styles.historyBadge}>
                <MaterialCommunityIcons name="information" size={16} color={COLORS.text.tertiary} />
                <Text style={styles.historyBadgeText}>Race Completed</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  )
})

// Enhanced Portfolio Stats Component
const PortfolioStatsSection: React.FC<{
  stats: PortfolioStats
  formatValue: (value: number) => string
}> = React.memo(({ stats, formatValue }) => {
  const pulseAnim = useRef(new Animated.Value(0.8)).current

  // Pulse animation for active bets indicator
  useEffect(() => {
    if (stats.activeBets > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start()
    }
  }, [stats.activeBets, pulseAnim])

  const getPerformanceColor = (value: number) => {
    if (value > 0) return COLORS.success
    if (value < 0) return COLORS.error
    return COLORS.text.secondary
  }

  const getWinRateIcon = (winRate: number) => {
    if (winRate >= 75) return 'trophy-award'
    if (winRate >= 50) return 'trophy'
    if (winRate >= 25) return 'medal'
    return 'account'
  }

  return (
    <View style={styles.statsSection}>
      <LinearGradient
        colors={['rgba(153, 69, 255, 0.25)', 'rgba(20, 241, 149, 0.15)', 'rgba(0, 0, 0, 0.85)']}
        style={styles.statsCard}
      >
        {/* Enhanced Header with Performance Indicator */}
        <View style={styles.statsHeader}>
          <View style={styles.statsHeaderLeft}>
            <View style={styles.portfolioIconContainer}>
              <MaterialCommunityIcons name="chart-pie" size={20} color={COLORS.warning} />
            </View>
            <View>
              <Text style={styles.statsTitle}>Portfolio Overview</Text>
              <Text style={styles.statsSubtitle}>
                {stats.totalBets > 0 ? 'Racing Performance' : 'Ready to Race'}
              </Text>
            </View>
          </View>
          
          {stats.totalBets > 0 && (
            <View style={[
              styles.performanceIndicator,
              { backgroundColor: getPerformanceColor(stats.netProfit) + '20' }
            ]}>
              <MaterialCommunityIcons 
                name={stats.netProfit >= 0 ? 'trending-up' : 'trending-down'} 
                size={16} 
                color={getPerformanceColor(stats.netProfit)} 
              />
            </View>
          )}
        </View>
        
        {stats.totalBets === 0 ? (
          // Empty state for new users
          <View style={styles.emptyStatsContainer}>
            <MaterialCommunityIcons name="rocket-launch" size={48} color={COLORS.primary} />
            <Text style={styles.emptyStatsTitle}>Start Your Journey</Text>
            <Text style={styles.emptyStatsText}>
              Join your first race to begin building your portfolio statistics
            </Text>
          </View>
        ) : (
          <>
            {/* Enhanced Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statItem, styles.primaryStat]}>
                <View style={styles.statIcon}>
                  <MaterialCommunityIcons name="flag-checkered" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.statValue}>{stats.totalBets}</Text>
                <Text style={styles.statLabel}>Total Races</Text>
              </View>
              
              <View style={[styles.statItem, styles.primaryStat]}>
                <View style={styles.statIcon}>
                  <MaterialCommunityIcons name="wallet" size={16} color={COLORS.accent.orange} />
                </View>
                <Text style={styles.statValue}>{formatValue(stats.totalWagered)}</Text>
                <Text style={styles.statLabel}>Total Wagered</Text>
              </View>
              
              <View style={[styles.statItem, styles.primaryStat]}>
                <View style={styles.statIcon}>
                  <MaterialCommunityIcons 
                    name={getWinRateIcon(stats.winRate)} 
                    size={16} 
                    color={stats.winRate >= 50 ? COLORS.success : COLORS.error} 
                  />
                </View>
                <Text style={[
                  styles.statValue,
                  { color: stats.winRate >= 50 ? COLORS.success : COLORS.error }
                ]}>
                  {stats.winRate.toFixed(1)}%
                </Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
              
              <View style={[styles.statItem, styles.primaryStat]}>
                <View style={styles.statIcon}>
                  <MaterialCommunityIcons 
                    name={stats.netProfit >= 0 ? "chart-line" : "chart-line-variant"} 
                    size={16} 
                    color={getPerformanceColor(stats.netProfit)} 
                  />
                </View>
                <Text style={[
                  styles.statValue,
                  { color: getPerformanceColor(stats.netProfit) }
                ]}>
                  {stats.netProfit >= 0 ? '+' : ''}{formatValue(stats.netProfit)}
                </Text>
                <Text style={styles.statLabel}>Net Profit</Text>
              </View>
            </View>

            {/* Additional Stats Row */}
            <View style={styles.additionalStats}>
              <View style={styles.additionalStatItem}>
                <MaterialCommunityIcons name="trophy" size={14} color={COLORS.success} />
                <Text style={styles.additionalStatText}>
                  {Math.round((stats.winRate / 100) * stats.totalBets)} Wins
                </Text>
              </View>
              
              <View style={styles.additionalStatItem}>
                <MaterialCommunityIcons name="cash" size={14} color={COLORS.warning} />
                <Text style={styles.additionalStatText}>
                  {formatValue(stats.totalWon)} Won
                </Text>
              </View>
              
              <View style={styles.additionalStatItem}>
                <MaterialCommunityIcons name="wallet-plus" size={14} color={COLORS.secondary} />
                <Text style={styles.additionalStatText}>
                  {formatValue(stats.totalClaimed)} Claimed
                </Text>
              </View>
            </View>
          </>
        )}
        
        {/* Enhanced Active Indicator */}
        {stats.activeBets > 0 && (
          <Animated.View style={[
            styles.activeIndicator,
            { opacity: pulseAnim }
          ]}>
            <View style={styles.activeIndicatorContent}>
              <MaterialCommunityIcons name="pulse" size={16} color={COLORS.secondary} />
              <Text style={styles.activeText}>
                {stats.activeBets} active race{stats.activeBets > 1 ? 's' : ''} in progress
              </Text>
            </View>
            <View style={styles.activeDot} />
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  )
})

// Enhanced Tab Navigation
const TabNavigation: React.FC<{
  activeTab: 'active' | 'history' | 'unclaimed'
  onTabChange: (tab: 'active' | 'history' | 'unclaimed') => void
  activeBetsCount: number
  historyCount: number
  unclaimedCount: number
}> = React.memo(({ activeTab, onTabChange, activeBetsCount, historyCount, unclaimedCount }) => {
  const translateX = useRef(new Animated.Value(activeTab === 'active' ? 0 : activeTab === 'history' ? 1 : 2)).current

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: activeTab === 'active' ? 0 : activeTab === 'history' ? 1 : 2,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start()
  }, [activeTab, translateX])

  const TabButton: React.FC<{
    tab: 'active' | 'history' | 'unclaimed'
    label: string
    count: number
    icon: string
    isActive: boolean
  }> = ({ tab, label, count, icon, isActive }) => (
    <TouchableOpacity
      style={[styles.tab, isActive && styles.activeTab]}
      onPress={() => {
        onTabChange(tab)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      activeOpacity={0.8}
      accessibilityLabel={`${label} tab with ${count} items`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.tabContent}>
        <MaterialCommunityIcons 
          name={icon as any} 
          size={20} 
          color={isActive ? COLORS.text.primary : COLORS.text.secondary} 
        />
        <Text style={[styles.tabText, isActive && styles.activeTabText]}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.tabBadge, { backgroundColor: isActive ? COLORS.primary : COLORS.text.tertiary }]}>
            <Text style={styles.tabBadgeText}>{count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.tabContainer}>
      <Animated.View 
        style={[
          styles.tabIndicator,
          {
            transform: [{
              translateX: translateX.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [
                  4, // Active tab position
                  (screenWidth - 48) / 3 + 4, // History tab position  
                  ((screenWidth - 48) / 3) * 2 + 4 // Unclaimed tab position
                ]
              })
            }]
          }
        ]} 
      />
      
      <TabButton
        tab="active"
        label="Active"
        count={activeBetsCount}
        icon="play-circle"
        isActive={activeTab === 'active'}
      />
      
      <TabButton
        tab="history"
        label="History"
        count={historyCount}
        icon="history"
        isActive={activeTab === 'history'}
      />

      <TabButton
        tab="unclaimed"
        label="Unclaimed"
        count={unclaimedCount}
        icon="wallet-plus"
        isActive={activeTab === 'unclaimed'}
      />
    </View>
  )
})

// History Search Component
const HistorySearch: React.FC<{
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: 'date' | 'amount' | 'result'
  onSortChange: (sort: 'date' | 'amount' | 'result') => void
}> = React.memo(({ searchQuery, onSearchChange, sortBy, onSortChange }) => {
  const [showSort, setShowSort] = useState(false)

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search races..."
          placeholderTextColor={COLORS.text.tertiary}
          value={searchQuery}
          onChangeText={(text) => {
            onSearchChange(text)
            // Light haptic feedback when typing (only on first character)
            if (text.length === 1 && searchQuery.length === 0) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }
          }}
          onFocus={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              onSearchChange('')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }} 
            style={styles.clearSearch}
          >
            <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.sortButton}
        onPress={() => {
          setShowSort(!showSort)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
      >
        <MaterialCommunityIcons name="sort" size={20} color={COLORS.primary} />
      </TouchableOpacity>
      
      {showSort && (
        <View style={styles.sortDropdown}>
          {(['date', 'amount', 'result'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.sortOption, sortBy === option && styles.selectedSortOption]}
              onPress={() => {
                onSortChange(option)
                setShowSort(false)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Text style={[styles.sortOptionText, sortBy === option && styles.selectedSortOptionText]}>
                {option === 'date' ? 'Date' : option === 'amount' ? 'Amount' : 'Result'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
})

// History Group Component
const HistoryGroupComponent: React.FC<{
  group: HistoryGroup
  onClaim: (raceId: number) => void
  onViewRace: (raceId: number) => void
  formatValue: (value: number) => string
}> = React.memo(({ group, onClaim, onViewRace, formatValue }) => {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <View style={styles.historyGroup}>
      <TouchableOpacity 
        style={styles.historyGroupHeader}
        onPress={() => {
          setExpanded(!expanded)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
      >
        <View style={styles.historyGroupInfo}>
          <Text style={styles.historyGroupDate}>{group.date}</Text>
          <Text style={styles.historyGroupCount}>{group.positions.length} races</Text>
        </View>
        
        <View style={styles.historyGroupStats}>
          <Text style={[
            styles.historyGroupResult,
            { color: group.netResult >= 0 ? COLORS.success : COLORS.error }
          ]}>
            {group.netResult >= 0 ? '+' : ''}{formatValue(group.netResult)}
          </Text>
          <MaterialCommunityIcons 
            name={expanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={COLORS.text.secondary} 
          />
        </View>
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.historyGroupContent}>
          {group.positions.map((position, index) => (
            <PositionCard
              key={`${position.raceId}-${position.assetIdx}-${index}`}
              position={position}
              onClaim={onClaim}
              onViewRace={onViewRace}
              formatValue={formatValue}
              isHistory={true}
              isUnclaimed={false}
            />
          ))}
        </View>
      )}
    </View>
  )
})

// Enhanced Empty State
const EmptyState: React.FC<{
  activeTab: 'active' | 'history' | 'unclaimed'
  isConnected: boolean
}> = React.memo(({ activeTab, isConnected }) => (
  <View style={styles.emptyContainer}>
    <MaterialCommunityIcons 
      name={!isConnected ? 'wallet-outline' : activeTab === 'active' ? 'rocket-launch' : activeTab === 'history' ? 'history' : 'wallet-plus'} 
      size={64} 
      color={COLORS.text.tertiary}
    />
    <Text style={styles.emptyTitle}>
      {!isConnected 
        ? 'Connect Your Wallet' 
        : activeTab === 'active' 
          ? 'No Active Races' 
          : activeTab === 'history'
            ? 'No Race History'
            : 'No Unclaimed Rewards'
      }
    </Text>
    <Text style={styles.emptyText}>
      {!isConnected 
        ? 'Connect your wallet to view your racing positions and history'
        : activeTab === 'active' 
          ? 'Join a race to start your momentum trading journey!' 
          : activeTab === 'history'
            ? 'Your completed races will appear here'
            : 'Your unclaimed rewards will be displayed here'
      }
    </Text>
  </View>
))

// Main Account Feature Component
export function AccountFeature() {
  const { account, signAndSendTransaction } = useWalletUi()
  const connection = useConnection()
  
  // Race store for data and claim functionality
  const { 
    userBets, 
    fetchUserBets, 
    claimPayout, 
    isLoading, 
    error 
  } = useRaceStore()
  
  // Local state
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'unclaimed'>('active')
  const [refreshing, setRefreshing] = useState(false)
  const [localClaimedRaces, setLocalClaimedRaces] = useState<Set<number>>(new Set())
  
  // Search and filter state for history
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'result'>('date')
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const isInitialLoad = useRef(true)

  // Enhanced value formatter
  const formatValue = useCallback((value: number) => {
    const displayValue = value / 1_000_000 // Convert from micro-USDC
    
    if (displayValue >= 1000000) return `$${(displayValue / 1000000).toFixed(2)}M`
    if (displayValue >= 1000) return `$${(displayValue / 1000).toFixed(1)}K`
    return `$${displayValue.toFixed(2)}`
  }, [])

  // Group history by date
  const groupHistoryByDate = useCallback((positions: UserPosition[]): HistoryGroup[] => {
    const groups: { [key: string]: UserPosition[] } = {}
    
    positions.forEach(position => {
      const date = new Date(position.timestamp || Date.now()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(position)
    })
    
    return Object.entries(groups).map(([date, positions]) => {
      const totalWon = positions.filter(p => p.isWinner).reduce((sum, p) => sum + (p.potentialPayout || 0), 0)
      const totalLost = positions.filter(p => !p.isWinner).reduce((sum, p) => sum + p.amount, 0)
      
      return {
        date,
        positions,
        totalWon,
        totalLost,
        netResult: totalWon - totalLost
      }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  // Process user positions from backend data
  const userPositions = useMemo(() => {
    if (!userBets || userBets.length === 0) {
      return []
    }
    
    return userBets.map(bet => {
      // Handle legacy SettlementReady state by converting to Settled
      const normalizedRaceState = bet.raceState === 'SettlementReady' ? 'Settled' : bet.raceState
      
      return {
        raceId: bet.raceId,
        assetIdx: bet.assetIdx,
        assetSymbol: ['BTC', 'ETH', 'SOL'][bet.assetIdx] || 'Unknown',
        amount: bet.amount,
        claimed: bet.claimed || localClaimedRaces.has(bet.raceId),
        isWinner: bet.isWinner,
        potentialPayout: bet.potentialPayout,
        raceState: normalizedRaceState as any,
        timestamp: (bet as any).timestamp || Date.now(), // Safely handle timestamp
      }
    })
  }, [userBets, localClaimedRaces])

  // Filter positions based on active tab - CLEAR LOGIC
  const filteredPositions = useMemo(() => {
    if (activeTab === 'active') {
      return userPositions.filter(pos => 
        pos.raceState === 'Betting' || pos.raceState === 'Running'
      )
    }
    
    if (activeTab === 'history') {
      // Show ALL settled races in history - no restrictions
      const historyPositions = userPositions.filter(pos => 
        pos.raceState === 'Settled'
      )
      return historyPositions
    }
    
    if (activeTab === 'unclaimed') {
      // Only show settled winners that haven't been claimed
      const unclaimedPositions = userPositions.filter(pos => 
        !pos.claimed && 
        pos.isWinner === true && 
        pos.raceState === 'Settled'
      )
      return unclaimedPositions
    }
    
    return userPositions
  }, [userPositions, activeTab])

  // Filter and sort positions
  const processedPositions = useMemo(() => {
    let filtered = filteredPositions
    
    // Apply search filter for history
    if (activeTab === 'history' && searchQuery) {
      filtered = filtered.filter(pos => 
        pos.assetSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pos.raceId.toString().includes(searchQuery)
      )
    }
    
    // Apply sorting for history
    if (activeTab === 'history') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return (b.timestamp || 0) - (a.timestamp || 0)
          case 'amount':
            return b.amount - a.amount
          case 'result':
            if (a.isWinner === b.isWinner) return 0
            return a.isWinner ? -1 : 1
          default:
            return 0
        }
      })
    }
    
    return filtered
  }, [filteredPositions, activeTab, searchQuery, sortBy])

  // Group history positions for better display
  const historyGroups = useMemo(() => {
    if (activeTab === 'history') {
      return groupHistoryByDate(processedPositions)
    }
    return []
  }, [activeTab, processedPositions, groupHistoryByDate])

  // Portfolio statistics
  const portfolioStats = useMemo((): PortfolioStats => {
    if (!userPositions.length) {
      return {
        totalBets: 0,
        totalWagered: 0,
        totalWon: 0,
        totalClaimed: 0,
        winRate: 0,
        netProfit: 0,
        activeBets: 0,
        unclaimedRewards: 0,
        unclaimedValue: 0,
      }
    }

    const totalBets = userPositions.length
    const totalWagered = userPositions.reduce((sum, pos) => sum + pos.amount, 0)
    const wins = userPositions.filter(pos => pos.isWinner)
    const totalWon = wins.reduce((sum, pos) => sum + (pos.potentialPayout || 0), 0)
    const totalClaimed = wins.filter(pos => pos.claimed).reduce((sum, pos) => sum + (pos.potentialPayout || 0), 0)
    const winRate = totalBets > 0 ? (wins.length / totalBets) * 100 : 0
    const netProfit = totalWon - totalWagered
    const activeBets = userPositions.filter(pos => 
      pos.raceState === 'Betting' || pos.raceState === 'Running'
    ).length

    // Calculate unclaimed rewards - only from settled races
    const unclaimedPositions = userPositions.filter(pos => 
      !pos.claimed && 
      pos.isWinner === true && 
      pos.raceState === 'Settled'
    )
    const unclaimedValue = unclaimedPositions.reduce((sum, pos) => sum + (pos.potentialPayout || 0), 0)

    return {
      totalBets,
      totalWagered,
      totalWon,
      totalClaimed,
      winRate,
      netProfit,
      activeBets,
      unclaimedRewards: unclaimedPositions.length,
      unclaimedValue,
    }
  }, [userPositions])

  // Data fetching
  useEffect(() => {
    if (account?.publicKey) {
      fetchUserBets(account.publicKey.toString())
    }
  }, [account?.publicKey, fetchUserBets])

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  // Haptic feedback for tab changes
  useEffect(() => {
    // Skip haptic feedback on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [activeTab])

  // Handle claim payout
  const handleClaim = useCallback(async (raceId: number) => {
    if (!account?.publicKey || !connection || !signAndSendTransaction) return
    
    // Medium impact for initiating claim
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    try {
      const success = await claimPayout(
        account.publicKey.toString(),
        raceId,
        connection,
        signAndSendTransaction
      )
      
      if (success) {
        // Success notification for successful claim
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        
        // Add to local claimed set for immediate UI feedback
        setLocalClaimedRaces(prev => new Set(prev).add(raceId))
        
        // Refresh user bets after a delay with force refresh
        setTimeout(() => {
          fetchUserBets(account.publicKey.toString(), false) // useCache=false to force refresh
        }, 3000) // Increased delay to 3 seconds for blockchain processing
      } else {
        // Error notification for failed claim
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (error) {
      // Error notification for failed claim
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }, [account, connection, signAndSendTransaction, claimPayout, fetchUserBets])

  // Handle view race (navigate to demo)
  const handleViewRace = useCallback((raceId: number) => {
    // Light impact for navigation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Navigate to racing tab
    // This would typically use navigation
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!account?.publicKey) return
    
    // Medium impact for refresh action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    setRefreshing(true)
    try {
      await fetchUserBets(account.publicKey.toString(), false)
      // Light success feedback for successful refresh
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (error) {
      // Error notification for failed refresh
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
    setRefreshing(false)
    }
  }, [account, fetchUserBets])

  // Render position item
  const renderPosition = useCallback(({ item }: { item: UserPosition }) => (
    <PositionCard
      position={item}
      onClaim={handleClaim}
      onViewRace={handleViewRace}
      formatValue={formatValue}
      isHistory={activeTab === 'history'}
      isUnclaimed={activeTab === 'unclaimed'}
    />
  ), [handleClaim, handleViewRace, formatValue, activeTab])

  // Render history group
  const renderHistoryGroup = useCallback(({ item }: { item: HistoryGroup }) => (
    <HistoryGroupComponent
      group={item}
      onClaim={handleClaim}
      onViewRace={handleViewRace}
      formatValue={formatValue}
    />
  ), [handleClaim, handleViewRace, formatValue])

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Enhanced Dynamic Background */}
      <LinearGradient
        colors={['#000814', '#001D3D', '#003566']}
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
            accessibilityLabel="Refresh account data"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons 
              name={refreshing ? "loading" : "refresh"} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.secondary}
              colors={[COLORS.secondary]}
            />
          }
        >
          {!account ? (
            <EmptyState activeTab={activeTab} isConnected={false} />
          ) : (
            <>
              {/* Portfolio Stats */}
              <PortfolioStatsSection 
                stats={portfolioStats} 
                formatValue={formatValue} 
              />

              {/* Tab Navigation */}
              <TabNavigation 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                activeBetsCount={portfolioStats.activeBets}
                historyCount={userPositions.filter(pos => pos.raceState === 'Settled').length}
                unclaimedCount={portfolioStats.unclaimedRewards}
              />

              {/* Search and Sort for History Tab */}
              {activeTab === 'history' && (
                <HistorySearch
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                />
              )}

              {/* Unclaimed Rewards Summary */}
              {activeTab === 'unclaimed' && portfolioStats.unclaimedValue > 0 && (
                <View style={styles.unclaimedSummary}>
                  <LinearGradient
                    colors={['rgba(0, 255, 136, 0.2)', 'rgba(255, 215, 0, 0.15)', 'rgba(0, 0, 0, 0.8)']}
                    style={styles.unclaimedSummaryGradient}
                  >
                    <View style={styles.unclaimedSummaryHeader}>
                      <MaterialCommunityIcons name="treasure-chest" size={24} color={COLORS.warning} />
                      <Text style={styles.unclaimedSummaryTitle}>Total Unclaimed Rewards</Text>
                    </View>
                    <Text style={styles.unclaimedSummaryValue}>
                      {formatValue(portfolioStats.unclaimedValue)}
                    </Text>
                    <Text style={styles.unclaimedSummarySubtext}>
                      From {portfolioStats.unclaimedRewards} winning race{portfolioStats.unclaimedRewards > 1 ? 's' : ''}
                    </Text>
                  </LinearGradient>
                </View>
              )}

              {/* Positions List */}
              <View style={styles.positionsContainer}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.secondary} />
                    <Text style={styles.loadingText}>Loading positions...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle" size={48} color={COLORS.error} />
                    <Text style={styles.errorTitle}>Error Loading Data</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity 
                      style={styles.retryButton} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        handleRefresh()
                      }}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : activeTab === 'history' && historyGroups.length > 0 ? (
                  <FlatList
                    data={historyGroups}
                    keyExtractor={(item) => item.date}
                    renderItem={renderHistoryGroup}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={5}
                    windowSize={3}
                  />
                ) : processedPositions.length === 0 ? (
                  <EmptyState activeTab={activeTab} isConnected={true} />
                ) : (
                  <FlatList
                    data={processedPositions}
                    keyExtractor={(item, index) => `${item.raceId}-${item.assetIdx}-${index}`}
                    renderItem={renderPosition}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(153, 69, 255, 0.3)',
  },
  headerTitle: {
    ...TYPOGRAPHY.title,
    fontWeight: '800',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-ExtraBold',
  },
  refreshButton: {
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  
  // Portfolio Stats
  statsSection: {
    marginHorizontal: SPACING.xl,
    marginVertical: SPACING.lg,
  },
  statsCard: {
    borderRadius: 20,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  portfolioIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  statsTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-Bold',
    marginBottom: 2,
  },
  statsSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontFamily: 'Orbitron-Regular',
  },
  performanceIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emptyStatsContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyStatsTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    fontFamily: 'Orbitron-Bold',
  },
  emptyStatsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Orbitron-Regular',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  primaryStat: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '800',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-ExtraBold',
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontFamily: 'Orbitron-Regular',
    textAlign: 'center',
  },
  additionalStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
    justifyContent: 'center',
  },
  additionalStatText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontFamily: 'Orbitron-Regular',
    fontSize: isTablet ? 12 : 10,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(20, 241, 149, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  activeIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  activeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    fontFamily: 'Orbitron-SemiBold',
    fontWeight: '600',
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  
  // Tab Navigation
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginVertical: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24,
    padding: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabIndicator: {
    position: 'absolute',
    width: '32%', // Adjusted for 3 tabs: 100% / 3 = 33.33%, slightly less for padding
    height: '90%',
    backgroundColor: 'rgba(153, 69, 255, 0.3)',
    borderRadius: 20,
    top: 4,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.5)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tabText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    fontWeight: '600',
    fontFamily: 'Orbitron-SemiBold',
    fontSize: isTablet ? 14 : 12, // Slightly smaller for 3 tabs
  },
  activeTabText: {
    color: COLORS.text.primary,
    fontWeight: '700',
  },
  tabBadge: {
    minWidth: 18, // Slightly smaller for 3 tabs
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    ...TYPOGRAPHY.small,
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
    fontSize: isTablet ? 10 : 8, // Smaller for 3 tabs
  },

  // Search functionality
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    flex: 1,
  },
  clearSearch: {
    padding: SPACING.xs,
  },
  sortButton: {
    padding: SPACING.sm,
  },
  sortDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 1,
  },
  sortOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
  },
  selectedSortOption: {
    backgroundColor: 'rgba(153, 69, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.5)',
  },
  sortOptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    fontWeight: '600',
    fontFamily: 'Orbitron-SemiBold',
  },
  selectedSortOptionText: {
    color: COLORS.text.primary,
    fontWeight: '700',
  },

  // History groups
  historyGroup: {
    marginBottom: SPACING.lg,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  historyGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  historyGroupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  historyGroupDate: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  historyGroupCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontFamily: 'Orbitron-Regular',
  },
  historyGroupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  historyGroupResult: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  historyGroupContent: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },

  // Unclaimed summary
  unclaimedSummary: {
    marginHorizontal: SPACING.xl,
    marginVertical: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  unclaimedSummaryGradient: {
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  unclaimedSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  unclaimedSummaryTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-Bold',
  },
  unclaimedSummaryValue: {
    ...TYPOGRAPHY.title,
    fontWeight: '800',
    color: COLORS.warning,
    fontFamily: 'Orbitron-ExtraBold',
  },
  unclaimedSummarySubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontFamily: 'Orbitron-Regular',
  },
  
  // Positions
  positionsContainer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },
  positionCard: {
    marginBottom: SPACING.lg,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  historyCard: {
    opacity: 0.9,
    shadowOpacity: 0.2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardGradient: {
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    flex: 1,
  },
  raceIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  raceIdText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
    fontFamily: 'Orbitron-Bold',
  },
  assetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  assetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  assetText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'Orbitron-SemiBold',
  },
  performanceText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    gap: SPACING.xs,
  },
  statusText: {
    ...TYPOGRAPHY.small,
    color: '#000',
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
  },
  cardContent: {
    marginBottom: SPACING.md,
  },
  betDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  betDetail: {
    alignItems: 'center',
  },
  betDetailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontFamily: 'Orbitron-Regular',
    marginBottom: SPACING.xs,
  },
  betDetailValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-Bold',
  },
  profitLossContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profitLossLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontFamily: 'Orbitron-Regular',
    marginBottom: SPACING.xs,
  },
  profitLossValue: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
  },
  historyProfitLoss: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  winnerProfitLoss: {
    borderColor: 'rgba(0,255,136,0.3)',
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    minHeight: MIN_TOUCH_TARGET,
    gap: SPACING.sm,
  },
  claimButton: {
    overflow: 'hidden',
  },
  claimButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  claimButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Orbitron-Bold',
  },
  viewButton: {
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.4)',
  },
  viewButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'Orbitron-SemiBold',
  },
  secondaryAction: {
    opacity: 0.8,
  },
  
  // History card specific styles
  historyCardActions: {
    justifyContent: 'center',
  },
  historyClaimButton: {
    width: '100%',
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: SPACING.sm,
  },
  historyBadgeText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.tertiary,
    fontWeight: '500',
    fontFamily: 'Orbitron-Regular',
  },
  
  // States
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.title,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Orbitron-Regular',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
    fontFamily: 'Orbitron-SemiBold',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: SPACING.xl,
  },
  errorTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    fontFamily: 'Orbitron-Bold',
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontFamily: 'Orbitron-Regular',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    minHeight: MIN_TOUCH_TARGET,
  },
  retryButtonText: {
    ...TYPOGRAPHY.body,
    color: '#000',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
}) 