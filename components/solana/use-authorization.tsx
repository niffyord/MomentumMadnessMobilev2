import {
  useCallback,
  useMemo,
} from 'react'

import { toUint8Array } from 'js-base64'

import { useCluster } from '@/components/cluster/cluster-provider'
import { AppConfig } from '@/constants/app-config'
import { ellipsify } from '@/utils/ellipsify'
import { storage } from '@/store/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Account as AuthorizedAccount,
  AppIdentity,
  AuthorizationResult,
  AuthorizeAPI,
  AuthToken,
  Base64EncodedAddress,
  DeauthorizeAPI,
  SignInPayload,
} from '@solana-mobile/mobile-wallet-adapter-protocol'
import {
  PublicKey,
  PublicKeyInitData,
} from '@solana/web3.js'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { WalletIcon } from '@wallet-standard/core'

const identity: AppIdentity = { 
  name: AppConfig.name, 
  uri: AppConfig.uri,
  icon: AppConfig.icon // Add the icon for better wallet app recognition
}

export type Account = Readonly<{
  address: Base64EncodedAddress
  displayAddress?: string
  icon?: WalletIcon
  label?: string
  publicKey: PublicKey
}>

type WalletAuthorization = Readonly<{
  accounts: Account[]
  authToken: AuthToken
  selectedAccount: Account
}>

function getAccountFromAuthorizedAccount(account: AuthorizedAccount): Account {
  const publicKey = getPublicKeyFromAddress(account.address)
  return {
    address: account.address,
    // TODO: Fix?
    displayAddress: (account as unknown as { display_address: string }).display_address,
    icon: account.icon,
    label: account.label ?? ellipsify(publicKey.toString(), 8),
    publicKey,
  }
}

function getAuthorizationFromAuthorizationResult(
  authorizationResult: AuthorizationResult,
  previouslySelectedAccount?: Account,
): WalletAuthorization {
  let selectedAccount: Account
  if (
    // We have yet to select an account.
    previouslySelectedAccount == null ||
    // The previously selected account is no longer in the set of authorized addresses.
    !authorizationResult.accounts.some(({ address }) => address === previouslySelectedAccount.address)
  ) {
    const firstAccount = authorizationResult.accounts[0]
    selectedAccount = getAccountFromAuthorizedAccount(firstAccount)
  } else {
    selectedAccount = previouslySelectedAccount
  }
  return {
    accounts: authorizationResult.accounts.map(getAccountFromAuthorizedAccount),
    authToken: authorizationResult.auth_token,
    selectedAccount,
  }
}

function getPublicKeyFromAddress(address: Base64EncodedAddress): PublicKey {
  const publicKeyByteArray = toUint8Array(address)
  return new PublicKey(publicKeyByteArray)
}

function cacheReviver(key: string, value: any) {
  if (key === 'publicKey') {
    return new PublicKey(value as PublicKeyInitData) // the PublicKeyInitData should match the actual data structure stored in AsyncStorage
  } else {
    return value
  }
}

const AUTHORIZATION_STORAGE_KEY = 'authorization-cache'

const queryKey = ['wallet-authorization']

function usePersistAuthorization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (auth: WalletAuthorization | null): Promise<void> => {
      // Persist to fast MMKV and fallback AsyncStorage for compatibility
      storage.set(AUTHORIZATION_STORAGE_KEY, JSON.stringify(auth))
      try {
        await AsyncStorage.setItem(AUTHORIZATION_STORAGE_KEY, JSON.stringify(auth))
      } catch(_) {}

    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}

function useFetchAuthorization() {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<WalletAuthorization | null> => {
      let cacheFetchResult = storage.getString(AUTHORIZATION_STORAGE_KEY)
      if (!cacheFetchResult) {
        // Attempt migration from AsyncStorage (legacy)
        try {
          cacheFetchResult = await AsyncStorage.getItem(AUTHORIZATION_STORAGE_KEY) || null
          if (cacheFetchResult) {
            // migrate to MMKV for future fast reads
            storage.set(AUTHORIZATION_STORAGE_KEY, cacheFetchResult)
          }
        } catch (_) {}
      }

      // Return prior authorization, if found.
      return cacheFetchResult ? JSON.parse(cacheFetchResult, cacheReviver) : null
    },
  })
}

function useInvalidateAuthorizations() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey })
}

