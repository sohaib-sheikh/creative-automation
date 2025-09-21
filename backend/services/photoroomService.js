const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class PhotoroomService {
  constructor() {
    this.apiKey = process.env.PHOTOROOM_API_KEY;
    this.baseUrl = 'https://image-api.photoroom.com/v2';
  }

  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Expand an image to a different aspect ratio using Photoroom AI Expand
   * @param {string} imagePath - Path to the input image file
   * @param {string} outputSize - Desired output size (e.g., "1080x1920" for 9:16, "1920x1080" for 16:9)
   * @param {string} outputPath - Path where the expanded image should be saved
   * @returns {Promise<Object>} - Result object with success status and file path
   */
  async expandImage(imagePath, outputSize, outputPath) {
    if (!this.isAvailable()) {
      throw new Error('Photoroom API key not configured. Please set PHOTOROOM_API_KEY in your .env file');
    }

    try {
      console.log(`Expanding image ${imagePath} to ${outputSize}...`);

      // Create form data
      const formData = new FormData();
      formData.append('imageFile', fs.createReadStream(imagePath));
      formData.append('outputSize', outputSize);
      formData.append('referenceBox', 'originalImage');
      formData.append('removeBackground', 'false');
      formData.append('expand.mode', 'ai.auto');

      // Make API request
      const response = await axios.post(`${this.baseUrl}/edit`, formData, {
        headers: {
          'x-api-key': this.apiKey,
          ...formData.getHeaders()
        },
        responseType: 'stream'
      });

      // Save the expanded image
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Expanded image saved to: ${outputPath}`);
          resolve({
            success: true,
            outputPath,
            outputSize,
            expandedAt: new Date().toISOString()
          });
        });
        writer.on('error', (error) => {
          console.error('Error saving expanded image:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('Photoroom AI Expand error:', error.response?.data || error.message);
      throw new Error(`Failed to expand image: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Expand an image to multiple aspect ratios
   * @param {string} imagePath - Path to the input image file
   * @param {Array} aspectRatios - Array of aspect ratio objects with size and type
   * @param {string} baseOutputDir - Base directory for output files
   * @returns {Promise<Array>} - Array of result objects for each expansion
   */
  async expandToMultipleRatios(imagePath, aspectRatios, baseOutputDir) {
    const results = [];

    for (const ratio of aspectRatios) {
      try {
        const outputFilename = `expanded_${ratio.size.replace('x', '_')}_${Date.now()}.png`;
        const outputPath = path.join(baseOutputDir, outputFilename);

        const result = await this.expandImage(imagePath, ratio.size, outputPath);
        results.push({
          ...result,
          aspectRatio: ratio.aspectRatio,
          type: ratio.type,
          description: ratio.description
        });

        console.log(`Successfully expanded to ${ratio.aspectRatio} (${ratio.type})`);
      } catch (error) {
        console.error(`Failed to expand to ${ratio.aspectRatio}:`, error.message);
        results.push({
          success: false,
          aspectRatio: ratio.aspectRatio,
          type: ratio.type,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get predefined aspect ratio configurations
   * @returns {Array} - Array of aspect ratio configurations
   */
  getAspectRatioConfigs() {
    return [
      {
        aspectRatio: '9:16',
        size: '1080x1920',
        type: 'story_ad',
        description: 'Vertical story ad'
      },
      {
        aspectRatio: '16:9',
        size: '1920x1080',
        type: 'banner_ad',
        description: 'Wide banner ad'
      }
    ];
  }
}

module.exports = PhotoroomService;
