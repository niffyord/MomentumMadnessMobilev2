import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import AnimatedSpaceBackground from '@/components/AnimatedSpaceBackground'
import { useAuth } from '@/components/auth/auth-provider'
import NeonText from '@/components/NeonText'
import {
  OnboardingTutorial,
  useOnboarding,
} from '@/components/OnboardingTutorial'
import RocketHero from '@/components/RocketHero'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');


interface ConnectionError {
  type: 'network' | 'wallet' | 'permission' | 'timeout' | 'unknown';
  message: string;
  retry?: boolean;
}


type LoadingState = 'idle' | 'connecting' | 'authorizing' | 'finalizing';

export default function SignIn() {
  const {signIn, isLoading} = useAuth();

  
  const {
    shouldShowOnboarding,
    isLoading: onboardingLoading,
    hideOnboarding,
  } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [connectionError, setConnectionError] = useState<ConnectionError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speedLinesAnim = useRef(new Animated.Value(0)).current;
  const mysteryPulseAnim = useRef(new Animated.Value(1)).current;

  
  useEffect(() => {
    const checkScreenReader = async () => {
      const enabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(enabled);
    };
    checkScreenReader();
  }, []);

  
  useEffect(() => {
    const createEntranceSequence = () => {
      if (reducedMotion) {
        
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        return;
      }

      
      Animated.sequence([
        
        Animated.timing(heroAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        
        Animated.timing(speedLinesAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();

      
      Animated.stagger(150, [
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(ctaAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(featuresAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }).start();
    };

    createEntranceSequence();
  }, [reducedMotion]);

  
  useEffect(() => {
    if (!reducedMotion) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [reducedMotion]);

  
  useEffect(() => {
    if (!reducedMotion) {
      
      const timer = setTimeout(() => {
        const mysteryPulseLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(mysteryPulseAnim, {
              toValue: 1.08,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(mysteryPulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        );
        mysteryPulseLoop.start();
        return () => mysteryPulseLoop.stop();
      }, 3000); 
      
      return () => clearTimeout(timer);
    }
  }, [reducedMotion]);

  
  useEffect(() => {
    if (!onboardingLoading && shouldShowOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
        if (!reducedMotion) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowOnboarding, onboardingLoading, reducedMotion]);

  
  const handleConnectWallet = async () => {
    try {
      setLoadingState('connecting');
      setConnectionError(null);
      
      if (!reducedMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoadingState('authorizing');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      setLoadingState('finalizing');
      
      await signIn();
      
      if (!reducedMotion) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      router.replace('/');
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      if (!reducedMotion) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      
      let errorDetails: ConnectionError;
      
      if (error.message?.includes('Wallet authentication required') || 
          error.message?.includes('authorization request declined')) {
        errorDetails = {
          type: 'permission',
          message: 'Mock MWA Wallet needs authentication. Open the wallet app and press "Authenticate" button, then complete biometric verification.',
          retry: true
        };
      } else if (error.message?.includes('timeout')) {
        errorDetails = {
          type: 'timeout',
          message: 'Connection timed out. Ensure Mock MWA Wallet is running and authenticated.',
          retry: true
        };
      } else if (error.message?.includes('network')) {
        errorDetails = {
          type: 'network',
          message: 'Network error. Please check your connection.',
          retry: true
        };
      } else if (error.message?.includes('wallet') || error.message?.includes('Mobile Wallet Adapter')) {
        errorDetails = {
          type: 'wallet',
          message: 'Mock MWA Wallet connection failed. Ensure the wallet app is installed and authenticated.',
          retry: true
        };
      } else {
        errorDetails = {
          type: 'unknown',
          message: error.message || 'Something went wrong. Please try again.',
          retry: true
        };
      }
      
      setConnectionError(errorDetails);
      setRetryCount(prev => prev + 1);
    } finally {
      setLoadingState('idle');
    }
  };

  
  const handleRetry = () => {
    if (!reducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleConnectWallet();
  };

  
  const getLoadingMessage = () => {
    switch (loadingState) {
      case 'connecting': return 'Starting engines...';
      case 'authorizing': return 'Preparing for launch...';
      case 'finalizing': return 'Ready to race!';
      default: return 'Launch Into Racing';
    }
  };

  return (
    <AnimatedSpaceBackground>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <Animated.View 
        style={[
          styles.speedLinesContainer,
          {
            opacity: speedLinesAnim,
            transform: [{
              translateX: speedLinesAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-screenWidth, screenWidth * 2],
              })
            }]
          }
        ]}
      >
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.speedLine, {top: 100 + i * 120}]} />
        ))}
      </Animated.View>

      <SafeAreaView style={styles.safeArea}>
        <Animated.ScrollView
          style={[styles.scrollView]}
          contentContainerStyle={[
            styles.container,
            {
              opacity: fadeAnim,
            },
          ]}
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Momentum Madness sign in screen"
        >
          <Animated.View 
            style={[
              styles.heroSection,
              {
                opacity: heroAnim,
                transform: [
                  {
                    scale: heroAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    })
                  },
                  {
                    translateY: slideAnim
                  }
                ],
              }
            ]}
          >
            <RocketHero />
            
            <Animated.View 
              style={[
                styles.environmentBadge,
                {
                  transform: [{scale: pulseAnim}]
                }
              ]}
            >
              <MaterialCommunityIcons name="speedometer" size={16} color="#000" />
              <Text style={styles.environmentText}>DEVNET RACING</Text>
              <MaterialCommunityIcons name="flash" size={16} color="#000" />
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.titleSection,
              {
                opacity: titleAnim,
                transform: [
                  {
                    translateY: titleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.titleContainer}>
              <LinearGradient
                colors={['#FFD700', '#FF6B00', '#9945FF']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.titleGradientBorder}
              >
                <View style={styles.titleInner}>
                  <Text style={styles.titlePre}>PREDICT THE</Text>
                  <NeonText
                    style={styles.titleMain}
                    color="#FFD700"
                    glowColor="#FF6B00"
                  >
                    FASTEST
                  </NeonText>
                  <Text style={styles.titlePost}>MOMENTUM</Text>
                  
                  <View style={styles.racingStripe}>
                    <View style={styles.stripeSegment} />
                    <View style={styles.stripeSegment} />
                    <View style={styles.stripeSegment} />
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.valueProposition}>
              <View style={styles.rewardHighlight}>
                <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
                <Text style={styles.rewardText}>WIN REAL USDC</Text>
                <MaterialCommunityIcons name="trending-up" size={24} color="#14F195" />
              </View>
            </View>
          </Animated.View>

          <Animated.View 
            style={[
              styles.ctaSection,
              {
                opacity: ctaAnim,
                transform: [
                  {
                    translateY: ctaAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                  {
                    scale: loadingState !== 'idle' ? 0.98 : 1,
                  }
                ],
              }
            ]}
          >
            {connectionError && (
              <Animated.View 
                style={styles.errorCard}
                accessibilityRole="alert"
              >
                <MaterialCommunityIcons
                  name={connectionError.type === 'network' ? 'wifi-off' :
                        connectionError.type === 'wallet' ? 'wallet-outline' :
                        connectionError.type === 'permission' ? 'shield-alert' :
                        connectionError.type === 'timeout' ? 'clock-alert' : 'alert-circle'}
                  size={24}
                  color="#FF4444"
                />
                <View style={styles.errorContent}>
                  <Text style={styles.errorTitle}>Race Delayed</Text>
                  <Text style={styles.errorText}>{connectionError.message}</Text>
                  {connectionError.retry && (
                    <TouchableOpacity 
                      style={styles.retryButton}
                      onPress={handleRetry}
                      accessibilityRole="button"
                    >
                      <MaterialCommunityIcons name="restart" size={16} color="#14F195" />
                      <Text style={styles.retryText}>Restart Engine</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            )}

            {loadingState !== 'idle' && (
              <View style={styles.raceProgressContainer}>
                <View style={styles.raceTrack}>
                  <Animated.View 
                    style={[
                      styles.raceProgress,
                      {
                        width: loadingState === 'connecting' ? '33%' :
                               loadingState === 'authorizing' ? '66%' : '100%'
                      }
                    ]} 
                  />
                  <MaterialCommunityIcons 
                    name="rocket" 
                    size={20} 
                    color="#FFD700" 
                    style={styles.raceRocket}
                  />
                </View>
                <Text style={styles.raceProgressText}>
                  {getLoadingMessage()}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.raceButton,
                loadingState !== 'idle' && styles.raceButtonLoading
              ]}
              onPress={handleConnectWallet}
              disabled={loadingState !== 'idle'}
              accessibilityRole="button"
              accessibilityLabel={getLoadingMessage()}
            >
              <LinearGradient
                colors={loadingState !== 'idle' 
                  ? ['#666', '#888', '#666']
                  : ['#FFD700', '#FF6B00', '#9945FF', '#14F195']
                }
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.raceButtonGradient}
              >
                <View style={styles.raceButtonContent}>
                  {loadingState !== 'idle' ? (
                    <ActivityIndicator size="small" color="#FFD700" />
                  ) : (
                    <MaterialCommunityIcons name="rocket-launch" size={24} color="#000" />
                  )}
                  <Text style={styles.raceButtonText}>
                    {getLoadingMessage()}
                  </Text>
                  {loadingState === 'idle' && (
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#000" />
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View 
            style={[
              styles.featuresSection,
              {
                opacity: featuresAnim,
                transform: [
                  {
                    translateY: featuresAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }
            ]}
          >
            <TouchableOpacity
              style={[
                styles.mysteryButton,
                {
                  transform: [{ scale: mysteryPulseAnim }]
                }
              ]}
              onPress={() => {
                setShowOnboarding(true);
                if (!reducedMotion) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#9945FF', '#14F195', '#FFD700', '#FF6B00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mysteryButtonGradient}
              >
                <View style={styles.mysteryButtonContent}>
                  <View style={styles.mysteryIconContainer}>
                    <MaterialCommunityIcons name="eye-outline" size={24} color="#000" />
                  </View>
                  <Text style={styles.mysteryText}>What's the secret?</Text>
                  <View style={styles.mysteryArrow}>
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#000" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>

      <OnboardingTutorial
        visible={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          hideOnboarding();
          if (!reducedMotion) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }}
        onSkip={() => {
          setShowOnboarding(false);
          hideOnboarding();
        }}
      />
    </AnimatedSpaceBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 20,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    minHeight: screenHeight,
  },

  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  racingLoadingIndicator: {
    alignItems: 'center',
    gap: 12,
  },
  racingLoadingText: {
    fontSize: 18,
    color: '#FFD700',
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  racingLoadingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
    textAlign: 'center',
  },

  
  speedLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  speedLine: {
    position: 'absolute',
    width: screenWidth * 0.6,
    height: 3,
    backgroundColor: '#FFD700',
    opacity: 0.3,
    borderRadius: 2,
  },

  
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
    position: 'relative',
  },
  environmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginTop: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  environmentText: {
    fontFamily: 'Orbitron-ExtraBold',
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1.2,
  },

  
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  titleContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  titleGradientBorder: {
    borderRadius: 24,
    padding: 3,
  },
  titleInner: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 21,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    position: 'relative',
  },
  titlePre: {
    fontFamily: 'Orbitron-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleMain: {
    fontFamily: 'Orbitron-ExtraBold',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 8,
  },
  titlePost: {
    fontFamily: 'Orbitron-Bold',
    fontSize: 24,
    color: '#9945FF',
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  racingStripe: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 4,
  },
  stripeSegment: {
    width: 30,
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  valueProposition: {
    alignItems: 'center',
    gap: 12,
  },
  rewardHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    gap: 12,
  },
  rewardText: {
    fontFamily: 'Orbitron-Bold',
    fontSize: 18,
    color: '#FFD700',
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  
  ctaSection: {
    width: '100%',
    maxWidth: 380,
    marginBottom: 32,
    gap: 20,
  },
  raceProgressContainer: {
    alignItems: 'center',
    gap: 12,
  },
  raceTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  raceProgress: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  raceRocket: {
    position: 'absolute',
    top: -7,
    right: -10,
  },
  raceProgressText: {
    fontSize: 16,
    color: '#FFD700',
    fontFamily: 'Orbitron-SemiBold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  raceButton: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  raceButtonLoading: {
    shadowOpacity: 0.2,
  },
  raceButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  raceButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  raceButtonText: {
    fontFamily: 'Orbitron-ExtraBold',
    fontSize: 18,
    color: '#000',
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    gap: 16,
    width: '100%',
    marginBottom: 20, 
  },
  errorContent: {
    flex: 1,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#FF9999',
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'Orbitron-Regular',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(20, 241, 149, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.3)',
    gap: 8,
    marginTop: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#14F195',
    fontWeight: '600',
    fontFamily: 'Orbitron-SemiBold',
    letterSpacing: 0.5,
  },

  
  featuresSection: {
    width: '100%',
    maxWidth: 420,
    gap: 24,
  },
  mysteryButton: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 20,
  },
  mysteryButtonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 28,
  },
  mysteryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  mysteryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryText: {
    fontFamily: 'Orbitron-ExtraBold',
    fontSize: 18,
    color: '#000',
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    flex: 1,
  },
  mysteryArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
