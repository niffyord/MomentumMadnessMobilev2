import Snackbar from 'react-native-snackbar'

import { useConnection } from '@/components/solana/solana-provider'
import { useMobileWallet } from '@/components/solana/use-mobile-wallet'
import { PublicKey } from '@solana/web3.js'
import { useMutation } from '@tanstack/react-query'

import { OnChainService } from '../../services/onchainService'
import { useRaceStore } from '../../store/useRaceStore'

interface PlaceBetInput {
  raceId: number
  assetIdx: number
  amount: number // Amount in USDC (will be converted to micro-USDC)
  playerAddress: PublicKey
}

// Helper function to check if a bet exists on-chain
async function checkBetExists(
  connection: any,
  programId: PublicKey,
  raceId: number,
  playerAddress: PublicKey
): Promise<boolean> {
  try {
    const raceIdBuffer = Buffer.alloc(8)
    raceIdBuffer.writeBigUInt64LE(BigInt(raceId), 0)
    
    const [racePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('race'), raceIdBuffer],
      programId
    )

    const [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bet'), racePda.toBuffer(), playerAddress.toBuffer()],
      programId
    )

    const betAccount = await connection.getAccountInfo(betPda)
    return betAccount !== null
  } catch (error) {
    console.warn('Error checking bet existence:', error)
    return false
  }
}

