import io, { Socket } from 'socket.io-client'

import { getBackendBaseUrl } from './backendConfig'

export type RaceUpdateHandler = (data: any) => void;
export type PriceUpdateHandler = (data: Record<string, number>) => void;
export type UserBetUpdateHandler = (data: any) => void;

export class WebSocketService {
  private socket: Socket | null = null;
  private baseUrl: string;
  private isConnecting = false;
  private isConnected = false;

  private raceHandler?: RaceUpdateHandler;
  private priceHandler?: PriceUpdateHandler;
  private betHandler?: UserBetUpdateHandler;

  constructor(baseUrl: string = '') {
    // Always use ws:// or wss:// for socket.io
    let url = baseUrl || getBackendBaseUrl();
    if (url.startsWith('https')) {
      url = url.replace('https', 'wss');
    } else if (url.startsWith('http')) {
      url = url.replace('http', 'ws');
    }
    // Android emulator uses ws://10.0.2.2:3000, not ws://localhost:3000
    if (url.includes('localhost') && url.includes('3000')) {
      url = url.replace('localhost', '10.0.2.2');
    }
    this.baseUrl = url;
  }

  connect(): Promise<void> {
    // Prevent multiple concurrent connections
    if (this.isConnecting || this.isConnected) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      this.socket = io(this.baseUrl, {
        transports: ['websocket'],
        forceNew: false, // Reuse existing connection if available
        timeout: 30000, // Increased to 30s for blockchain operations
        reconnection: true, // Use Socket.IO's built-in reconnection
        reconnectionAttempts: 3, // Reduced to prevent spam
        reconnectionDelay: 3000, // Increased delay
        reconnectionDelayMax: 10000, // Max delay between attempts
        autoConnect: true,
        withCredentials: false,
      });

      this.socket.on('connect', () => {
        this.isConnecting = false;
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        // Don't add custom reconnection - Socket.IO handles it
      });

      this.socket.on('connect_error', (error) => {
        this.isConnecting = false;
        this.isConnected = false;
        if (error.description) {
          console.error('📄 Error description:', error.description);
        }
        reject(error);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        this.isConnected = true;
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        // Silent reconnect attempts
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ WebSocket failed to reconnect');
        this.isConnected = false;
      });

      this.socket.on('race_update', data => {
        this.raceHandler && this.raceHandler(data);
      });

      this.socket.on('price_update', data => {
        this.priceHandler && this.priceHandler(data);
      });

      this.socket.on('user_bet_update', data => {
        this.betHandler && this.betHandler(data);
      });
    });
  }

  // Force reconnection (useful for app state changes)
  forceReconnect(): Promise<void> {
    console.log('🔄 Forcing WebSocket reconnection...')
    this.disconnect()
    // Wait a bit before reconnecting to ensure cleanup
    return new Promise((resolve) => {
      setTimeout(() => {
        this.connect().then(resolve).catch(resolve)
      }, 1000)
    })
  }

  subscribeToRace(raceId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe_race', { raceId });
    }
  }

  subscribeToPrice() {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe_prices', true);
    }
  }

  unsubscribeFromRace(raceId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('unsubscribe_race', { raceId });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.isConnected = false;
    }
  }

  onRaceUpdate(handler: RaceUpdateHandler) {
    this.raceHandler = handler;
  }

  onPriceUpdate(handler: PriceUpdateHandler) {
    this.priceHandler = handler;
  }

  onUserBetUpdate(handler: UserBetUpdateHandler) {
    this.betHandler = handler;
  }

  // Getter for connection status
  get connectionStatus() {
    return {
      isConnecting: this.isConnecting,
      isConnected: this.isConnected,
      socket: this.socket?.connected || false
    };
  }
}

export const websocketService = new WebSocketService(); 