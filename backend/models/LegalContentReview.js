const dbManager = require('../database/database');

class LegalContentReview {
  constructor(data) {
    this.id = data.id;
    this.campaignId = data.campaignId;
    this.messageContent = data.messageContent;
    this.targetAudience = data.targetAudience;
    this.targetMarket = data.targetMarket;
    this.language = data.language;
    this.languageCode = data.languageCode;
    this.isOriginalMessage = data.isOriginalMessage;
    this.isAppropriate = data.isAppropriate;
    this.prohibitedWords = data.prohibitedWords;
    this.riskLevel = data.riskLevel;
    this.recommendations = data.recommendations;
    this.analysis = data.analysis;
    this.analyzedAt = data.analyzedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Create a new legal content review
  static async create(reviewData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    const review = {
      id: reviewData.id || `legal_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId: String(reviewData.campaignId || ''),
      messageContent: String(reviewData.messageContent || ''),
      targetAudience: String(reviewData.targetAudience || ''),
      targetMarket: String(reviewData.targetMarket || ''),
      language: String(reviewData.language || ''),
      languageCode: String(reviewData.languageCode || ''),
      isOriginalMessage: Boolean(reviewData.isOriginalMessage) ? 1 : 0,
      isAppropriate: Boolean(reviewData.isAppropriate) ? 1 : 0,
      prohibitedWords: JSON.stringify(reviewData.prohibitedWords || []),
      riskLevel: String(reviewData.riskLevel || 'unknown'),
      recommendations: String(reviewData.recommendations || ''),
      analysis: String(reviewData.analysis || ''),
      analyzedAt: reviewData.analyzedAt || now,
      createdAt: now,
      updatedAt: now
    };

    const stmt = db.prepare(`
      INSERT INTO legal_content_reviews (
        id, campaignId, messageContent, targetAudience, targetMarket, language, languageCode,
        isOriginalMessage, isAppropriate, prohibitedWords, riskLevel, recommendations, analysis,
        analyzedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(
        review.id, review.campaignId, review.messageContent, review.targetAudience,
        review.targetMarket, review.language, review.languageCode, review.isOriginalMessage,
        review.isAppropriate, review.prohibitedWords, review.riskLevel, review.recommendations, 
        review.analysis, review.analyzedAt, review.createdAt, review.updatedAt
      );
      
      console.log('Legal content review created:', result);
      return new LegalContentReview(review);
    } catch (error) {
      console.error('Error creating legal content review:', error);
      throw error;
    }
  }

  // Find legal content review by campaign ID
  static async findByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    
    try {
      const stmt = db.prepare(`
        SELECT * FROM legal_content_reviews 
        WHERE campaignId = ? 
        ORDER BY analyzedAt DESC
      `);
      
      const rows = stmt.all(campaignId);
      
      return rows.map(row => ({
        ...row,
        isOriginalMessage: Boolean(row.isOriginalMessage),
        isAppropriate: Boolean(row.isAppropriate),
        prohibitedWords: JSON.parse(row.prohibitedWords || '[]')
      }));
    } catch (error) {
      console.error('Error finding legal content review by campaign ID:', error);
      throw error;
    }
  }

  // Delete legal content reviews by campaign ID
  static async deleteByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    
    try {
      const stmt = db.prepare(`
        DELETE FROM legal_content_reviews 
        WHERE campaignId = ?
      `);
      
      const result = stmt.run(campaignId);
      console.log(`Deleted ${result.changes} legal content reviews for campaign ${campaignId}`);
      return result;
    } catch (error) {
      console.error('Error deleting legal content reviews by campaign ID:', error);
      throw error;
    }
  }

  // Find by ID
  static async findById(id) {
    const db = dbManager.getDatabase();
    
    try {
      const stmt = db.prepare(`
        SELECT * FROM legal_content_reviews 
        WHERE id = ?
      `);
      
      const row = stmt.get(id);
      
      if (!row) {
        return null;
      }
      
      return {
        ...row,
        isOriginalMessage: Boolean(row.isOriginalMessage),
        isAppropriate: Boolean(row.isAppropriate),
        prohibitedWords: JSON.parse(row.prohibitedWords || '[]')
      };
    } catch (error) {
      console.error('Error finding legal content review by ID:', error);
      throw error;
    }
  }
}

module.exports = LegalContentReview;
