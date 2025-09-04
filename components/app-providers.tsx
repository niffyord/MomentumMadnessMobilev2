import { PropsWithChildren } from 'react'

import { AppTheme } from '@/components/app-theme'
import { AuthProvider } from '@/components/auth/auth-provider'
import { SolanaProvider } from '@/components/solana/solana-provider'
import { NotificationProvider } from '@/components/ui/NotificationProvider'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import { ClusterProvider } from './cluster/cluster-provider'
import GlobalTypography from '@/components/GlobalTypography'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppTheme>
      <QueryClientProvider client={queryClient}>
        <ClusterProvider>
          <SolanaProvider>
            <AuthProvider>
              <NotificationProvider>
                <GlobalTypography />
                {children}
              </NotificationProvider>
            </AuthProvider>
          </SolanaProvider>
        </ClusterProvider>
      </QueryClientProvider>
    </AppTheme>
  )
}
