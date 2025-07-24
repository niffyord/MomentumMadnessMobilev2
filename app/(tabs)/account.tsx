import React from 'react'

import { AccountFeature } from '@/components/account/account-feature'
import { AppView } from '@/components/app-view'

export default function AccountScreen() {
  return (
    <AppView style={{ flex: 1 }}>
      <AccountFeature />
    </AppView>
  )
} 