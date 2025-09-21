const dbManager = require('../database/database');

class Campaign {
  constructor(data) {
    this.id = data.id;
    this.brief = data.brief;
    this.assets = data.assets || [];
    this.generatedCreatives = data.generatedCreatives || [];
    this.status = data.status || 'draft';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Create a new campaign
  static async create(campaignData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    const campaign = {
      id: campaignData.id || `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      brief: JSON.stringify(campaignData.brief),
      assets: JSON.stringify(campaignData.assets || []),
      generatedCreatives: JSON.stringify(campaignData.generatedCreatives || []),
      status: campaignData.status || 'draft',
      createdAt: now,
      updatedAt: now
    };

    const stmt = db.prepare(`
      INSERT INTO campaigns (id, brief, assets, generatedCreatives, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        campaign.id,
        campaign.brief,
        campaign.assets,
        campaign.generatedCreatives,
        campaign.status,
        campaign.createdAt,
        campaign.updatedAt
      );

      return Campaign.findById(campaign.id);
    } catch (error) {
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  // Find campaign by ID
  static async findById(id) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return new Campaign({
      id: row.id,
      brief: JSON.parse(row.brief),
      assets: JSON.parse(row.assets),
      generatedCreatives: JSON.parse(row.generatedCreatives),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  // Get all campaigns
  static async findAll(options = {}) {
    const db = dbManager.getDatabase();
    let query = 'SELECT * FROM campaigns';
    let params = [];

    // Add filtering
    if (options.status) {
      query += ' WHERE status = ?';
      params.push(options.status);
    }

    // Add ordering
    query += ' ORDER BY createdAt DESC';

    // Add pagination
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => new Campaign({
      id: row.id,
      brief: JSON.parse(row.brief),
      assets: JSON.parse(row.assets),
      generatedCreatives: JSON.parse(row.generatedCreatives),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  // Update campaign
  async update(updates) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();

    // Merge updates with existing data
    const updatedData = {
      brief: updates.brief !== undefined ? updates.brief : this.brief,
      assets: updates.assets !== undefined ? updates.assets : this.assets,
      generatedCreatives: updates.generatedCreatives !== undefined ? updates.generatedCreatives : this.generatedCreatives,
      status: updates.status !== undefined ? updates.status : this.status,
      updatedAt: now
    };

    const stmt = db.prepare(`
      UPDATE campaigns 
      SET brief = ?, assets = ?, generatedCreatives = ?, status = ?, updatedAt = ?
      WHERE id = ?
    `);

    try {
      stmt.run(
        JSON.stringify(updatedData.brief),
        JSON.stringify(updatedData.assets),
        JSON.stringify(updatedData.generatedCreatives),
        updatedData.status,
        updatedData.updatedAt,
        this.id
      );

      // Update local instance
      Object.assign(this, updatedData);
      return this;
    } catch (error) {
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  }

  // Delete campaign
  async delete() {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');

    try {
      stmt.run(this.id);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete campaign: ${error.message}`);
    }
  }

  // Search campaigns by name or content
  static async search(query) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM campaigns 
      WHERE brief LIKE ? OR assets LIKE ? OR generatedCreatives LIKE ?
      ORDER BY createdAt DESC
    `);

    const searchTerm = `%${query}%`;
    const rows = stmt.all(searchTerm, searchTerm, searchTerm);

    return rows.map(row => new Campaign({
      id: row.id,
      brief: JSON.parse(row.brief),
      assets: JSON.parse(row.assets),
      generatedCreatives: JSON.parse(row.generatedCreatives),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  // Get campaigns by status
  static async findByStatus(status) {
    return Campaign.findAll({ status });
  }

  // Get campaign count
  static async count(options = {}) {
    const db = dbManager.getDatabase();
    let query = 'SELECT COUNT(*) as count FROM campaigns';
    let params = [];

    if (options.status) {
      query += ' WHERE status = ?';
      params.push(options.status);
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params);
    return result.count;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      brief: this.brief,
      assets: this.assets,
      generatedCreatives: this.generatedCreatives,
      status: this.status,
      stats: this.stats,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Campaign;
