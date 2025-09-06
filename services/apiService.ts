import { getBackendBaseUrl } from './backendConfig'
import {
  AssetInfo,
  BetDetails,
  EnhancedRaceDetails,
  RaceServiceResponse,
  UserBetSummary,
} from './backendTypes'

interface PlaceBetRequest {
  playerAddress: string
  raceId: number
  assetIdx: number
  amount: number
}

interface ClaimPayoutRequest {
  playerAddress: string
  raceId: number
}

export class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBackendBaseUrl();
    console.log(`🔧 ApiService initialized with baseUrl: ${this.baseUrl}`);
  }

  private async request<T>(path: string, options?: RequestInit): Promise<RaceServiceResponse<T>> {
    const fullUrl = `${this.baseUrl}${path}`;
    const attempt = async (timeoutMs: number): Promise<RaceServiceResponse<T>> => {
      try {
        console.log(`🌐 API Request: ${fullUrl} (timeout=${timeoutMs}ms)`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(fullUrl, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error(`API returned non-JSON response: ${res.status} ${res.statusText}`, text);
          return { success: false, error: `Server error: ${res.status} ${res.statusText}` } as RaceServiceResponse<T>;
        }

        const result = await res.json();
        console.log(`✅ API Success: ${fullUrl}`, result);
        return result;
      } catch (err) {
        console.error(`❌ API attempt failed for ${fullUrl}:`, err);
        return { success: false, error: err instanceof Error ? err.message : 'Request failed' } as RaceServiceResponse<T>;
      }
    };

    // First attempt: 15s. If aborted/network error, retry once with 25s.
    const first = await attempt(15000);
    if (first.success) return first;
    if (String(first.error || '').toLowerCase().includes('abort')) {
      const second = await attempt(25000);
      return second;
    }
    return first;
  }

  // Asset endpoints
  getAssets() {
    return this.request<AssetInfo[]>('/api/assets');
  }

  // Race endpoints
  getCurrentRace() {
    return this.request<EnhancedRaceDetails>('/api/races/current');
  }

  getRace(raceId: number) {
    return this.request<EnhancedRaceDetails>(`/api/races/${raceId}`);
  }

  // Stats endpoints
  getGlobalStats() {
    return this.request<import('./backendTypes').GlobalStats>('/api/stats/global');
  }

  getRaceLeaderboard(raceId: number) {
    return this.request<any>(`/api/races/${raceId}/leaderboard`);
  }

  // User endpoints
  getUserBets(pubkey: string, forceRefresh: boolean = false) {
    const url = `/api/users/${pubkey}/bets${forceRefresh ? '?force=true' : ''}`;
    return this.request<UserBetSummary[]>(url);
  }

  getUserStats(pubkey: string) {
    return this.request<any>(`/api/users/${pubkey}/stats`);
  }

  getUserBalance(pubkey: string) {
    return this.request<{ solBalance: number; usdcBalance: number; timestamp: number }>(`/api/users/${pubkey}/balance`);
  }

  updateUserProfile(pubkey: string, profile: any) {
    return this.request<any>(`/api/users/${pubkey}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  }

  // Betting endpoints
  placeBet(request: PlaceBetRequest) {
    return this.request<BetDetails>('/api/bets/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  claimPayout(request: ClaimPayoutRequest) {
    return this.request<{ claimed: boolean; amount?: number }>('/api/bets/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  // Bet details endpoint
  getBetDetails(raceId: number, playerAddress: string) {
    return this.request<BetDetails>(`/api/races/${raceId}/bets/${playerAddress}`);
  }

  // Complete race info endpoint (similar to v1's pattern)
  getCompleteRaceInfo(raceId: number, playerAddress?: string) {
    const url = playerAddress 
      ? `/api/races/${raceId}/complete?player=${playerAddress}`
      : `/api/races/${raceId}/complete`;
    return this.request<{
      race: EnhancedRaceDetails;
      userBet?: BetDetails;
      odds?: number[];
    }>(url);
  }
}

export const apiService = new ApiService();
export const createApiService = () => new ApiService();

export default ApiService; 