export function useAuthorization() {
  const { selectedCluster } = useCluster()
  const fetchQuery = useFetchAuthorization()
  const invalidateAuthorizations = useInvalidateAuthorizations()
  const persistMutation = usePersistAuthorization()

  const handleAuthorizationResult = useCallback(
    async (authorizationResult: AuthorizationResult): Promise<WalletAuthorization> => {
      const nextAuthorization = getAuthorizationFromAuthorizationResult(
        authorizationResult,
        fetchQuery.data?.selectedAccount,
      )
      await persistMutation.mutateAsync(nextAuthorization)
      return nextAuthorization
    },
    [fetchQuery.data?.selectedAccount, persistMutation],
  )

  const authorizeSession = useCallback(
    async (wallet: AuthorizeAPI) => {
      try {
        console.log('🔐 Starting MWA authorization...', {
          identity,
          chain: selectedCluster.id,
          hasAuthToken: !!fetchQuery.data?.authToken,
        })

        const authorizationResult = await wallet.authorize({
          identity,
          chain: selectedCluster.id,
          auth_token: fetchQuery.data?.authToken,
        })

        console.log('✅ MWA authorization successful:', {
          accountsCount: authorizationResult.accounts.length,
          hasAuthToken: !!authorizationResult.auth_token,
        })

        return (await handleAuthorizationResult(authorizationResult)).selectedAccount
      } catch (error: any) {
        console.error('❌ MWA authorization failed:', error)
        
        // Enhanced error handling for Mock MWA Wallet
        if (error.message?.includes('authorization request declined')) {
          console.error('🚨 Authorization declined - Mock MWA Wallet troubleshooting:')
          console.error('1. Ensure Mock MWA Wallet is installed and running')
          console.error('2. Press "Authenticate" button in Mock MWA Wallet (valid for 15 minutes)')
          console.error('3. Complete the biometric authentication when prompted')
          console.error('4. Check if the wallet app is properly responding to the request')
          
          // Throw a more user-friendly error
          throw new Error('Wallet authentication required. Please open Mock MWA Wallet, press "Authenticate", and complete biometric verification.')
        }
        
        // Re-throw the original error if it's not the specific authorization declined error
        throw error
      }
    },
    [fetchQuery.data?.authToken, handleAuthorizationResult, selectedCluster.id],
  )

  const authorizeSessionWithSignIn = useCallback(
    async (wallet: AuthorizeAPI, signInPayload: SignInPayload) => {
      try {
        console.log('🔐 Starting MWA authorization with Sign-In...', {
          identity,
          chain: selectedCluster.id,
          hasAuthToken: !!fetchQuery.data?.authToken,
          signInPayload,
        })

        const authorizationResult = await wallet.authorize({
          identity,
          chain: selectedCluster.id,
          auth_token: fetchQuery.data?.authToken,
          sign_in_payload: signInPayload,
        })

        console.log('✅ MWA authorization with Sign-In successful')
        return (await handleAuthorizationResult(authorizationResult)).selectedAccount
      } catch (error: any) {
        console.error('❌ MWA authorization with Sign-In failed:', error)
        
        // Enhanced error handling for Mock MWA Wallet
        if (error.message?.includes('authorization request declined')) {
          throw new Error('Wallet authentication required. Please open Mock MWA Wallet, press "Authenticate", and complete biometric verification.')
        }
        
        throw error
      }
    },
    [fetchQuery.data?.authToken, handleAuthorizationResult, selectedCluster.id],
  )

  const deauthorizeSession = useCallback(
    async (wallet: DeauthorizeAPI) => {
      if (fetchQuery.data?.authToken == null) {
        return
      }
      await wallet.deauthorize({ auth_token: fetchQuery.data.authToken })
      await persistMutation.mutateAsync(null)
    },
    [fetchQuery.data?.authToken, persistMutation],
  )

  const deauthorizeSessions = useCallback(async () => {
    await invalidateAuthorizations()
    await persistMutation.mutateAsync(null)
  }, [invalidateAuthorizations, persistMutation])

  return useMemo(
    () => ({
      accounts: fetchQuery.data?.accounts ?? null,
      authorizeSession,
      authorizeSessionWithSignIn,
      deauthorizeSession,
      deauthorizeSessions,
      isLoading: fetchQuery.isLoading,
      selectedAccount: fetchQuery.data?.selectedAccount ?? null,
    }),
    [
      authorizeSession,
      authorizeSessionWithSignIn,
      deauthorizeSession,
      deauthorizeSessions,
      fetchQuery.data?.accounts,
      fetchQuery.data?.selectedAccount,
      fetchQuery.isLoading,
    ],
  )
}
