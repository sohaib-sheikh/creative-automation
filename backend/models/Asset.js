/**
 * Common Asset Model
 * Represents both uploaded and generated assets with a unified structure
 */
class Asset {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.type = data.type; // 'uploaded' or 'generated'
    this.filename = data.filename;
    this.originalName = data.originalName || data.filename;
    this.mimeType = data.mimeType;
    this.size = data.size;
    this.url = data.url; // Local URL
    this.dropboxPath = data.dropboxPath; // Dropbox path
    this.dropboxUrl = data.dropboxUrl; // Dropbox shared URL
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return 'asset_' + Date.now() + '_' + Math.round(Math.random() * 1E9);
  }

  // Convert to JSON for API responses
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      filename: this.filename,
      originalName: this.originalName,
      mimeType: this.mimeType,
      size: this.size,
      url: this.url,
      dropboxPath: this.dropboxPath,
      dropboxUrl: this.dropboxUrl,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Create from uploaded file
  static fromUploadedFile(file, localUrl) {
    return new Asset({
      type: 'uploaded',
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: localUrl,
      metadata: {
        uploadPath: file.path,
        fieldname: file.fieldname
      }
    });
  }

  // Create from generated content
  static fromGeneratedContent(filename, mimeType, size, localUrl, metadata = {}) {
    return new Asset({
      type: 'generated',
      filename: filename,
      originalName: filename,
      mimeType: mimeType,
      size: size,
      url: localUrl,
      metadata: {
        ...metadata,
        generated: true
      }
    });
  }

  // Update Dropbox information
  updateDropboxInfo(dropboxPath, dropboxUrl) {
    this.dropboxPath = dropboxPath;
    this.dropboxUrl = dropboxUrl;
    this.updatedAt = new Date().toISOString();
  }

  // Check if asset is stored in Dropbox
  isInDropbox() {
    return !!(this.dropboxPath && this.dropboxUrl);
  }
}

module.exports = Asset;
