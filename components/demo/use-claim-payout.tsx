import Snackbar from 'react-native-snackbar'

import { useConnection } from '@/components/solana/solana-provider'
import { useWalletUi } from '@/components/solana/use-wallet-ui'
import { PublicKey } from '@solana/web3.js'
import { useMutation } from '@tanstack/react-query'

import { OnChainService } from '../../services/onchainService'
import { useRaceStore } from '../../store/useRaceStore'

interface ClaimPayoutInput {
  raceId: number
  playerAddress: PublicKey
}


async function checkPayoutClaimed(
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
    if (!betAccount) return false

    
    
    
    
    
    
    const data = betAccount.data
    if (data && data.length > 40) {
      
      const claimed = data[40] === 1
      return claimed
    }
    
    return false
  } catch (error) {
    console.warn('Error checking payout claimed status:', error)
    return false
  }
}

export function useClaimPayout() {
  const connection = useConnection()
  const { signAndSendTransaction } = useWalletUi()
  const { fetchRaceDetails, fetchUserBets } = useRaceStore()

  return useMutation({
    mutationFn: async (input: ClaimPayoutInput) => {
      const { raceId, playerAddress } = input

      console.log(`💰 Claiming payout for race ${raceId}, player: ${playerAddress.toString()}`)

      let signature: string | null = null

      try {
        
        const onChainService = new OnChainService(connection)
        const { transaction, latestBlockhash, minContextSlot } = await onChainService.createClaimPayoutTransaction({
          playerPublicKey: playerAddress,
          raceId,
        })

        console.log(`📝 Claim transaction created, requesting signature...`)

        
        signature = await signAndSendTransaction(transaction, minContextSlot)

        console.log(`🔐 Claim transaction signed and sent: ${signature}`)

        
        let confirmationAttempts = 0
        const maxAttempts = 3
        let lastError: any = null

        while (confirmationAttempts < maxAttempts) {
          try {
            console.log(`🔄 Confirmation attempt ${confirmationAttempts + 1}/${maxAttempts}`)

            
            const confirmationPromise = connection.confirmTransaction(
              {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
              'confirmed'
            )

            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Confirmation timeout')), 30000) 
            })

            const confirmationResult = await Promise.race([confirmationPromise, timeoutPromise]) as any

            if (confirmationResult.value?.err) {
              const errorMsg = JSON.stringify(confirmationResult.value.err)
              console.error(`❌ Claim transaction failed on-chain: ${errorMsg}`)
              throw new Error(`Transaction failed: ${errorMsg}`)
            }

            console.log(`✅ Claim transaction confirmed successfully!`)
            break 

          } catch (confirmError: any) {
            confirmationAttempts++
            lastError = confirmError
            console.warn(`⚠️ Confirmation attempt ${confirmationAttempts} failed:`, confirmError.message)

            if (confirmationAttempts < maxAttempts) {
              
              if (confirmError.message?.includes('timeout') || confirmError.message?.includes('Confirmation timeout')) {
                console.log(`🔍 Checking if payout was claimed on-chain despite timeout...`)
                
                
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                const programId = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4')
                
                const payoutClaimed = await checkPayoutClaimed(connection, programId, raceId, playerAddress)
                
                if (payoutClaimed) {
                  console.log(`✅ Payout claimed on-chain! Transaction was successful despite confirmation timeout.`)
                  break 
                }
              }
              
              
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }

        
        if (confirmationAttempts >= maxAttempts) {
          console.log(`🔍 Final check: Looking for claimed payout on-chain after all confirmation attempts failed...`)
          
          const programId = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4')
          
          const payoutClaimed = await checkPayoutClaimed(connection, programId, raceId, playerAddress)
          
          if (!payoutClaimed) {
            console.error(`❌ Transaction confirmation failed and payout not claimed on-chain`)
            throw lastError || new Error('Transaction confirmation failed')
          } else {
            console.log(`✅ Payout claimed on-chain! Transaction was successful despite confirmation issues.`)
          }
        }

        console.log(`✅ Payout claimed successfully! Signature: ${signature}`)

        return {
          signature,
          raceId,
        }
      } catch (error: any) {
        
        if (signature) {
          console.log(`🔍 Error occurred but we have signature ${signature}, checking if payout was claimed...`)
          
          try {
            const programId = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4')
            
            const payoutClaimed = await checkPayoutClaimed(connection, programId, raceId, playerAddress)
            
            if (payoutClaimed) {
              console.log(`✅ Payout claimed on-chain! Transaction was actually successful.`)
              return {
                signature,
                raceId,
              }
            }
          } catch (checkError) {
            console.warn('Error checking payout claimed status:', checkError)
          }
        }

        console.error('❌ Failed to claim payout:', error)
        
        
        let errorMessage = 'Failed to claim payout'
        
        if (error.message?.includes('User rejected') || error.message?.includes('User canceled')) {
          errorMessage = 'Transaction cancelled by user'
          throw new Error(errorMessage) 
        } else if (error.message?.includes('auth_token not valid')) {
          errorMessage = 'Authorization expired. Please try again.'
        } else if (error.message?.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees'
        } else if (error.message?.includes('AlreadyClaimed')) {
          errorMessage = 'Payout has already been claimed'
        } else if (error.message?.includes('NotAWinner')) {
          errorMessage = 'Not eligible for payout'
        } else if (error.message?.includes('RaceNotSettled')) {
          errorMessage = 'Race is not settled yet'
        } else if (error.message?.includes('NoWinners')) {
          errorMessage = 'No winners in this race'
        } else if (error.message?.includes('InsufficientFunds')) {
          errorMessage = 'Insufficient funds in vault'
        } else if (error.message?.includes('ExcessiveClaims')) {
          errorMessage = 'Claims exceed available pool'
        } else if (error.message?.includes('Transaction failed')) {
          errorMessage = 'Transaction failed. Please try again.'
        } else if (error.message?.includes('timeout') || error.message?.includes('Confirmation timeout')) {
          errorMessage = 'Transaction timeout. If you signed in Phantom, your claim may still go through.'
        } else if (error.message?.includes('Wallet operation timed out')) {
          errorMessage = 'Complete the action in Phantom and return to this app.'
        } else if (error.code === 4001) {
          errorMessage = 'Transaction rejected'
        } else if (error.message?.includes('blockhash not found')) {
          errorMessage = 'Network congestion. Please try again.'
        }
        
        console.error(`💥 Claim payout error: ${errorMessage}`, error)
        throw new Error(errorMessage)
      }
    },
    onSuccess: async (data, variables) => {
      
      console.log(`✅ Success: Payout claimed for race ${data.raceId}`)

      
      try {
        
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]) 
        }

        Snackbar.show({
          text: `🏆 VICTORY PAYOUT CLAIMED! 🎉\n💰 Congratulations! Your winnings are now in your wallet.\n🚀 Ready for the next race?`,
          duration: Snackbar.LENGTH_LONG, 
          backgroundColor: 'linear-gradient(135deg, #00FF88 0%, #FFD700 100%)', 
          textColor: '#000000',
          action: {
            text: 'NICE! 🎯',
            textColor: '#FF6B00',
            onPress: () => {
              
              console.log('🎉 User acknowledged victory!')
            },
          },
        })
      } catch (snackbarError) {
        
        try {
          
          console.log(`🏆 PAYOUT CLAIMED SUCCESSFULLY! 🎉`)
          console.log(`💰 Your winnings are secured in your wallet`)
          console.log(`🚀 Race ${data.raceId} victory complete!`)
        } catch (error) {
          console.log(`✅ Payout claimed successfully for race ${data.raceId}`)
        }
      }

      
      // Backend metrics show <50ms response times, no need for artificial delays
      // Immediately refresh data since backend is very fast
      try {
        await Promise.all([
          fetchRaceDetails(data.raceId, false), 
          fetchUserBets(variables.playerAddress.toString(), false) 
        ])
        console.log(`🔄 Data refreshed immediately after successful payout claim`)
      } catch (error) {
        console.warn('⚠️ Failed to refresh data after payout claim:', error)
        
      }
    },
    onError: (error: any, variables) => {
      console.error('❌ Payout claim failed:', error)

      
      let errorTitle = '⚠️ Claim Failed'
      let errorMessage = 'Failed to claim payout'
      let actionText = 'TRY AGAIN'
      let backgroundColor = '#FF4444'

      
      if (error.message?.includes('insufficient funds')) {
        errorTitle = '💸 Insufficient Funds'
        errorMessage = 'Not enough SOL for transaction fees.\nAdd some SOL to your wallet and try again.'
        backgroundColor = '#FF6B00'
      } else if (error.message?.includes('auth_token not valid')) {
        errorTitle = '🔐 Session Expired'
        errorMessage = 'Your session has expired.\nPlease reconnect your wallet and try again.'
        backgroundColor = '#9945FF'
      } else if (error.message?.includes('transaction failed')) {
        errorTitle = '⚡ Transaction Failed'
        errorMessage = 'Network issue detected.\nPlease check your connection and try again.'
        backgroundColor = '#FF4444'
      } else if (error.message?.includes('user rejected') || error.message?.includes('cancelled') || error.message?.includes('User canceled')) {
        
        return
      } else if (error.message?.includes('timeout')) {
        errorTitle = '⏰ Transaction Timeout'
        errorMessage = 'The transaction is taking longer than expected.\nIf you signed in Phantom, your claim may still process.'
        actionText = 'WAIT & CHECK'
        backgroundColor = '#FFD700'
      } else if (error.message?.includes('Wallet operation timed out')) {
        errorTitle = '📱 Return to App'
        errorMessage = 'Complete the transaction in Phantom,\nthen return to this app to continue.'
        actionText = 'GOT IT'
        backgroundColor = '#9945FF'
      } else if (error.message?.includes('AlreadyClaimed')) {
        errorTitle = '✅ Already Claimed'
        errorMessage = 'This payout has already been claimed.\nCheck your wallet for the funds.'
        actionText = 'CHECK WALLET'
        backgroundColor = '#00FF88'
      } else if (error.message?.includes('NotAWinner')) {
        errorTitle = '🎯 Not Eligible'
        errorMessage = 'Only winners can claim payouts.\nBetter luck in the next race!'
        actionText = 'NEXT RACE'
        backgroundColor = '#9945FF'
      } else if (error.message?.includes('RaceNotSettled')) {
        errorTitle = '⏳ Race In Progress'
        errorMessage = 'The race hasn\'t settled yet.\nPlease wait for the race to complete.'
        actionText = 'WAIT'
        backgroundColor = '#FFD700'
      } else if (error.message) {
        errorMessage = error.message
      }

      
      try {
        
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([50]) 
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
              console.log(`User acknowledged error: ${errorTitle}`)
            },
          },
        })
      } catch (snackbarError) {
        
        console.error(`${errorTitle}: ${errorMessage}`)
      }
    },
  })
}

export function useCanClaimPayout({
  userBet,
  race,
  claimed
}: {
  userBet: any
  race: any
  claimed: boolean
}) {
  
  const isWinner = userBet?.isWinner || false
  const hasActiveRace = race && (race.state === 'SettlementReady' || race.state === 'Settled')
  const isAlreadyClaimed = claimed
  const isRaceSettled = race && race.winningAssets && race.winningAssets.length > 0

  const canClaimPayout = isWinner &&
                        hasActiveRace &&
                        !isAlreadyClaimed &&
                        isRaceSettled

  
  return {
    canClaimPayout,
    validationErrors: {
      notWinner: !isWinner,
      noActiveRace: !hasActiveRace,
      alreadyClaimed: isAlreadyClaimed,
      raceNotSettled: !isRaceSettled,
    },
    validationMessage: !isWinner
      ? 'Only winners can claim payouts'
      : !hasActiveRace
      ? 'Race is not in settlement phase'
      : isAlreadyClaimed
      ? 'Payout already claimed'
      : !isRaceSettled
      ? 'Race is not settled yet'
      : 'Ready to claim payout',
  }
} 