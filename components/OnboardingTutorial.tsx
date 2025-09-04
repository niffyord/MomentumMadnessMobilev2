import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  highlight?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Momentum Madness!',
    description:
      'Race to predict which crypto asset will have the best performance in a short time window.',
    icon: 'rocket-launch',
    color: '#9945FF',
  },
  {
    id: 'phases',
    title: 'How Racing Works',
    description: '', // We'll handle this with custom rendering
    icon: 'timer',
    color: '#00FF88',
  },
  {
    id: 'betting',
    title: 'Place Your Bets',
    description:
      'Select an asset you think will perform best. Higher bets = bigger potential rewards! You need USDC to participate.',
    icon: 'cash',
    color: '#FFD700',
    highlight: 'Connect wallet first to see your balance',
  },
  {
    id: 'winning',
    title: 'Win Real USDC',
    description:
      'If your chosen asset has the highest percentage gain, you win a share of the prize pool proportional to your bet size.',
    icon: 'trophy',
    color: '#FF6B6B',
  },
  {
    id: 'ready',
    title: 'Ready to Race?',
    description:
      'Races happen automatically every minute. Connect your wallet and start with a small bet to get familiar!',
    icon: 'flag-checkered',
    color: '#14F195',
  },
];

// Custom component for race phases
const RacePhases = () => (
  <View style={styles.racePhasesContainer}>
    <Text style={styles.racePhasesIntro}>Each race has 3 phases:</Text>
    
    <View style={styles.phaseItem}>
      <LinearGradient
        colors={['#9945FF', '#7C3AED']}
        style={styles.phaseNumber}>
        <Text style={styles.phaseNumberText}>1</Text>
      </LinearGradient>
      <View style={styles.phaseContent}>
        <View style={styles.phaseHeader}>
          <MaterialCommunityIcons name="clock-fast" size={16} color="#9945FF" />
          <Text style={styles.phaseTitle}>COMMIT</Text>
        </View>
        <Text style={styles.phaseDescription}>Place your bets</Text>
        <Text style={styles.phaseTime}>(30 seconds)</Text>
      </View>
    </View>

    <View style={styles.phaseItem}>
      <LinearGradient
        colors={['#00FF88', '#10B981']}
        style={styles.phaseNumber}>
        <Text style={styles.phaseNumberText}>2</Text>
      </LinearGradient>
      <View style={styles.phaseContent}>
        <View style={styles.phaseHeader}>
          <MaterialCommunityIcons name="chart-line" size={16} color="#00FF88" />
          <Text style={styles.phaseTitle}>PERFORMANCE</Text>
        </View>
        <Text style={styles.phaseDescription}>Assets compete</Text>
        <Text style={styles.phaseTime}>(30 seconds)</Text>
      </View>
    </View>

    <View style={styles.phaseItem}>
      <LinearGradient
        colors={['#FFD700', '#F59E0B']}
        style={styles.phaseNumber}>
        <Text style={styles.phaseNumberText}>3</Text>
      </LinearGradient>
      <View style={styles.phaseContent}>
        <View style={styles.phaseHeader}>
          <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
          <Text style={styles.phaseTitle}>SETTLED</Text>
        </View>
        <Text style={styles.phaseDescription}>Winners claim rewards</Text>
        <Text style={styles.phaseTime}>(Instant)</Text>
      </View>
    </View>
  </View>
);

