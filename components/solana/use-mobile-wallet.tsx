import {
  useCallback,
  useMemo,
} from 'react'

import { SignInPayload } from '@solana-mobile/mobile-wallet-adapter-protocol'
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import {
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js'

import {
  Account,
  useAuthorization,
} from './use-authorization'

export function useMobileWallet() {
  const { authorizeSessionWithSignIn, authorizeSession, deauthorizeSessions } = useAuthorization()

  const connect = useCallback(async (): Promise<Account> => {
    return await transact(async (wallet) => {
      return await authorizeSession(wallet)
    })
  }, [authorizeSession])

  const signIn = useCallback(
    async (signInPayload: SignInPayload): Promise<Account> => {
      return await transact(async (wallet) => {
        return await authorizeSessionWithSignIn(wallet, signInPayload)
      })
    },
    [authorizeSessionWithSignIn],
  )

  const disconnect = useCallback(async (): Promise<void> => {
    await deauthorizeSessions()
  }, [deauthorizeSessions])

  const signAndSendTransaction = useCallback(
    async (transaction: Transaction | VersionedTransaction, minContextSlot?: number): Promise<TransactionSignature> => {
      return await transact(async (wallet) => {
        // Always authorize before signing transactions to ensure valid auth token
        // This is lightweight if already authorized and handles expired tokens
        console.log('🔐 Ensuring valid authorization for transaction...')
        await authorizeSession(wallet)
        
        console.log('🔄 Sending transaction to wallet for signing and sending...')
        
        // Add timeout wrapper for the wallet operation
        const signAndSendPromise = wallet.signAndSendTransactions({
          transactions: [transaction],
          ...(minContextSlot && { minContextSlot }),
        })
        
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Wallet operation timed out - please check if you completed the action in Phantom'))
          }, 120000) // 2 minute timeout
        })
        
        const signatures = await Promise.race([signAndSendPromise, timeoutPromise])
        
        console.log('✅ Transaction completed by wallet')
        return signatures[0]
      })
    },
    [authorizeSession],
  )

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      return await transact(async (wallet) => {
        const authResult = await authorizeSession(wallet)
        const signedMessages = await wallet.signMessages({
          addresses: [authResult.address],
          payloads: [message],
        })
        return signedMessages[0]
      })
    },
    [authorizeSession],
  )

  return useMemo(
    () => ({
      connect,
      signIn,
      disconnect,
      signAndSendTransaction,
      signMessage,
    }),
    [connect, disconnect, signAndSendTransaction, signIn, signMessage],
  )
}
