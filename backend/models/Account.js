const dbManager = require('../database/database');

class Account {
  constructor(data) {
    this.id = data.id;
    this.dropboxAccessToken = data.dropboxAccessToken;
    this.dropboxRefreshToken = data.dropboxRefreshToken;
    this.dropboxTokenExpiresAt = data.dropboxTokenExpiresAt;
    this.brandLogo = data.brandLogo;
    this.brandColors = data.brandColors;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Create or update account settings (singleton pattern)
  static async upsert(accountData) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();
    
    // Check if account already exists
    const existingAccount = await Account.find();
    
    if (existingAccount) {
      // Update existing account
      return existingAccount.update(accountData);
    } else {
      // Create new account
      const account = {
        id: 'default_account',
        dropboxAccessToken: accountData.dropboxAccessToken || null,
        dropboxRefreshToken: accountData.dropboxRefreshToken || null,
        dropboxTokenExpiresAt: accountData.dropboxTokenExpiresAt || null,
        brandLogo: accountData.brandLogo || null,
        brandColors: JSON.stringify(accountData.brandColors || {}),
        createdAt: now,
        updatedAt: now
      };

      const stmt = db.prepare(`
        INSERT INTO accounts (id, dropboxAccessToken, dropboxRefreshToken, dropboxTokenExpiresAt, brandLogo, brandColors, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        stmt.run(
          account.id,
          account.dropboxAccessToken,
          account.dropboxRefreshToken,
          account.dropboxTokenExpiresAt,
          account.brandLogo,
          account.brandColors,
          account.createdAt,
          account.updatedAt
        );

        return Account.find();
      } catch (error) {
        throw new Error(`Failed to create account: ${error.message}`);
      }
    }
  }

  // Find account (singleton - there should only be one)
  static async find() {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM accounts LIMIT 1');
    const row = stmt.get();

    if (!row) {
      return null;
    }

    return new Account({
      id: row.id,
      dropboxAccessToken: row.dropboxAccessToken,
      dropboxRefreshToken: row.dropboxRefreshToken,
      dropboxTokenExpiresAt: row.dropboxTokenExpiresAt,
      brandLogo: row.brandLogo,
      brandColors: JSON.parse(row.brandColors || '{}'),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  // Update account
  async update(updates) {
    const db = dbManager.getDatabase();
    const now = new Date().toISOString();

    // Merge updates with existing data
    const updatedData = {
      dropboxAccessToken: updates.dropboxAccessToken !== undefined ? updates.dropboxAccessToken : this.dropboxAccessToken,
      dropboxRefreshToken: updates.dropboxRefreshToken !== undefined ? updates.dropboxRefreshToken : this.dropboxRefreshToken,
      dropboxTokenExpiresAt: updates.dropboxTokenExpiresAt !== undefined ? updates.dropboxTokenExpiresAt : this.dropboxTokenExpiresAt,
      brandLogo: updates.brandLogo !== undefined ? updates.brandLogo : this.brandLogo,
      brandColors: updates.brandColors !== undefined ? updates.brandColors : this.brandColors,
      updatedAt: now
    };

    const stmt = db.prepare(`
      UPDATE accounts 
      SET dropboxAccessToken = ?, dropboxRefreshToken = ?, dropboxTokenExpiresAt = ?, brandLogo = ?, brandColors = ?, updatedAt = ?
      WHERE id = ?
    `);

    try {
      stmt.run(
        updatedData.dropboxAccessToken,
        updatedData.dropboxRefreshToken,
        updatedData.dropboxTokenExpiresAt,
        updatedData.brandLogo,
        JSON.stringify(updatedData.brandColors),
        updatedData.updatedAt,
        this.id
      );

      // Update local instance
      Object.assign(this, updatedData);
      return this;
    } catch (error) {
      throw new Error(`Failed to update account: ${error.message}`);
    }
  }

  // Delete account
  async delete() {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');

    try {
      stmt.run(this.id);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      dropboxAccessToken: this.dropboxAccessToken,
      dropboxRefreshToken: this.dropboxRefreshToken,
      dropboxTokenExpiresAt: this.dropboxTokenExpiresAt,
      brandLogo: this.brandLogo,
      brandColors: this.brandColors,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Account;