export function usePlaceBet() {
  const connection = useConnection()
  const { signAndSendTransaction } = useMobileWallet()
  const { fetchCommitPhaseData, fetchUserBets } = useRaceStore()

  return useMutation({
    mutationFn: async (input: PlaceBetInput) => {
      const { raceId, assetIdx, amount, playerAddress } = input

      console.log(`🎯 Placing bet: $${amount} USDC on asset ${assetIdx} for race ${raceId}`)

      let signature: string | null = null

      try {
        // Convert USDC to micro-USDC for the smart contract
        const microAmount = Math.floor(amount * 1_000_000)

        // Create the transaction using OnChainService
        const onChainService = new OnChainService(connection)
        const { transaction, latestBlockhash, minContextSlot } = await onChainService.createPlaceBetTransaction({
          playerPublicKey: playerAddress,
          raceId,
          assetIdx,
          amount: microAmount,
        })

        console.log(`📝 Transaction created, requesting signature...`)

        // Sign and send transaction using mobile wallet adapter
        signature = await signAndSendTransaction(transaction, minContextSlot)

        console.log(`🔐 Transaction signed and sent: ${signature}`)

        // Enhanced confirmation with better timeout and error handling
        let confirmationAttempts = 0
        const maxAttempts = 3
        let lastError: any = null

        while (confirmationAttempts < maxAttempts) {
          try {
            console.log(`🔄 Confirmation attempt ${confirmationAttempts + 1}/${maxAttempts}`)

            // Use a shorter timeout for each attempt
            const confirmationPromise = connection.confirmTransaction(
              {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
              'confirmed'
            )

            // Add a timeout wrapper
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Confirmation timeout')), 30000) // 30 second timeout
            })

            const confirmationResult = await Promise.race([confirmationPromise, timeoutPromise]) as any

            if (confirmationResult.value?.err) {
              const errorMsg = JSON.stringify(confirmationResult.value.err)
              console.error(`❌ Transaction failed on-chain: ${errorMsg}`)
              throw new Error(`Transaction failed: ${errorMsg}`)
            }

            console.log(`✅ Transaction confirmed successfully!`)
            break // Success, exit loop

          } catch (confirmError: any) {
            confirmationAttempts++
            lastError = confirmError
            console.warn(`⚠️ Confirmation attempt ${confirmationAttempts} failed:`, confirmError.message)

            if (confirmationAttempts < maxAttempts) {
              // For timeout errors, check if the bet actually exists on-chain
              if (confirmError.message?.includes('timeout') || confirmError.message?.includes('Confirmation timeout')) {
                console.log(`🔍 Checking if bet exists on-chain despite timeout...`)
                
                // Wait a bit for the transaction to settle
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                const programId = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4')
                
                const betExists = await checkBetExists(connection, programId, raceId, playerAddress)
                
                if (betExists) {
                  console.log(`✅ Bet found on-chain! Transaction was successful despite confirmation timeout.`)
                  break // Bet exists, consider it successful
                }
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }

        // If we exhausted all attempts, check one final time if the bet exists
        if (confirmationAttempts >= maxAttempts) {
          console.log(`🔍 Final check: Looking for bet on-chain after all confirmation attempts failed...`)
          
          const programId = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4')
          
          const betExists = await checkBetExists(connection, programId, raceId, playerAddress)
          
          if (!betExists) {
            console.error(`❌ Transaction confirmation failed and bet not found on-chain`)
            throw lastError || new Error('Transaction confirmation failed')
          } else {
            console.log(`✅ Bet found on-chain! Transaction was successful despite confirmation issues.`)
          }
        }

        console.log(`✅ Bet placed successfully! Signature: ${signature}`)

        return {
          signature,
          amount,
          assetIdx,
          raceId,
          microAmount,
        }
      } catch (error: any) {
        // If we have a signature, check if the bet actually exists before failing
        if (signature) {
          console.log(`🔍 Error occurred but we have signature ${signature}, checking if bet exists...`)
          
          try {
            const programId = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4')
            
            const betExists = await checkBetExists(connection, programId, raceId, playerAddress)
            
            if (betExists) {
              console.log(`✅ Bet found on-chain! Transaction was actually successful.`)
              return {
                signature,
                amount,
                assetIdx,
                raceId,
                microAmount: Math.floor(amount * 1_000_000),
              }
            }
          } catch (checkError) {
            console.warn('Error checking bet existence:', checkError)
          }
        }

        console.error('❌ Failed to place bet:', error)
        
        // Enhanced error handling with specific error messages
        let errorMessage = 'Failed to place bet'
        
        if (error.message?.includes('User rejected') || error.message?.includes('User canceled')) {
          errorMessage = 'Transaction cancelled by user'
          throw new Error(errorMessage) // Don't log user cancellations as errors
        } else if (error.message?.includes('auth_token not valid')) {
          errorMessage = 'Authorization expired. Please try again.'
        } else if (error.message?.includes('insufficient funds')) {
          errorMessage = 'Insufficient USDC balance'
        } else if (error.message?.includes('BettingClosed')) {
          errorMessage = 'Betting period has ended'
        } else if (error.message?.includes('InvalidAmount')) {
          errorMessage = 'Invalid bet amount (minimum $0.10)'
        } else if (error.message?.includes('AssetMismatch')) {
          errorMessage = 'You already have a bet on a different asset'
        } else if (error.message?.includes('AlreadySettled')) {
          errorMessage = 'This race has already been settled'
        } else if (error.message?.includes('RaceNotFound')) {
          errorMessage = 'Race not found'
        } else if (error.message?.includes('Transaction failed')) {
          errorMessage = 'Transaction failed. Please try again.'
        } else if (error.message?.includes('timeout') || error.message?.includes('Confirmation timeout')) {
          errorMessage = 'Transaction timeout. If you signed in Phantom, your bet may still go through.'
        } else if (error.message?.includes('Wallet operation timed out')) {
          errorMessage = 'Complete the action in Phantom and return to this app.'
        } else if (error.code === 4001) {
          errorMessage = 'Transaction rejected'
        } else if (error.message?.includes('blockhash not found')) {
          errorMessage = 'Network congestion. Please try again.'
        }
        
        console.error(`💥 Bet placement error: ${errorMessage}`, error)
        throw new Error(errorMessage)
      }
    },
    onSuccess: async (data, variables) => {
      // Show success feedback with premium gaming design
      console.log(`✅ Success: Bet placed! $${data.amount} USDC on asset ${data.assetIdx}`)

      // Enhanced premium betting success notification
      try {
        // Add haptic feedback for successful bet placement
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([50, 30, 50, 30, 50]) // Betting confirmation pattern
        }

        // Get asset info for better messaging
        const assetNames = ['BTC', 'ETH', 'SOL'] // Could be dynamic from race data
        const assetName = assetNames[data.assetIdx] || `Asset ${data.assetIdx + 1}`

        Snackbar.show({
          text: `🎯 BET LOCKED IN! 🏁\n💰 $${data.amount} USDC on ${assetName}\n🚀 May the best prediction win!`,
          duration: Snackbar.LENGTH_LONG, // Longer for important betting confirmations
          backgroundColor: '#9945FF', // Purple theme for betting
          textColor: '#FFFFFF',
          action: {
            text: 'LET\'S GO! 🏎️',
            textColor: '#FFD700',
            onPress: () => {
              console.log('🎯 User excited about their bet!')
            },
          },
        })
      } catch (snackbarError) {
        // Enhanced fallback with better styling
        try {
          console.log(`🎯 BET PLACED SUCCESSFULLY! 🏁`)
          console.log(`💰 $${data.amount} USDC locked in!`)
          console.log(`🚀 Race ${data.raceId} - You're in the game!`)
        } catch (error) {
          console.log(`✅ Bet placed successfully: $${data.amount} USDC on asset ${data.assetIdx}`)
        }
      }

      // Wait for blockchain to process the transaction
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Refresh data to show the updated bet
      try {
        await Promise.all([
          fetchCommitPhaseData(data.raceId, variables.playerAddress.toString(), false),
          fetchUserBets(variables.playerAddress.toString(), false)
        ])
        console.log(`🔄 Data refreshed after successful bet placement`)
      } catch (error) {
        console.warn('⚠️ Failed to refresh data after bet placement:', error)
        // Don't throw - the bet was successful even if refresh failed
      }
    },
    onError: (error: any, variables) => {
      console.error('❌ Bet placement failed:', error)

      // Enhanced error feedback with premium styling and categorization
      let errorTitle = '⚠️ Bet Failed'
      let errorMessage = 'Failed to place bet'
      let actionText = 'TRY AGAIN'
      let backgroundColor = '#FF4444'

      // Categorize betting-specific errors for better UX
      if (error.message?.includes('insufficient funds')) {
        errorTitle = '💸 Insufficient Balance'
        errorMessage = 'Not enough USDC in your wallet.\nAdd funds and come back to race!'
        actionText = 'ADD FUNDS'
        backgroundColor = '#FF6B00'
      } else if (error.message?.includes('auth_token not valid')) {
        errorTitle = '🔐 Session Expired' 
        errorMessage = 'Your wallet session expired.\nReconnect and place your bet!'
        actionText = 'RECONNECT'
        backgroundColor = '#9945FF'
      } else if (error.message?.includes('transaction failed')) {
        errorTitle = '⚡ Network Issue'
        errorMessage = 'Connection problem detected.\nCheck your network and try again!'
        actionText = 'RETRY'
        backgroundColor = '#FF4444'
      } else if (error.message?.includes('user rejected') || error.message?.includes('cancelled') || error.message?.includes('User canceled')) {
        // Don't show error for user cancellations - they know they cancelled
        return
      } else if (error.message?.includes('timeout')) {
        errorTitle = '⏰ Taking Too Long'
        errorMessage = 'Transaction is slow but may succeed.\nCheck Phantom and return if signed!'
        actionText = 'CHECK PHANTOM'
        backgroundColor = '#FFD700'
      } else if (error.message?.includes('Wallet operation timed out')) {
        errorTitle = '📱 Complete in Phantom'
        errorMessage = 'Finish the bet in your Phantom wallet,\nthen return to see your position!'
        actionText = 'GOT IT'
        backgroundColor = '#9945FF'
      } else if (error.message?.includes('BettingClosed')) {
        errorTitle = '🏁 Too Late!'
        errorMessage = 'Betting period just ended.\nCatch the next race starting soon!'
        actionText = 'NEXT RACE'
        backgroundColor = '#FFD700'
      } else if (error.message?.includes('InvalidAmount')) {
        errorTitle = '💰 Invalid Amount'
        errorMessage = 'Bet must be between $0.10 - $1000.\nAdjust your amount and try again!'
        actionText = 'ADJUST BET'
        backgroundColor = '#FF6B00'
      } else if (error.message?.includes('AssetMismatch')) {
        errorTitle = '🎯 Already Betting'
        errorMessage = 'You already have a bet in this race.\nWait for the next race to bet again!'
        actionText = 'NEXT RACE'
        backgroundColor = '#9945FF'
      } else if (error.message?.includes('AlreadySettled')) {
        errorTitle = '🏆 Race Over'
        errorMessage = 'This race has finished.\nJoin the next exciting race!'
        actionText = 'NEW RACE'
        backgroundColor = '#00FF88'
      } else if (error.message?.includes('RaceNotFound')) {
        errorTitle = '🔍 Race Missing'
        errorMessage = 'This race doesn\'t exist.\nRefresh and find an active race!'
        actionText = 'REFRESH'
        backgroundColor = '#9945FF'
      } else if (error.message) {
        errorMessage = error.message
      }

      // Enhanced betting error notification
      try {
        // Add subtle vibration for errors
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([80]) // Single firm vibration for bet errors
        }

        Snackbar.show({
          text: `${errorTitle}\n${errorMessage}`,
          duration: Snackbar.LENGTH_LONG,
          backgroundColor: backgroundColor,
          textColor: '#FFFFFF',
          action: {
            text: actionText,
            textColor: '#FFFFFF',
            onPress: () => {
              console.log(`User acknowledged betting error: ${errorTitle}`)
            },
          },
        })
      } catch (snackbarError) {
        // Enhanced fallback for betting errors
        console.error(`${errorTitle}: ${errorMessage}`)
      }
    },
  })
}

