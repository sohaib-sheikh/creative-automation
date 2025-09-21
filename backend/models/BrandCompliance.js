const dbManager = require('../database/database');

class BrandCompliance {
  constructor(data) {
    this.id = data.id;
    this.campaignId = data.campaignId;
    this.productId = data.productId;
    this.creativeId = data.creativeId;
    this.creativeType = data.creativeType;
    this.imageUrl = data.imageUrl;
    this.usesBrandColors = data.usesBrandColors;
    this.brandColorUsage = data.brandColorUsage;
    this.conflictingColors = data.conflictingColors;
    this.complianceScore = data.complianceScore;
    this.analysis = data.analysis;
    this.overallCompliance = data.overallCompliance;
    this.analyzedAt = data.analyzedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Create a new brand compliance analysis
  static async create(complianceData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    // Ensure all data types are compatible with SQLite3
    const compliance = {
      id: complianceData.id || `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId: String(complianceData.campaignId || ''),
      productId: complianceData.productId ? String(complianceData.productId) : null,
      creativeId: String(complianceData.creativeId || ''),
      creativeType: String(complianceData.creativeType || 'unknown'),
      imageUrl: String(complianceData.imageUrl || ''),
      usesBrandColors: Boolean(complianceData.usesBrandColors) ? 1 : 0, // Convert boolean to integer
      brandColorUsage: complianceData.brandColorUsage ? String(complianceData.brandColorUsage) : null,
      conflictingColors: JSON.stringify(complianceData.conflictingColors || []),
      complianceScore: typeof complianceData.complianceScore === 'number' ? complianceData.complianceScore : 0,
      analysis: complianceData.analysis ? String(complianceData.analysis) : null,
      overallCompliance: JSON.stringify(complianceData.overallCompliance || {}),
      analyzedAt: complianceData.analyzedAt || now,
      createdAt: now,
      updatedAt: now
    };

    const stmt = db.prepare(`
      INSERT INTO brand_compliance_analyses (
        id, campaignId, productId, creativeId, creativeType, imageUrl,
        usesBrandColors, brandColorUsage, conflictingColors, complianceScore,
        analysis, overallCompliance, analyzedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      // Log the data being inserted for debugging
      console.log('Inserting compliance data:', {
        id: compliance.id,
        campaignId: compliance.campaignId,
        creativeId: compliance.creativeId,
        usesBrandColors: compliance.usesBrandColors,
        complianceScore: compliance.complianceScore,
        analysis: compliance.analysis ? compliance.analysis.substring(0, 100) + '...' : null
      });

      stmt.run(
        compliance.id,
        compliance.campaignId,
        compliance.productId,
        compliance.creativeId,
        compliance.creativeType,
        compliance.imageUrl,
        compliance.usesBrandColors,
        compliance.brandColorUsage,
        compliance.conflictingColors,
        compliance.complianceScore,
        compliance.analysis,
        compliance.overallCompliance,
        compliance.analyzedAt,
        compliance.createdAt,
        compliance.updatedAt
      );

      return BrandCompliance.findById(compliance.id);
    } catch (error) {
      console.error('Error details:', {
        error: error.message,
        complianceData: {
          id: compliance.id,
          campaignId: compliance.campaignId,
          creativeId: compliance.creativeId,
          usesBrandColors: compliance.usesBrandColors,
          complianceScore: compliance.complianceScore
        }
      });
      throw new Error(`Failed to create brand compliance analysis: ${error.message}`);
    }
  }

  // Find brand compliance analysis by ID
  static async findById(id) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM brand_compliance_analyses WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return new BrandCompliance({
      id: row.id,
      campaignId: row.campaignId,
      productId: row.productId,
      creativeId: row.creativeId,
      creativeType: row.creativeType,
      imageUrl: row.imageUrl,
      usesBrandColors: Boolean(row.usesBrandColors),
      brandColorUsage: row.brandColorUsage,
      conflictingColors: JSON.parse(row.conflictingColors || '[]'),
      complianceScore: row.complianceScore,
      analysis: row.analysis,
      overallCompliance: JSON.parse(row.overallCompliance || '{}'),
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  // Find all brand compliance analyses for a campaign
  static async findByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM brand_compliance_analyses 
      WHERE campaignId = ? 
      ORDER BY analyzedAt DESC
    `);
    const rows = stmt.all(campaignId);

    return rows.map(row => new BrandCompliance({
      id: row.id,
      campaignId: row.campaignId,
      productId: row.productId,
      creativeId: row.creativeId,
      creativeType: row.creativeType,
      imageUrl: row.imageUrl,
      usesBrandColors: Boolean(row.usesBrandColors),
      brandColorUsage: row.brandColorUsage,
      conflictingColors: JSON.parse(row.conflictingColors || '[]'),
      complianceScore: row.complianceScore,
      analysis: row.analysis,
      overallCompliance: JSON.parse(row.overallCompliance || '{}'),
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  // Find brand compliance analysis by creative ID
  static async findByCreativeId(creativeId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM brand_compliance_analyses 
      WHERE creativeId = ? 
      ORDER BY analyzedAt DESC 
      LIMIT 1
    `);
    const row = stmt.get(creativeId);

    if (!row) {
      return null;
    }

    return new BrandCompliance({
      id: row.id,
      campaignId: row.campaignId,
      productId: row.productId,
      creativeId: row.creativeId,
      creativeType: row.creativeType,
      imageUrl: row.imageUrl,
      usesBrandColors: Boolean(row.usesBrandColors),
      brandColorUsage: row.brandColorUsage,
      conflictingColors: JSON.parse(row.conflictingColors || '[]'),
      complianceScore: row.complianceScore,
      analysis: row.analysis,
      overallCompliance: JSON.parse(row.overallCompliance || '{}'),
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  // Delete all brand compliance analyses for a campaign
  static async deleteByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM brand_compliance_analyses WHERE campaignId = ?');
    
    try {
      const result = stmt.run(campaignId);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete brand compliance analyses: ${error.message}`);
    }
  }

  // Delete brand compliance analysis by ID
  async delete() {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM brand_compliance_analyses WHERE id = ?');

    try {
      const result = stmt.run(this.id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete brand compliance analysis: ${error.message}`);
    }
  }

  // Get latest brand compliance analysis for a campaign
  static async getLatestByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM brand_compliance_analyses 
      WHERE campaignId = ? 
      ORDER BY analyzedAt DESC 
      LIMIT 1
    `);
    const row = stmt.get(campaignId);

    if (!row) {
      return null;
    }

    return new BrandCompliance({
      id: row.id,
      campaignId: row.campaignId,
      productId: row.productId,
      creativeId: row.creativeId,
      creativeType: row.creativeType,
      imageUrl: row.imageUrl,
      usesBrandColors: Boolean(row.usesBrandColors),
      brandColorUsage: row.brandColorUsage,
      conflictingColors: JSON.parse(row.conflictingColors || '[]'),
      complianceScore: row.complianceScore,
      analysis: row.analysis,
      overallCompliance: JSON.parse(row.overallCompliance || '{}'),
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      campaignId: this.campaignId,
      productId: this.productId,
      creativeId: this.creativeId,
      creativeType: this.creativeType,
      imageUrl: this.imageUrl,
      usesBrandColors: this.usesBrandColors,
      brandColorUsage: this.brandColorUsage,
      conflictingColors: this.conflictingColors,
      complianceScore: this.complianceScore,
      analysis: this.analysis,
      overallCompliance: this.overallCompliance,
      analyzedAt: this.analyzedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = BrandCompliance;