interface OnboardingTutorialProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  visible,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / ONBOARDING_STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      onComplete();
    } catch (error) {
      console.error('Failed to save onboarding completion:', error);
      onComplete(); // Continue anyway
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem('onboarding_skipped', 'true');
      onSkip();
    } catch (error) {
      console.error('Failed to save onboarding skip:', error);
      onSkip(); // Continue anyway
    }
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(0,8,20,0.95)', 'rgba(0,29,61,0.95)', 'rgba(0,53,102,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        
        <Animated.View 
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{translateY: slideAnim}],
            },
          ]}>
          
          {/* Enhanced gradient border effect */}
          <LinearGradient
            colors={['#9945FF', '#14F195', '#FFD700', '#9945FF']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.containerBorder}>
            
            <View style={styles.containerInner}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.stepCounter}>
                    {currentStep + 1} of {ONBOARDING_STEPS.length}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkip}
                  accessibilityLabel="Skip tutorial"
                  accessibilityRole="button">
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <View style={styles.contentContainer}>
                  {/* Enhanced icon container with gradient */}
                  <LinearGradient
                    colors={[currentStepData.color + '40', currentStepData.color + '10']}
                    style={styles.iconContainer}>
                    <View style={[styles.iconInner, {borderColor: currentStepData.color + '60'}]}>
                      <MaterialCommunityIcons
                        name={currentStepData.icon as any}
                        size={48}
                        color={currentStepData.color}
                      />
                    </View>
                  </LinearGradient>

                  <Text style={styles.title}>{currentStepData.title}</Text>

                  {currentStepData.id === 'phases' ? (
                    <RacePhases />
                  ) : (
                    <Text style={styles.description}>
                      {currentStepData.description}
                    </Text>
                  )}

                  {currentStepData.highlight && (
                    <LinearGradient
                      colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)']}
                      style={styles.highlightContainer}>
                      <MaterialCommunityIcons
                        name="lightbulb"
                        size={18}
                        color="#FFD700"
                      />
                      <Text style={styles.highlightText}>
                        {currentStepData.highlight}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
              </View>

              {/* Enhanced Navigation */}
              <View style={styles.navigation}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    styles.backButton,
                    currentStep === 0 && styles.disabledButton,
                  ]}
                  onPress={handlePrevious}
                  disabled={currentStep === 0}
                  accessibilityLabel="Previous step"
                  accessibilityRole="button">
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={20}
                    color={currentStep === 0 ? '#666' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.navButtonText,
                      currentStep === 0 && styles.disabledText,
                    ]}>
                    Back
                  </Text>
                </TouchableOpacity>

                <LinearGradient
                  colors={['#9945FF', '#14F195']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.nextButtonGradient}>
                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleNext}
                    accessibilityLabel={
                      currentStep === ONBOARDING_STEPS.length - 1
                        ? 'Finish tutorial'
                        : 'Next step'
                    }
                    accessibilityRole="button">
                    <Text style={styles.navButtonText}>
                      {currentStep === ONBOARDING_STEPS.length - 1
                        ? 'Get Started'
                        : 'Next'}
                    </Text>
                    <MaterialCommunityIcons
                      name={
                        currentStep === ONBOARDING_STEPS.length - 1
                          ? 'check'
                          : 'chevron-right'
                      }
                      size={20}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    minHeight: 450,
    maxHeight: screenHeight * 0.85,
  },
  containerBorder: {
    borderRadius: 24,
    padding: 2,
  },
  containerInner: {
    backgroundColor: 'rgba(16, 16, 32, 0.95)',
    borderRadius: 22,
    padding: 24,
    minHeight: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9945FF',
    borderRadius: 3,
  },
  stepCounter: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  content: {
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 28,
    letterSpacing: 0.5,
    fontFamily: 'Sora-Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    letterSpacing: 0.3,
    fontWeight: '400',
    fontFamily: 'Inter-Regular',
    paddingHorizontal: 8,
  },
  highlightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginTop: 16,
    maxWidth: '90%',
  },
  highlightText: {
    fontSize: 13,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontFamily: 'Inter-SemiBold',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 90,
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  nextButtonGradient: {
    borderRadius: 16,
    flex: 1,
    maxWidth: 140,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  navButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginHorizontal: 6,
    letterSpacing: 0.5,
  },
  disabledText: {
    color: '#666',
  },
  // New styles for RacePhases component
  racePhasesContainer: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  racePhasesIntro: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter-Medium',
  },
  phaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    maxWidth: 350,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  phaseNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phaseNumberText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Sora-Bold',
  },
  phaseContent: {
    flex: 1,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
  },
  phaseDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  phaseTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter-Medium',
  },
});

// Hook to check if onboarding should be shown
export const useOnboarding = () => {
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem('onboarding_completed');
      const skipped = await AsyncStorage.getItem('onboarding_skipped');

      // Show onboarding if neither completed nor skipped
      setShouldShowOnboarding(!completed && !skipped);
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      setShouldShowOnboarding(true); // Show by default if can't check
    } finally {
      setIsLoading(false);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('onboarding_completed');
      await AsyncStorage.removeItem('onboarding_skipped');
      setShouldShowOnboarding(true);
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  };

  return {
    shouldShowOnboarding,
    isLoading,
    resetOnboarding,
    hideOnboarding: () => setShouldShowOnboarding(false),
  };
}; 
