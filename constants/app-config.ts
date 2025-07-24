import { Cluster } from '@/components/cluster/cluster'
import { ClusterNetwork } from '@/components/cluster/cluster-network'
import { clusterApiUrl } from '@solana/web3.js'

export class AppConfig {
  static name = 'Momentum Racing'
  // Use a proper HTTPS URI for better wallet app recognition
  static uri = 'https://momentum-racing.app' // Changed to HTTPS for better compatibility
  static icon = 'icon.png' // This will resolve to https://momentum-racing.app/icon.png
  static scheme = 'momentum-racing' // Simplified scheme name
  static clusters: Cluster[] = [
    {
      id: 'solana:devnet',
      name: 'Devnet',
      endpoint: clusterApiUrl('devnet'),
      network: ClusterNetwork.Devnet,
    },
    {
      id: 'solana:testnet',
      name: 'Testnet',
      endpoint: clusterApiUrl('testnet'),
      network: ClusterNetwork.Testnet,
    },
  ]
}
