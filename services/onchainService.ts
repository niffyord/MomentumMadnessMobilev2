import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

import { getCurrentConfig } from './config'

export class OnChainService {
  private connection: Connection
  private config: ReturnType<typeof getCurrentConfig>

  constructor(connection: Connection) {
    this.connection = connection
    this.config = getCurrentConfig()
  }

  /**
   * Create a claim payout transaction based on the IDL
   */
  async createClaimPayoutTransaction({
    playerPublicKey,
    raceId,
  }: {
    playerPublicKey: PublicKey
    raceId: number
  }): Promise<{
    transaction: VersionedTransaction
    latestBlockhash: { blockhash: string; lastValidBlockHeight: number }
    minContextSlot: number
  }> {
    try {
      console.log(`🔗 Creating claim payout transaction for race ${raceId}, player: ${playerPublicKey.toString()}`)
      
      // Get the latest blockhash and slot to use in our transaction
      const {
        context: { slot: minContextSlot },
        value: latestBlockhash,
      } = await this.connection.getLatestBlockhashAndContext()

      // Derive PDAs based on the IDL structure
      const raceIdBuffer = Buffer.alloc(8)
      raceIdBuffer.writeBigUInt64LE(BigInt(raceId), 0)
      
      const [racePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('race'), raceIdBuffer],
        this.config.programId
      )

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bet'), racePda.toBuffer(), playerPublicKey.toBuffer()],
        this.config.programId
      )

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        this.config.programId
      )

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        this.config.programId
      )

      console.log(`📍 PDAs derived:`)
      console.log(`   Race: ${racePda.toString()}`)
      console.log(`   Bet: ${betPda.toString()}`)
      console.log(`   Vault: ${vaultPda.toString()}`)
      console.log(`   Config: ${configPda.toString()}`)

      // Get associated token accounts
      const vaultUsdc = getAssociatedTokenAddressSync(
        this.config.usdcMint,
        vaultPda,
        true // allowOwnerOffCurve
      )

      const playerUsdc = getAssociatedTokenAddressSync(
        this.config.usdcMint,
        playerPublicKey
      )

      console.log(`💰 Token accounts:`)
      console.log(`   Vault USDC: ${vaultUsdc.toString()}`)
      console.log(`   Player USDC: ${playerUsdc.toString()}`)
      console.log(`   USDC Mint: ${this.config.usdcMint.toString()}`)

      // Build the claim payout instruction based on IDL
      const instruction = this.createClaimPayoutInstruction({
        bet: betPda,
        race: racePda,
        vault: vaultPda,
        vaultUsdc,
        playerUsdc,
        usdcMint: this.config.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        config: configPda,
      })

      // Create a new TransactionMessage and compile it
      const messageV0 = new TransactionMessage({
        payerKey: playerPublicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [instruction],
      }).compileToV0Message()

      // Create a new VersionedTransaction
      const transaction = new VersionedTransaction(messageV0)

      console.log(`✅ Transaction created successfully`)

      return {
        transaction,
        latestBlockhash,
        minContextSlot,
      }
    } catch (error) {
      console.error('❌ Error creating claim payout transaction:', error)
      throw error
    }
  }

  /**
   * Create the claim payout instruction based on the IDL discriminator and accounts
   */
  private createClaimPayoutInstruction({
    bet,
    race,
    vault,
    vaultUsdc,
    playerUsdc,
    usdcMint,
    tokenProgram,
    config,
  }: {
    bet: PublicKey
    race: PublicKey
    vault: PublicKey
    vaultUsdc: PublicKey
    playerUsdc: PublicKey
    usdcMint: PublicKey
    tokenProgram: PublicKey
    config: PublicKey
  }): TransactionInstruction {
    // Instruction discriminator from IDL: [127, 240, 132, 62, 227, 198, 146, 133]
    const discriminator = Buffer.from([127, 240, 132, 62, 227, 198, 146, 133])

    // No additional data needed for claim_payout
    const data = discriminator

    // Account metas based on IDL order
    const accounts: AccountMeta[] = [
      { pubkey: bet, isSigner: false, isWritable: true },
      { pubkey: race, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: playerUsdc, isSigner: false, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
    ]

    return new TransactionInstruction({
      keys: accounts,
      programId: this.config.programId,
      data,
    })
  }

  /**
   * Helper to derive race PDA
   */
  static getRacePda(raceId: number, programId: PublicKey): PublicKey {
    const raceIdBuffer = Buffer.alloc(8)
    raceIdBuffer.writeBigUInt64LE(BigInt(raceId), 0)
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('race'), raceIdBuffer],
      programId
    )
    return pda
  }

  /**
   * Helper to derive bet PDA
   */
  static getBetPda(race: PublicKey, player: PublicKey, programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bet'), race.toBuffer(), player.toBuffer()],
      programId
    )
    return pda
  }

  /**
   * Create a place bet transaction based on the IDL
   */
  async createPlaceBetTransaction({
    playerPublicKey,
    raceId,
    assetIdx,
    amount,
  }: {
    playerPublicKey: PublicKey
    raceId: number
    assetIdx: number
    amount: number
  }): Promise<{
    transaction: VersionedTransaction
    latestBlockhash: { blockhash: string; lastValidBlockHeight: number }
    minContextSlot: number
  }> {
    try {
      console.log(`🎯 Creating place bet transaction for race ${raceId}, player: ${playerPublicKey.toString()}, asset: ${assetIdx}, amount: ${amount}`)
      
      // Get the latest blockhash and slot to use in our transaction
      const {
        context: { slot: minContextSlot },
        value: latestBlockhash,
      } = await this.connection.getLatestBlockhashAndContext()

      // Derive PDAs based on the IDL structure
      const raceIdBuffer = Buffer.alloc(8)
      raceIdBuffer.writeBigUInt64LE(BigInt(raceId), 0)
      
      const [racePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('race'), raceIdBuffer],
        this.config.programId
      )

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bet'), racePda.toBuffer(), playerPublicKey.toBuffer()],
        this.config.programId
      )

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        this.config.programId
      )

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        this.config.programId
      )

      console.log(`📍 PDAs derived:`)
      console.log(`   Race: ${racePda.toString()}`)
      console.log(`   Bet: ${betPda.toString()}`)
      console.log(`   Vault: ${vaultPda.toString()}`)
      console.log(`   Config: ${configPda.toString()}`)

      // Get associated token accounts
      const vaultUsdc = getAssociatedTokenAddressSync(
        this.config.usdcMint,
        vaultPda,
        true // allowOwnerOffCurve
      )

      const playerUsdc = getAssociatedTokenAddressSync(
        this.config.usdcMint,
        playerPublicKey
      )

      console.log(`💰 Token accounts:`)
      console.log(`   Vault USDC: ${vaultUsdc.toString()}`)
      console.log(`   Player USDC: ${playerUsdc.toString()}`)
      console.log(`   USDC Mint: ${this.config.usdcMint.toString()}`)

      // Build the place bet instruction based on IDL
      const instruction = this.createPlaceBetInstruction({
        bet: betPda,
        race: racePda,
        vault: vaultPda,
        vaultUsdc,
        playerUsdc,
        usdcMint: this.config.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        config: configPda,
        player: playerPublicKey,
        assetIdx,
        amount,
      })

      // Create a new TransactionMessage and compile it
      const messageV0 = new TransactionMessage({
        payerKey: playerPublicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [instruction],
      }).compileToV0Message()

      // Create a new VersionedTransaction
      const transaction = new VersionedTransaction(messageV0)

      console.log(`✅ Place bet transaction created successfully`)

      return {
        transaction,
        latestBlockhash,
        minContextSlot,
      }
    } catch (error) {
      console.error('❌ Error creating place bet transaction:', error)
      throw error
    }
  }

  /**
   * Create the place bet instruction based on the IDL discriminator and accounts
   */
  private createPlaceBetInstruction({
    bet,
    race,
    vault,
    vaultUsdc,
    playerUsdc,
    usdcMint,
    tokenProgram,
    config,
    player,
    assetIdx,
    amount,
  }: {
    bet: PublicKey
    race: PublicKey
    vault: PublicKey
    vaultUsdc: PublicKey
    playerUsdc: PublicKey
    usdcMint: PublicKey
    tokenProgram: PublicKey
    config: PublicKey
    player: PublicKey
    assetIdx: number
    amount: number
  }): TransactionInstruction {
    // Correct instruction discriminator for place_bet from IDL: [222, 62, 67, 220, 63, 166, 126, 33]
    const discriminator = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33])

    // Serialize instruction data: asset_idx (u8) + amount (u64)
    const data = Buffer.alloc(8 + 1 + 8) // discriminator + asset_idx + amount
    discriminator.copy(data, 0)
    data.writeUInt8(assetIdx, 8) // asset_idx as u8
    data.writeBigUInt64LE(BigInt(amount), 9) // amount as u64

    // Account metas based on EXACT IDL order for place_bet
    const accounts: AccountMeta[] = [
      { pubkey: bet, isSigner: false, isWritable: true },           // bet
      { pubkey: race, isSigner: false, isWritable: true },          // race  
      { pubkey: config, isSigner: false, isWritable: false },       // config
      { pubkey: playerUsdc, isSigner: false, isWritable: true },    // player_usdc
      { pubkey: vault, isSigner: false, isWritable: true },         // vault (writable per IDL)
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },     // vault_usdc
      { pubkey: usdcMint, isSigner: false, isWritable: false },     // usdc_mint
      { pubkey: player, isSigner: true, isWritable: true },         // player (writable per IDL)
      { pubkey: this.config.systemProgram, isSigner: false, isWritable: false }, // system_program
      { pubkey: tokenProgram, isSigner: false, isWritable: false }, // token_program
    ]

    return new TransactionInstruction({
      keys: accounts,
      programId: this.config.programId,
      data,
    })
  }

  /**
   * Helper to check if a bet exists and is claimable
   */
  async checkBetClaimability(playerPublicKey: PublicKey, raceId: number): Promise<{
    exists: boolean
    claimed: boolean
    isWinner: boolean
    canClaim: boolean
  }> {
    try {
      const racePda = OnChainService.getRacePda(raceId, this.config.programId)
      const betPda = OnChainService.getBetPda(racePda, playerPublicKey, this.config.programId)
      
      const betAccount = await this.connection.getAccountInfo(betPda)
      
      if (!betAccount) {
        return { exists: false, claimed: false, isWinner: false, canClaim: false }
      }

      // Parse bet account data to check claim status
      // This would need to match the Bet struct from the IDL
      // For now, we'll assume it exists and can be claimed
      return { exists: true, claimed: false, isWinner: true, canClaim: true }
    } catch (error) {
      console.error('Error checking bet claimability:', error)
      return { exists: false, claimed: false, isWinner: false, canClaim: false }
    }
  }
} 