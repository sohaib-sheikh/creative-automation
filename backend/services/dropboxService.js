const { Dropbox } = require('dropbox');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Dropbox Service for handling file operations
 */
class DropboxService {
  constructor() {
    if (!process.env.DROPBOX_CLIENT_ID || !process.env.DROPBOX_CLIENT_SECRET) {
      console.warn('Dropbox OAuth credentials not configured. Dropbox functionality will be disabled.');
      console.warn('Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file');
      this.dropbox = null;
      this.clientId = null;
      this.clientSecret = null;
      return;
    }

    this.clientId = process.env.DROPBOX_CLIENT_ID;
    this.clientSecret = process.env.DROPBOX_CLIENT_SECRET;
    this.basePath = process.env.DROPBOX_BASE_PATH || '/campaign-assets';
    this.dropbox = null; // Will be initialized with access token when needed
  }

  /**
   * Check if Dropbox is configured and available
   */
  isAvailable() {
    return this.clientId !== null && this.clientSecret !== null;
  }

  /**
   * Initialize Dropbox client with access token
   * @param {string} accessToken - OAuth access token
   */
  initializeWithToken(accessToken) {
    this.dropbox = new Dropbox({
      accessToken: accessToken,
      clientId: this.clientId
    });
  }

  /**
   * Get OAuth authorization URL with proper scopes
   * @param {string} redirectUri - Redirect URI for OAuth callback
   * @returns {string} Authorization URL
   */
  getAuthUrl(redirectUri) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    const scopes = [
      'files.metadata.write',
      'files.content.write',
      'files.metadata.read',
      'files.content.read',
      'sharing.write'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      token_access_type: 'offline'  // Required to get refresh token
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} redirectUri - Redirect URI used in authorization
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code, redirectUri) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    try {
      const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
        code: code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (response.data.expires_in * 1000)).toISOString();

      return {
        success: true,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        expires_at: expiresAt,
        scope: response.data.scope
      };
    } catch (error) {
      console.error('Token exchange error:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} Refreshed token response
   */
  async refreshAccessToken(refreshToken) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (response.data.expires_in * 1000)).toISOString();

      return {
        success: true,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep the old one
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        expires_at: expiresAt,
        scope: response.data.scope
      };
    } catch (error) {
      console.error('Token refresh error:', error.response?.data || error.message);
      throw new Error(`Failed to refresh access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Check if access token is expired or will expire soon
   * @param {string} expiresAt - Token expiration time (ISO string)
   * @param {number} bufferMinutes - Buffer time in minutes before expiration (default: 5)
   * @returns {boolean} True if token is expired or will expire soon
   */
  isTokenExpired(expiresAt, bufferMinutes = 5) {
    if (!expiresAt) {
      return true; // If no expiration time, consider it expired
    }

    const expirationTime = new Date(expiresAt);
    const bufferTime = new Date(Date.now() + (bufferMinutes * 60 * 1000));
    
    return expirationTime <= bufferTime;
  }

  /**
   * Create organized folder path based on product and aspect ratio
   * @param {Object} metadata - Metadata containing product and aspect ratio information
   * @returns {string} Organized folder path
   */
  createOrganizedFolderPath(metadata = {}) {
    // Check if this is a creative (should use organized structure) or an asset (should use uploads)
    const isCreative = metadata.creativeType || metadata.type === 'creative' || 
                      (metadata.prompt && (metadata.prompt.includes('creative') || metadata.prompt.includes('social')));
    
    // If it's an asset (not a creative), use the uploads folder
    if (!isCreative) {
      return 'uploads';
    }
    
    // Extract product information for creatives
    const productName = metadata.productName || metadata.productId || 'Unknown Product';
    const aspectRatio = metadata.aspectRatio || 'Unknown';
    
    // Clean product name for folder naming (remove special characters, spaces)
    const cleanProductName = productName
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-+/g, '_') // Replace multiple hyphens with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single underscore
      .toLowerCase();
    
    // Clean aspect ratio for folder naming
    const cleanAspectRatio = aspectRatio
      .replace(/[^a-zA-Z0-9:]/g, '') // Keep only alphanumeric and colon
      .replace(/:/g, 'x'); // Replace colon with x (e.g., 1:1 -> 1x1)
    
    // Create organized folder structure for creatives: /products/{product_name}/{aspect_ratio}/
    const folderPath = path.posix.join('products', cleanProductName, cleanAspectRatio);
    
    return folderPath;
  }

  /**
   * Ensure access token is valid, refresh if necessary
   * @param {Object} account - Account object with token information
   * @returns {Promise<Object>} Updated account with valid access token
   */
  async ensureValidToken(account) {
    if (!account || !account.dropboxAccessToken) {
      throw new Error('No access token available');
    }

    // Check if token is expired or will expire soon
    if (this.isTokenExpired(account.dropboxTokenExpiresAt)) {
      console.log('🔄 Dropbox access token expired or expiring soon, refreshing...');
      
      if (!account.dropboxRefreshToken) {
        throw new Error('Access token expired and no refresh token available. Please re-authenticate.');
      }

      try {
        // Refresh the token
        const refreshResult = await this.refreshAccessToken(account.dropboxRefreshToken);
        
        // Update account with new token information
        const Account = require('../models/Account');
        const updatedAccount = await account.update({
          dropboxAccessToken: refreshResult.access_token,
          dropboxRefreshToken: refreshResult.refresh_token,
          dropboxTokenExpiresAt: refreshResult.expires_at
        });

        console.log('✅ Dropbox access token refreshed successfully');
        return updatedAccount;
      } catch (error) {
        console.error('❌ Failed to refresh Dropbox access token:', error.message);
        throw new Error(`Token refresh failed: ${error.message}`);
      }
    }

    // Token is still valid
    return account;
  }

  /**
   * Upload a file to Dropbox
   * @param {string} accessToken - OAuth access token
   * @param {string} localFilePath - Path to the local file
   * @param {string} dropboxPath - Path in Dropbox (relative to basePath)
   * @param {Object} metadata - Additional metadata for the file
   * @returns {Promise<Object>} Upload result with Dropbox path and URL
   */
  async uploadFile(accessToken, localFilePath, dropboxPath, metadata = {}) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    // Initialize Dropbox client with the provided access token
    this.initializeWithToken(accessToken);

    try {
      // Read file content
      const fileContent = fs.readFileSync(localFilePath);
      
      // Create full Dropbox path
      const fullDropboxPath = path.posix.join(this.basePath, dropboxPath);
      
      // Upload file to Dropbox with proper scopes
      const response = await this.dropbox.filesUpload({
        path: fullDropboxPath,
        contents: fileContent,
        mode: 'overwrite',
        autorename: true,
        mute: false
      });

      // Create shared link
      const sharedLinkResponse = await this.dropbox.sharingCreateSharedLinkWithSettings({
        path: fullDropboxPath,
        settings: {
          requested_visibility: 'public'
        }
      });

      return {
        success: true,
        dropboxPath: fullDropboxPath,
        dropboxUrl: sharedLinkResponse.result.url,
        fileId: response.result.id,
        size: response.result.size,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dropbox upload error:', error);
      throw new Error(`Failed to upload to Dropbox: ${error.message}`);
    }
  }

  /**
   * Upload file content directly (for generated images)
   * @param {string} accessToken - OAuth access token
   * @param {Buffer} fileContent - File content as Buffer
   * @param {string} filename - Name of the file
   * @param {string} mimeType - MIME type of the file
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadFileContent(accessToken, fileContent, filename, mimeType, metadata = {}) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    // Initialize Dropbox client with the provided access token
    this.initializeWithToken(accessToken);

    try {
      // Create organized folder structure based on product and aspect ratio
      const folderPath = this.createOrganizedFolderPath(metadata);
      
      // Create Dropbox path with timestamp to avoid conflicts
      const timestamp = Date.now();
      const ext = path.extname(filename) || '.png';
      const nameWithoutExt = path.basename(filename, ext);
      const dropboxFilename = `${nameWithoutExt}_${timestamp}${ext}`;
      const fullDropboxPath = path.posix.join(this.basePath, folderPath, dropboxFilename);

      // Upload file content to Dropbox with proper scopes
      const response = await this.dropbox.filesUpload({
        path: fullDropboxPath,
        contents: fileContent,
        mode: 'overwrite',
        autorename: true,
        mute: false
      });

      // Create shared link
      const sharedLinkResponse = await this.dropbox.sharingCreateSharedLinkWithSettings({
        path: fullDropboxPath,
        settings: {
          requested_visibility: 'public'
        }
      });

      return {
        success: true,
        dropboxPath: fullDropboxPath,
        dropboxUrl: sharedLinkResponse.result.url,
        filename: dropboxFilename,
        fileId: response.result.id,
        size: response.result.size,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dropbox upload error:', error);
      throw new Error(`Failed to upload to Dropbox: ${error.message}`);
    }
  }

  /**
   * Delete a file from Dropbox
   * @param {string} accessToken - OAuth access token
   * @param {string} dropboxPath - Path in Dropbox
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(accessToken, dropboxPath) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    // Initialize Dropbox client with the provided access token
    this.initializeWithToken(accessToken);

    try {
      const response = await this.dropbox.filesDeleteV2({
        path: dropboxPath
      });

      return {
        success: true,
        deletedPath: dropboxPath,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dropbox delete error:', error);
      throw new Error(`Failed to delete from Dropbox: ${error.message}`);
    }
  }

  /**
   * Get file metadata from Dropbox
   * @param {string} accessToken - OAuth access token
   * @param {string} dropboxPath - Path in Dropbox
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(accessToken, dropboxPath) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    // Initialize Dropbox client with the provided access token
    this.initializeWithToken(accessToken);

    try {
      const response = await this.dropbox.filesGetMetadata({
        path: dropboxPath
      });

      return {
        success: true,
        metadata: response.result,
        retrievedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dropbox metadata error:', error);
      throw new Error(`Failed to get metadata from Dropbox: ${error.message}`);
    }
  }

  /**
   * List files in a Dropbox folder
   * @param {string} accessToken - OAuth access token
   * @param {string} folderPath - Path to folder (relative to basePath)
   * @returns {Promise<Object>} List of files
   */
  async listFiles(accessToken, folderPath = '') {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    // Initialize Dropbox client with the provided access token
    this.initializeWithToken(accessToken);

    try {
      const fullPath = path.posix.join(this.basePath, folderPath);
      
      const response = await this.dropbox.filesListFolder({
        path: fullPath,
        recursive: false
      });

      console.log('Dropbox list response:', response);

      return {
        success: true,
        files: response.result.entries,
        path: fullPath,
        retrievedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dropbox list error:', error);
      throw new Error(`Failed to list files from Dropbox: ${error.message}`);
    }
  }

  /**
   * Get shared link metadata for a file
   * @param {string} accessToken - OAuth access token
   * @param {string} dropboxPath - Path in Dropbox
   * @returns {Promise<Object>} Shared link metadata
   */
  async getSharedLinkMetadata(accessToken, dropboxPath) {
    if (!this.isAvailable()) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    // Initialize Dropbox client with the provided access token
    this.initializeWithToken(accessToken);

    try {
      const response = await this.dropbox.sharingGetFileMetadata({
        file: dropboxPath
      });

      return {
        success: true,
        metadata: response.result,
        retrievedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dropbox shared link metadata error:', error);
      throw new Error(`Failed to get shared link metadata from Dropbox: ${error.message}`);
    }
  }
}

module.exports = DropboxService;
