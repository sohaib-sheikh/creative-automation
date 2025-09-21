/**
 * Dropbox service for handling token management and API calls
 */

export interface DropboxTokenInfo {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
}

export class DropboxService {
  private static instance: DropboxService;
  private tokenCache: DropboxTokenInfo | null = null;
  private tokenExpiry: Date | null = null;

  private constructor() {}

  static getInstance(): DropboxService {
    if (!DropboxService.instance) {
      DropboxService.instance = new DropboxService();
    }
    return DropboxService.instance;
  }

  /**
   * Get a valid Dropbox access token, refreshing if necessary
   */
  async getValidToken(): Promise<string | null> {
    try {
      // First try to get token from localStorage (for backward compatibility)
      const localToken = localStorage.getItem('dropbox_access_token');
      if (localToken) {
        return localToken;
      }

      // If no local token, get from account settings
      const response = await fetch('/api/account');
      if (response.ok) {
        const account = await response.json();
        if (account?.dropboxAccessToken) {
          // Store in localStorage for backward compatibility
          localStorage.setItem('dropbox_access_token', account.dropboxAccessToken);
          return account.dropboxAccessToken;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting Dropbox token:', error);
      return null;
    }
  }

  /**
   * Check if the current token is expired or will expire soon
   */
  isTokenExpired(expiresAt: string | null, bufferMinutes = 5): boolean {
    if (!expiresAt) return true;
    const expirationTime = new Date(expiresAt);
    const bufferTime = new Date(Date.now() + (bufferMinutes * 60 * 1000));
    return expirationTime <= bufferTime;
  }

  /**
   * Refresh the Dropbox token
   */
  async refreshToken(): Promise<DropboxTokenInfo | null> {
    try {
      const response = await fetch('/api/dropbox/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update localStorage for backward compatibility
        localStorage.setItem('dropbox_access_token', result.access_token);
        
        return {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          expires_at: result.expires_at
        };
      }

      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    localStorage.removeItem('dropbox_access_token');
    this.tokenCache = null;
    this.tokenExpiry = null;
  }

  /**
   * Check if Dropbox is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidToken();
    return !!token;
  }
}

// Export singleton instance
export const dropboxService = DropboxService.getInstance();
