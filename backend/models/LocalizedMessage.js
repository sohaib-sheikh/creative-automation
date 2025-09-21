const dbManager = require('../database/database');

class LocalizedMessage {
  constructor(data) {
    this.id = data.id;
    this.campaignId = data.campaignId;
    this.originalMessage = data.originalMessage;
    this.translatedMessage = data.translatedMessage;
    this.targetLanguage = data.targetLanguage;
    this.languageCode = data.languageCode;
    this.additionalInstructions = data.additionalInstructions;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Create a new localized message
  static async create(localizedMessageData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    const localizedMessage = {
      id: localizedMessageData.id || `localized_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId: localizedMessageData.campaignId,
      originalMessage: localizedMessageData.originalMessage,
      translatedMessage: localizedMessageData.translatedMessage,
      targetLanguage: localizedMessageData.targetLanguage,
      languageCode: localizedMessageData.languageCode,
      additionalInstructions: localizedMessageData.additionalInstructions || null,
      createdAt: now,
      updatedAt: now
    };

    const stmt = db.prepare(`
      INSERT INTO localized_messages (id, campaignId, originalMessage, translatedMessage, targetLanguage, languageCode, additionalInstructions, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        localizedMessage.id,
        localizedMessage.campaignId,
        localizedMessage.originalMessage,
        localizedMessage.translatedMessage,
        localizedMessage.targetLanguage,
        localizedMessage.languageCode,
        localizedMessage.additionalInstructions,
        localizedMessage.createdAt,
        localizedMessage.updatedAt
      );

      return LocalizedMessage.findById(localizedMessage.id);
    } catch (error) {
      throw new Error(`Failed to create localized message: ${error.message}`);
    }
  }

  // Find localized message by ID
  static async findById(id) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM localized_messages WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return new LocalizedMessage(row);
  }

  // Find all localized messages for a campaign
  static async findByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM localized_messages WHERE campaignId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(campaignId);

    return rows.map(row => new LocalizedMessage(row));
  }

  // Find localized message by campaign ID and language code
  static async findByCampaignIdAndLanguage(campaignId, languageCode) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM localized_messages WHERE campaignId = ? AND languageCode = ?');
    const row = stmt.get(campaignId, languageCode);

    if (!row) {
      return null;
    }

    return new LocalizedMessage(row);
  }

  // Update localized message
  static async update(id, updateData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    const fields = [];
    const values = [];
    
    if (updateData.translatedMessage !== undefined) {
      fields.push('translatedMessage = ?');
      values.push(updateData.translatedMessage);
    }
    
    if (updateData.additionalInstructions !== undefined) {
      fields.push('additionalInstructions = ?');
      values.push(updateData.additionalInstructions);
    }
    
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    if (fields.length === 1) { // Only updatedAt
      throw new Error('No fields to update');
    }

    const stmt = db.prepare(`
      UPDATE localized_messages 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);

    try {
      const result = stmt.run(...values);
      
      if (result.changes === 0) {
        throw new Error('Localized message not found');
      }

      return LocalizedMessage.findById(id);
    } catch (error) {
      throw new Error(`Failed to update localized message: ${error.message}`);
    }
  }

  // Delete localized message
  static async delete(id) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM localized_messages WHERE id = ?');
    
    try {
      const result = stmt.run(id);
      
      if (result.changes === 0) {
        throw new Error('Localized message not found');
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to delete localized message: ${error.message}`);
    }
  }

  // Delete all localized messages for a campaign
  static async deleteByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM localized_messages WHERE campaignId = ?');
    
    try {
      const result = stmt.run(campaignId);
      return result.changes;
    } catch (error) {
      throw new Error(`Failed to delete localized messages for campaign: ${error.message}`);
    }
  }

  // Count localized messages for a campaign
  static async countByCampaignId(campaignId) {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM localized_messages WHERE campaignId = ?');
    const result = stmt.get(campaignId);
    return result.count;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      campaignId: this.campaignId,
      originalMessage: this.originalMessage,
      translatedMessage: this.translatedMessage,
      targetLanguage: this.targetLanguage,
      languageCode: this.languageCode,
      additionalInstructions: this.additionalInstructions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = LocalizedMessage;
