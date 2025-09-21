const dbManager = require('../database/database');

/**
 * StoredAsset Model for database operations
 * Represents assets stored in the database with Dropbox information
 */
class StoredAsset {
  constructor(data) {
    this.id = data.id;
    this.type = data.type; // 'uploaded' or 'generated'
    this.filename = data.filename;
    this.originalName = data.originalName;
    this.mimeType = data.mimeType;
    this.size = data.size;
    this.localUrl = data.localUrl;
    this.dropboxPath = data.dropboxPath;
    this.dropboxUrl = data.dropboxUrl;
    this.dropboxFileId = data.dropboxFileId;
    this.metadata = data.metadata || {};
    this.campaignId = data.campaignId;
    this.productId = data.productId;
    this.accountId = data.accountId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Create a new asset record in the database
   * @param {Object} assetData - Asset data to store
   * @returns {Promise<StoredAsset>} Created asset
   */
  static async create(assetData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    const asset = {
      id: assetData.id || `asset_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
      type: assetData.type,
      filename: assetData.filename,
      originalName: assetData.originalName,
      mimeType: assetData.mimeType,
      size: assetData.size,
      localUrl: assetData.localUrl || null,
      dropboxPath: assetData.dropboxPath,
      dropboxUrl: assetData.dropboxUrl,
      dropboxFileId: assetData.dropboxFileId || null,
      metadata: JSON.stringify(assetData.metadata || {}),
      campaignId: assetData.campaignId || null,
      productId: assetData.productId || null,
      accountId: assetData.accountId || null,
      createdAt: now,
      updatedAt: now
    };

    const stmt = db.prepare(`
      INSERT INTO assets (
        id, type, filename, originalName, mimeType, size, localUrl,
        dropboxPath, dropboxUrl, dropboxFileId, metadata, campaignId,
        productId, accountId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      asset.id, asset.type, asset.filename, asset.originalName,
      asset.mimeType, asset.size, asset.localUrl, asset.dropboxPath,
      asset.dropboxUrl, asset.dropboxFileId, asset.metadata,
      asset.campaignId, asset.productId, asset.accountId,
      asset.createdAt, asset.updatedAt
    );

    return new StoredAsset({
      ...asset,
      metadata: JSON.parse(asset.metadata)
    });
  }

  /**
   * Find asset by ID
   * @param {string} id - Asset ID
   * @returns {Promise<StoredAsset|null>} Found asset or null
   */
  static async findById(id) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM assets WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) {
      return null;
    }

    return new StoredAsset({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    });
  }

  /**
   * Find assets by type
   * @param {string} type - Asset type ('uploaded' or 'generated')
   * @param {Object} options - Query options
   * @returns {Promise<StoredAsset[]>} Array of assets
   */
  static async findByType(type, options = {}) {
    const db = dbManager.getDatabase();
    let query = 'SELECT * FROM assets WHERE type = ?';
    const params = [type];

    if (options.campaignId) {
      query += ' AND campaignId = ?';
      params.push(options.campaignId);
    }

    if (options.productId) {
      query += ' AND productId = ?';
      params.push(options.productId);
    }

    if (options.accountId) {
      query += ' AND accountId = ?';
      params.push(options.accountId);
    }

    query += ' ORDER BY createdAt DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => new StoredAsset({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Find assets by campaign ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<StoredAsset[]>} Array of assets
   */
  static async findByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM assets WHERE campaignId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(campaignId);

    return rows.map(row => new StoredAsset({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Find assets by product ID
   * @param {string} productId - Product ID
   * @returns {Promise<StoredAsset[]>} Array of assets
   */
  static async findByProductId(productId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM assets WHERE productId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(productId);

    return rows.map(row => new StoredAsset({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Find assets by Dropbox path
   * @param {string} dropboxPath - Dropbox path
   * @returns {Promise<StoredAsset|null>} Found asset or null
   */
  static async findByDropboxPath(dropboxPath) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM assets WHERE dropboxPath = ?');
    const row = stmt.get(dropboxPath);
    
    if (!row) {
      return null;
    }

    return new StoredAsset({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    });
  }

  /**
   * Get all assets with pagination
   * @param {Object} options - Query options
   * @returns {Promise<{assets: StoredAsset[], total: number}>} Assets and total count
   */
  static async findAll(options = {}) {
    const db = dbManager.getDatabase();
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Count total
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM assets');
    const { total } = countStmt.get();

    // Get assets
    const stmt = db.prepare('SELECT * FROM assets ORDER BY createdAt DESC LIMIT ? OFFSET ?');
    const rows = stmt.all(limit, offset);

    const assets = rows.map(row => new StoredAsset({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));

    return { assets, total };
  }

  /**
   * Update asset information
   * @param {Object} updateData - Data to update
   * @returns {Promise<StoredAsset>} Updated asset
   */
  async update(updateData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();

    const allowedFields = [
      'filename', 'originalName', 'mimeType', 'size', 'localUrl',
      'dropboxPath', 'dropboxUrl', 'dropboxFileId', 'metadata',
      'campaignId', 'productId', 'accountId'
    ];

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        if (key === 'metadata') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (updates.length === 0) {
      return this;
    }

    updates.push('updatedAt = ?');
    values.push(now, this.id);

    const stmt = db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    // Update local instance
    Object.assign(this, updateData);
    this.updatedAt = now;

    return this;
  }

  /**
   * Delete asset from database
   * @returns {Promise<boolean>} Success status
   */
  async delete() {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM assets WHERE id = ?');
    const result = stmt.run(this.id);
    return result.changes > 0;
  }

  /**
   * Convert to JSON for API responses
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      filename: this.filename,
      originalName: this.originalName,
      mimeType: this.mimeType,
      size: this.size,
      localUrl: this.localUrl,
      dropboxPath: this.dropboxPath,
      dropboxUrl: this.dropboxUrl,
      dropboxFileId: this.dropboxFileId,
      metadata: this.metadata,
      campaignId: this.campaignId,
      productId: this.productId,
      accountId: this.accountId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = StoredAsset;