export function useCanPlaceBet({
  userBalance,
  betAmount,
  selectedAssetIdx,
  race,
  userBet
}: {
  userBalance: number | null
  betAmount: string
  selectedAssetIdx: number
  race: any
  userBet: any
}) {
  // Check all conditions for placing a bet
  const amount = parseFloat(betAmount)
  const hasValidAmount = !isNaN(amount) && amount >= 0.1 && amount <= 1000
  const hasSufficientBalance = userBalance !== null && userBalance >= amount
  const hasSelectedAsset = selectedAssetIdx >= 0
  const hasActiveRace = race && race.state === 'Betting'
  const hasExistingBet = !!userBet
  const isInCommitPhase = race && Math.floor(Date.now() / 1000) < race.lockTs

  const canPlaceBet = hasValidAmount &&
                     hasSufficientBalance &&
                     hasSelectedAsset &&
                     hasActiveRace &&
                     !hasExistingBet &&
                     isInCommitPhase

  // Return detailed validation info for better UI feedback
  return {
    canPlaceBet,
    validationErrors: {
      invalidAmount: !hasValidAmount,
      insufficientBalance: !hasSufficientBalance,
      noAssetSelected: !hasSelectedAsset,
      noActiveRace: !hasActiveRace,
      existingBet: hasExistingBet,
      notInCommitPhase: !isInCommitPhase,
    },
    validationMessage: !hasValidAmount
      ? 'Enter amount between $0.10 - $1000'
      : !hasSufficientBalance
      ? 'Insufficient USDC balance'
      : !hasSelectedAsset
      ? 'Select an asset to bet on'
      : !hasActiveRace
      ? 'No active race available'
      : hasExistingBet
      ? 'You already have a bet in this race'
      : !isInCommitPhase
      ? 'Betting phase has ended'
      : 'Ready to place bet',
  }
} 