const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'campaigns.db');
    this.init();
  }

  init() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      this.createTables();
      console.log('✅ SQLite database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  createTables() {
    // Create campaigns table
    const createCampaignsTable = `
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        brief TEXT NOT NULL, -- JSON string of CampaignBrief
        assets TEXT NOT NULL, -- JSON string of Asset[]
        generatedCreatives TEXT NOT NULL, -- JSON string of GeneratedCreative[]
        status TEXT NOT NULL CHECK (status IN ('draft', 'generated', 'published')),
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `;

    // Create accounts table
    const createAccountsTable = `
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        dropboxAccessToken TEXT,
        dropboxRefreshToken TEXT,
        dropboxTokenExpiresAt TEXT,
        brandLogo TEXT,
        brandColors TEXT NOT NULL DEFAULT '{}', -- JSON string of brand colors
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `;

    // Create localized messages table
    const createLocalizedMessagesTable = `
      CREATE TABLE IF NOT EXISTS localized_messages (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        originalMessage TEXT NOT NULL,
        translatedMessage TEXT NOT NULL,
        targetLanguage TEXT NOT NULL,
        languageCode TEXT NOT NULL,
        additionalInstructions TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (campaignId) REFERENCES campaigns (id) ON DELETE CASCADE
      )
    `;

    // Create brand compliance analysis table
    const createBrandComplianceTable = `
      CREATE TABLE IF NOT EXISTS brand_compliance_analyses (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        productId TEXT,
        creativeId TEXT NOT NULL,
        creativeType TEXT NOT NULL,
        imageUrl TEXT NOT NULL,
        usesBrandColors BOOLEAN NOT NULL,
        brandColorUsage TEXT NOT NULL,
        conflictingColors TEXT NOT NULL,
        complianceScore INTEGER NOT NULL,
        analysis TEXT NOT NULL,
        overallCompliance TEXT NOT NULL,
        analyzedAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (campaignId) REFERENCES campaigns (id) ON DELETE CASCADE
      )
    `;

    // Create legal content review table
    const createLegalContentReviewTable = `
      CREATE TABLE IF NOT EXISTS legal_content_reviews (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        messageContent TEXT NOT NULL,
        targetAudience TEXT NOT NULL,
        targetMarket TEXT NOT NULL,
        language TEXT NOT NULL,
        languageCode TEXT NOT NULL,
        isOriginalMessage BOOLEAN NOT NULL,
        isAppropriate BOOLEAN NOT NULL,
        prohibitedWords TEXT NOT NULL,
        riskLevel TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        analysis TEXT NOT NULL,
        analyzedAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (campaignId) REFERENCES campaigns (id) ON DELETE CASCADE
      )
    `;

    // Create assets table for storing uploaded and generated assets
    const createAssetsTable = `
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('uploaded', 'generated')),
        filename TEXT NOT NULL,
        originalName TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        size INTEGER NOT NULL,
        localUrl TEXT,
        dropboxPath TEXT NOT NULL,
        dropboxUrl TEXT NOT NULL,
        dropboxFileId TEXT,
        metadata TEXT NOT NULL DEFAULT '{}', -- JSON string of additional metadata
        campaignId TEXT,
        productId TEXT,
        accountId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (campaignId) REFERENCES campaigns (id) ON DELETE SET NULL,
        FOREIGN KEY (accountId) REFERENCES accounts (id) ON DELETE SET NULL
      )
    `;

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
      'CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(createdAt)',
      'CREATE INDEX IF NOT EXISTS idx_campaigns_updated_at ON campaigns(updatedAt)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(createdAt)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts(updatedAt)',
      'CREATE INDEX IF NOT EXISTS idx_localized_messages_campaign_id ON localized_messages(campaignId)',
      'CREATE INDEX IF NOT EXISTS idx_localized_messages_language_code ON localized_messages(languageCode)',
      'CREATE INDEX IF NOT EXISTS idx_localized_messages_created_at ON localized_messages(createdAt)',
      'CREATE INDEX IF NOT EXISTS idx_brand_compliance_campaign_id ON brand_compliance_analyses(campaignId)',
      'CREATE INDEX IF NOT EXISTS idx_brand_compliance_product_id ON brand_compliance_analyses(productId)',
      'CREATE INDEX IF NOT EXISTS idx_brand_compliance_creative_id ON brand_compliance_analyses(creativeId)',
      'CREATE INDEX IF NOT EXISTS idx_brand_compliance_analyzed_at ON brand_compliance_analyses(analyzedAt)',
      'CREATE INDEX IF NOT EXISTS idx_legal_content_review_campaign_id ON legal_content_reviews(campaignId)',
      'CREATE INDEX IF NOT EXISTS idx_legal_content_review_analyzed_at ON legal_content_reviews(analyzedAt)',
      'CREATE INDEX IF NOT EXISTS idx_legal_content_review_risk_level ON legal_content_reviews(riskLevel)',
      'CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type)',
      'CREATE INDEX IF NOT EXISTS idx_assets_campaign_id ON assets(campaignId)',
      'CREATE INDEX IF NOT EXISTS idx_assets_product_id ON assets(productId)',
      'CREATE INDEX IF NOT EXISTS idx_assets_account_id ON assets(accountId)',
      'CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(createdAt)',
      'CREATE INDEX IF NOT EXISTS idx_assets_dropbox_path ON assets(dropboxPath)'
    ];

    this.db.exec(createCampaignsTable);
    this.db.exec(createAccountsTable);
    this.db.exec(createLocalizedMessagesTable);
    this.db.exec(createBrandComplianceTable);
    this.db.exec(createLegalContentReviewTable);
    this.db.exec(createAssetsTable);
    createIndexes.forEach(index => this.db.exec(index));
    
    // Migration: Remove stats column if it exists (for existing databases)
    this.migrateRemoveStatsColumn();
    
    // Migration: Add new Dropbox token columns to accounts table
    this.migrateAddDropboxTokenColumns();
    
    // Migration: Add new columns to legal content reviews table
    this.migrateAddLegalContentReviewColumns();
  }

  migrateRemoveStatsColumn() {
    try {
      // Check if stats column exists
      const tableInfo = this.db.prepare("PRAGMA table_info(campaigns)").all();
      const hasStatsColumn = tableInfo.some(column => column.name === 'stats');
      
      if (hasStatsColumn) {
        console.log('🔄 Migrating database: Removing stats column...');
        
        // Create new table without stats column
        this.db.exec(`
          CREATE TABLE campaigns_new (
            id TEXT PRIMARY KEY,
            brief TEXT NOT NULL,
            assets TEXT NOT NULL,
            generatedCreatives TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('draft', 'generated', 'published')),
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          )
        `);
        
        // Copy data from old table to new table (excluding stats)
        this.db.exec(`
          INSERT INTO campaigns_new (id, brief, assets, generatedCreatives, status, createdAt, updatedAt)
          SELECT id, brief, assets, generatedCreatives, status, createdAt, updatedAt
          FROM campaigns
        `);
        
        // Drop old table and rename new table
        this.db.exec('DROP TABLE campaigns');
        this.db.exec('ALTER TABLE campaigns_new RENAME TO campaigns');
        
        // Recreate indexes
        const createIndexes = [
          'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
          'CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(createdAt)',
          'CREATE INDEX IF NOT EXISTS idx_campaigns_updated_at ON campaigns(updatedAt)'
        ];
        createIndexes.forEach(index => this.db.exec(index));
        
        console.log('✅ Database migration completed: stats column removed');
      }
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      // Don't throw error to prevent app from crashing
    }
  }

  migrateAddDropboxTokenColumns() {
    try {
      // Check if new columns exist in accounts table
      const tableInfo = this.db.prepare("PRAGMA table_info(accounts)").all();
      const hasRefreshToken = tableInfo.some(column => column.name === 'dropboxRefreshToken');
      const hasTokenExpiresAt = tableInfo.some(column => column.name === 'dropboxTokenExpiresAt');
      
      if (!hasRefreshToken || !hasTokenExpiresAt) {
        console.log('🔄 Migrating database: Adding Dropbox token columns...');
        
        if (!hasRefreshToken) {
          this.db.exec('ALTER TABLE accounts ADD COLUMN dropboxRefreshToken TEXT');
        }
        
        if (!hasTokenExpiresAt) {
          this.db.exec('ALTER TABLE accounts ADD COLUMN dropboxTokenExpiresAt TEXT');
        }
        
        console.log('✅ Database migration completed: Dropbox token columns added');
      }
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      // Don't throw error to prevent app from crashing
    }
  }

  migrateAddLegalContentReviewColumns() {
    try {
      // Check if legal_content_reviews table exists and if new columns exist
      const tableInfo = this.db.prepare("PRAGMA table_info(legal_content_reviews)").all();
      
      if (tableInfo.length > 0) {
        const hasLanguageCode = tableInfo.some(column => column.name === 'languageCode');
        const hasIsOriginalMessage = tableInfo.some(column => column.name === 'isOriginalMessage');
        
        if (!hasLanguageCode || !hasIsOriginalMessage) {
          console.log('🔄 Migrating database: Adding legal content review columns...');
          
          if (!hasLanguageCode) {
            this.db.exec('ALTER TABLE legal_content_reviews ADD COLUMN languageCode TEXT NOT NULL DEFAULT "en"');
          }
          
          if (!hasIsOriginalMessage) {
            this.db.exec('ALTER TABLE legal_content_reviews ADD COLUMN isOriginalMessage BOOLEAN NOT NULL DEFAULT 1');
          }
          
          console.log('✅ Database migration completed: Legal content review columns added');
        }
      }
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      // Don't throw error to prevent app from crashing
    }
  }

  getDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;
