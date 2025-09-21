const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { GoogleGenAI, createUserContent, createPartFromUri } = require('@google/genai');
const { OpenAI } = require('openai');
const Asset = require('./models/Asset');
const StoredAsset = require('./models/StoredAsset');
const Account = require('./models/Account');
const LocalizedMessage = require('./models/LocalizedMessage');
const BrandCompliance = require('./models/BrandCompliance');
const LegalContentReview = require('./models/LegalContentReview');
const DropboxService = require('./services/dropboxService');
const PhotoroomService = require('./services/photoroomService');
const dbManager = require('./database/database');
const campaignRoutes = require('./routes/campaigns');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'uploaded_' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Initialize Google GenAI
let genAI = null;
if (process.env.GOOGLE_AI_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
}

// Initialize OpenAI
let openai = null;
if (process.env.OPENAI_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
}

// Initialize Services
const dropboxService = new DropboxService();
const photoroomService = new PhotoroomService();

// Helper function to get valid Dropbox access token
async function getValidDropboxToken(accessTokenFromRequest = null) {
  try {
    // If access token is provided in request, use it directly
    if (accessTokenFromRequest) {
      return accessTokenFromRequest;
    }

    // Otherwise, get from account settings and ensure it's valid
    const account = await Account.find();
    if (!account || !account.dropboxAccessToken) {
      throw new Error('No Dropbox access token found. Please authenticate with Dropbox first.');
    }

    // Ensure token is valid (refresh if necessary)
    const validAccount = await dropboxService.ensureValidToken(account);
    return validAccount.dropboxAccessToken;
  } catch (error) {
    console.error('Error getting valid Dropbox token:', error);
    throw error;
  }
}

// Google GenAI image generation function
async function generateImageWithGoogleAI(prompt) {
  if (!genAI) {
    throw new Error('Google AI API key not configured');
  }

  try {
    console.log('Generating image with Google GenAI...');
    console.log('Prompt:', prompt);

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: prompt,
    });

    let imageBuffer = null;
    let imageUrl = null;
    
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        console.log('Generated text:', part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        imageBuffer = Buffer.from(imageData, "base64");
        
        // Save image to uploads directory
        const filename = `generated_${Date.now()}.png`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        
        // Create URL for the saved image
        imageUrl = `/uploads/${filename}`;
        console.log('Image saved to:', filepath);
        console.log('Image URL:', imageUrl);
        break;
      }
    }

    if (!imageUrl) {
      throw new Error('No image data received from Google AI');
    }

    return {
      imageUrl,
      success: true,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Google GenAI error:', error);
    throw error;
  }
}

async function generateCreativeWithImages(prompt, images) {
  if (!genAI) {
    throw new Error('Google AI API key not configured');
  }

  try {
    console.log('Generating image with Google GenAI...');
    console.log('Prompt:', prompt);
    console.log('Images:', images);

    // Download all images from the images array and prepare image parts
    const imageParts = [];
    for (let i = 0; i < images.length; i++) {
      const fileUrl = images[i];
      try {
        const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const fileContent = Buffer.from(imageResponse.data);
        imageParts.push({
          inlineData: {
            data: fileContent.toString('base64'),
            mimeType: "image/jpeg"
          }
        });
        console.log(`Prepared image part ${i + 1} for Google GenAI.`);
      } catch (err) {
        console.error(`Failed to download or prepare image ${i + 1}:`, err.message);
        // Optionally skip this image or throw, here we skip
      }
    }

    if (imageParts.length === 0) {
      throw new Error('No valid images could be downloaded/prepared for Google GenAI');
    }

    console.log('imageParts length:', imageParts.length);

    // return;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: createUserContent([
        ...imageParts,
        prompt,
      ])
    });

    let imageBuffer = null;
    let imageUrl = null;
    
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        console.log('Generated text:', part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        imageBuffer = Buffer.from(imageData, "base64");
        
        // Save image to uploads directory
        const filename = `generated_${Date.now()}.png`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        
        // Create URL for the saved image
        imageUrl = `/uploads/${filename}`;
        console.log('Image saved to:', filepath);
        console.log('Image URL:', imageUrl);
        break;
      }
    }

    if (!imageUrl) {
      throw new Error('No image data received from Google AI');
    }

    return {
      imageUrl,
      success: true,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Google GenAI error:', error);
    throw error;
  }
}

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images with proper CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Serve static files from frontend build directory (for OAuth callback)
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// API Routes
app.use('/api/campaigns', campaignRoutes);

// Translation/Localization routes
app.post('/api/translate-message', async (req, res) => {
  try {
    const { campaignId, originalMessage, targetLanguage, languageCode, additionalInstructions } = req.body;

    // Validate required fields
    if (!campaignId || !originalMessage || !targetLanguage || !languageCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: campaignId, originalMessage, targetLanguage, languageCode'
      });
    }

    // Check if translation already exists for this campaign and language
    const existingTranslation = await LocalizedMessage.findByCampaignIdAndLanguage(campaignId, languageCode);
    if (existingTranslation) {
      return res.status(409).json({
        success: false,
        error: 'Translation already exists for this campaign and language',
        existingTranslation: existingTranslation.toJSON()
      });
    }

    // Create translation prompt
    let translationPrompt = `Please provide a natural, culturally appropriate translation that maintains the original message's intent and tone. The translation should be suitable for marketing/advertising purposes.`;

    if (additionalInstructions) {
      translationPrompt += `Here are some additional instructions: ${additionalInstructions}\n\n`;
    }

    translationPrompt += `Here is the campaign message to translate to ${targetLanguage} (${languageCode}):\n\n"${originalMessage}"\n\n`;


    // Use OpenAI for translation
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional translator specializing in marketing and advertising content. Provide accurate, culturally appropriate translations that maintain the original message's impact and intent."
        },
        {
          role: "user",
          content: translationPrompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    let translatedMessage = completion.choices[0].message.content.trim();

    // Remove surrounding quotes if present (single or double)
    if (
      (translatedMessage.startsWith('"') && translatedMessage.endsWith('"')) ||
      (translatedMessage.startsWith("'") && translatedMessage.endsWith("'"))
    ) {
      translatedMessage = translatedMessage.slice(1, -1).trim();
    }

    // Save the localized message to database
    const localizedMessageData = {
      campaignId,
      originalMessage,
      translatedMessage,
      targetLanguage,
      languageCode,
      additionalInstructions
    };

    const localizedMessage = await LocalizedMessage.create(localizedMessageData);

    res.status(201).json({
      success: true,
      localizedMessage: localizedMessage.toJSON(),
      message: 'Message translated and saved successfully'
    });

  } catch (error) {
    console.error('Error translating message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to translate message',
      details: error.message
    });
  }
});

// Get all localized messages for a campaign
app.get('/api/campaigns/:campaignId/localized-messages', async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required'
      });
    }

    const localizedMessages = await LocalizedMessage.findByCampaignId(campaignId);

    res.json({
      success: true,
      localizedMessages: localizedMessages.map(msg => msg.toJSON()),
      count: localizedMessages.length
    });

  } catch (error) {
    console.error('Error fetching localized messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch localized messages',
      details: error.message
    });
  }
});

// Delete a localized message
app.delete('/api/localized-messages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Localized message ID is required'
      });
    }

    await LocalizedMessage.delete(id);

    res.json({
      success: true,
      message: 'Localized message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting localized message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete localized message',
      details: error.message
    });
  }
});

// Account/Settings routes
app.get('/api/account', async (req, res) => {
  try {
    const account = await Account.find();
    
    if (!account) {
      return res.json(null);
    }

    // If account has Dropbox tokens, ensure they're valid
    if (account.dropboxAccessToken) {
      try {
        const validAccount = await dropboxService.ensureValidToken(account);
        return res.json(validAccount);
      } catch (error) {
        console.warn('Token validation failed, returning account without refresh:', error.message);
        // Return account even if token refresh failed
        return res.json(account);
      }
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account settings' });
  }
});

app.put('/api/account', async (req, res) => {
  try {
    const { dropboxAccessToken, dropboxRefreshToken, dropboxTokenExpiresAt, brandLogo, brandColors } = req.body;
    const account = await Account.upsert({
      dropboxAccessToken,
      dropboxRefreshToken,
      dropboxTokenExpiresAt,
      brandLogo,
      brandColors
    });
    res.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account settings' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to the Campaign Asset API!', 
    version: '2.0.0',
    endpoints: [
      'GET /api/campaigns - Get all campaigns with optional filtering',
      'GET /api/campaigns/:id - Get campaign by ID',
      'POST /api/campaigns - Create new campaign',
      'PUT /api/campaigns/:id - Update campaign',
      'DELETE /api/campaigns/:id - Delete campaign',
      'GET /api/campaigns/status/:status - Get campaigns by status',
      'GET /api/campaigns/search/:query - Search campaigns',
      'GET /api/campaigns/stats/overview - Get campaign statistics',
      'POST /api/upload-asset - Upload asset files directly to Dropbox (requires accessToken)',
      'POST /api/generate-asset - Generate assets using AI',
      'POST /api/generate-creatives - Generate creative variations from existing assets',
      'POST /api/dropbox/upload - Upload existing asset to Dropbox',
      'POST /api/dropbox/upload-content - Upload file content directly to Dropbox',
      'DELETE /api/dropbox/delete/:path - Delete asset from Dropbox',
      'GET /api/dropbox/metadata/:path - Get asset metadata from Dropbox',
      'GET /api/dropbox/list - List files in Dropbox folder',
      'GET /api/dropbox/list-with-urls - List files in Dropbox folder with shared URLs',
      'GET /api/dropbox/status - Check Dropbox configuration status',
      'GET /api/dropbox/auth - Get OAuth authorization URL with proper scopes',
      'POST /api/dropbox/token - Exchange OAuth code for access token',
      'POST /api/dropbox/refresh - Manually refresh Dropbox access token',
      'GET /api/assets - Get all stored assets with pagination and filtering',
      'GET /api/assets/:id - Get asset by ID',
      'GET /api/assets/type/:type - Get assets by type (uploaded/generated)',
      'GET /api/campaigns/:campaignId/assets - Get assets by campaign ID',
      'GET /api/products/:productId/assets - Get assets by product ID',
      'GET /api/assets/dropbox/:dropboxPath - Get asset by Dropbox path',
      'PUT /api/assets/:id - Update asset information',
      'DELETE /api/assets/:id - Delete asset from database',
      'POST /api/analyze-brand-colors - Analyze brand logo to extract primary, secondary, and accent colors using Google Gemini',
      'POST /api/analyze-brand-compliance - Analyze campaign creatives for brand color compliance using Google Gemini',
      'GET /api/campaigns/:campaignId/brand-compliance - Get saved brand compliance analysis results for a campaign'
    ],
    features: [
      'Campaign CRUD operations with SQLite database',
      'Asset upload and generation',
      'Dropbox cloud storage integration',
      'Asset database storage for easy retrieval',
      'Common asset model for unified handling',
      'Direct Dropbox upload for all assets (no local storage)',
      'OAuth authentication flow for Dropbox access',
      'Automatic token refresh for Dropbox access tokens',
      'Asset management API with filtering and pagination'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Asset Upload API - Direct to Dropbox
app.post('/api/upload-asset', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { accessToken } = req.body;

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox service not configured',
        message: 'Dropbox OAuth credentials not configured on server'
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    // Read the uploaded file content
    const fileContent = fs.readFileSync(req.file.path);
    
    // Upload directly to Dropbox
    const uploadResult = await dropboxService.uploadFileContent(
      validAccessToken,
      fileContent,
      req.file.originalname,
      req.file.mimetype,
      {
        originalName: req.file.originalname,
        size: req.file.size,
        uploadedAt: new Date().toISOString()
      }
    );

    // Create Asset model with Dropbox URL
    const asset = Asset.fromUploadedFile(req.file, uploadResult.dropboxUrl);
    asset.dropboxPath = uploadResult.dropboxPath;
    asset.dropboxUrl = uploadResult.dropboxUrl;

    // Store asset information in database
    const storedAsset = await StoredAsset.create({
      id: asset.id,
      type: 'uploaded',
      filename: uploadResult.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      localUrl: null, // No local URL since we're uploading directly to Dropbox
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl,
      dropboxFileId: uploadResult.fileId,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        fieldname: req.file.fieldname
      },
      campaignId: req.body.campaignId || null,
      productId: req.body.productId || null,
      accountId: req.body.accountId || null
    });

    // Clean up local file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      asset: asset.toJSON(),
      storedAsset: storedAsset.toJSON(),
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl + '&raw=1',
      message: 'File uploaded successfully to Dropbox and stored in database'
    });

    console.log('File uploaded successfully to Dropbox and stored in database:', {
      assetId: asset.id,
      storedAssetId: storedAsset.id,
      filename: req.file.originalname,
      size: req.file.size,
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl
    });

  } catch (error) {
    console.error('Error uploading file to Dropbox:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to upload file to Dropbox',
      details: error.message 
    });
  }
});

// Asset Generation API using Google GenAI (Nano Banana)
app.post('/api/generate-asset', async (req, res) => {
  try {
    const { productName, productDescription, productCategory, aspectRatio, accessToken, additionalPromptInstructions, targetAudience, targetMarket, campaignId, productId } = req.body;

    // Validate required fields
    if (!productName) {
      return res.status(400).json({ 
        error: 'Product name is required' 
      });
    }

    // Check if API key is configured
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({ 
        error: 'Google AI API key not configured. Please set GOOGLE_AI_API_KEY in your .env file' 
      });
    }

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox service not configured',
        message: 'Dropbox OAuth credentials not configured on server'
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    // Create a detailed prompt for image generation based on product information
    let prompt = `Generate a photorealistic, professional square (1:1 aspect ratio) image of the product "${productName}"`;
    
    if (productDescription) {
      prompt += `. Product description: "${productDescription}"`;
    }
    
    if (productCategory) {
      prompt += `. Product category: "${productCategory}"`;
    }
    
    if (targetAudience) {
      prompt += `. Target audience: "${targetAudience}"`;
    }
    
    if (targetMarket) {
      prompt += `. Target market: "${targetMarket}"`;
    }
    
    prompt += `. The image should be high-quality, visually striking, and showcase the product prominently with attractive lighting and composition. Consider the target audience and market preferences when creating the visual style and aesthetic.`;
    
    if (additionalPromptInstructions) {
      prompt += ` Additional instructions: ${additionalPromptInstructions}`;
    }

    console.log('Generating base 1:1 image with Google GenAI...');
    console.log('Prompt:', prompt);

    // Step 1: Generate base 1:1 image with Gemini
    const result = await generateImageWithGoogleAI(prompt);
    const filename = path.basename(result.imageUrl);
    const localFilePath = path.join(uploadsDir, filename);
    const fileStats = fs.statSync(localFilePath);
    const fileContent = fs.readFileSync(localFilePath);

    // Upload base 1:1 image to Dropbox
    const uploadResult = await dropboxService.uploadFileContent(
      validAccessToken,
      fileContent,
      filename,
      'image/png',
      {
        originalName: filename,
        size: fileStats.size,
        generatedAt: result.generatedAt,
        prompt: prompt,
        aspectRatio: '1:1',
        provider: 'Google GenAI',
        productName,
        productDescription,
        productCategory,
        targetAudience,
        targetMarket,
        additionalPromptInstructions
      }
    );

    // Create Asset model for base image
    const asset = Asset.fromGeneratedContent(
      filename,
      'image/png',
      fileStats.size,
      uploadResult.dropboxUrl,
      {
        prompt: prompt,
        aspectRatio: '1:1',
        provider: 'Google GenAI',
        productName,
        productDescription,
        productCategory,
        targetAudience,
        targetMarket,
        additionalPromptInstructions
      }
    );
    asset.dropboxPath = uploadResult.dropboxPath;
    asset.dropboxUrl = uploadResult.dropboxUrl;

    // Store main generated asset in database
    const storedAsset = await StoredAsset.create({
      id: asset.id,
      type: 'generated',
      filename: uploadResult.filename,
      originalName: filename,
      mimeType: 'image/png',
      size: fileStats.size,
      localUrl: result.imageUrl, // Local URL from generation
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl,
      dropboxFileId: uploadResult.fileId,
      metadata: {
        prompt: prompt,
        aspectRatio: '1:1',
        provider: 'Google GenAI',
        productName,
        productDescription,
        productCategory,
        targetAudience,
        targetMarket,
        additionalPromptInstructions,
        generatedAt: result.generatedAt
      },
      campaignId: campaignId || null,
      productId: productId || null,
      accountId: null // Will be set based on the account making the request
    });

    const generatedAssets = [{
      asset: asset.toJSON(),
      storedAsset: storedAsset.toJSON(),
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl + '&raw=1',
      aspectRatio: '1:1',
      provider: 'Google GenAI'
    }];

    // Step 2: Expand to other aspect ratios if Photoroom is available and aspectRatio is not specified
    if (photoroomService.isAvailable() && !aspectRatio) {
      console.log('Expanding to additional aspect ratios with Photoroom AI Expand...');
      
      const aspectRatioConfigs = photoroomService.getAspectRatioConfigs();
      const expansionResults = await photoroomService.expandToMultipleRatios(
        localFilePath,
        aspectRatioConfigs,
        uploadsDir
      );

      // Process each expanded image
      for (const expansionResult of expansionResults) {
        if (expansionResult.success) {
          try {
            // Upload expanded image to Dropbox
            const expandedFileStats = fs.statSync(expansionResult.outputPath);
            const expandedFileContent = fs.readFileSync(expansionResult.outputPath);

            const expandedUploadResult = await dropboxService.uploadFileContent(
              validAccessToken,
              expandedFileContent,
              `asset_${expansionResult.aspectRatio.replace(':', 'x')}_${Date.now()}.png`,
              'image/png',
              {
                originalName: path.basename(expansionResult.outputPath),
                size: expandedFileStats.size,
                generatedAt: expansionResult.expandedAt,
                prompt: prompt,
                aspectRatio: expansionResult.aspectRatio,
                provider: 'Photoroom AI Expand',
                productName,
                productDescription,
                productCategory,
                targetAudience,
                targetMarket,
                additionalPromptInstructions,
                baseImage: result.imageUrl
              }
            );

            // Create Asset model for expanded image
            const expandedAsset = Asset.fromGeneratedContent(
              path.basename(expansionResult.outputPath),
              'image/png',
              expandedFileStats.size,
              expandedUploadResult.dropboxUrl,
              {
                prompt: prompt,
                aspectRatio: expansionResult.aspectRatio,
                provider: 'Photoroom AI Expand',
                productName,
                productDescription,
                productCategory,
                targetAudience,
                targetMarket,
                additionalPromptInstructions,
                baseImage: result.imageUrl
              }
            );
            expandedAsset.dropboxPath = expandedUploadResult.dropboxPath;
            expandedAsset.dropboxUrl = expandedUploadResult.dropboxUrl;

            // Store expanded asset in database
            const storedExpandedAsset = await StoredAsset.create({
              id: expandedAsset.id,
              type: 'generated',
              filename: expandedUploadResult.filename,
              originalName: path.basename(expansionResult.outputPath),
              mimeType: 'image/png',
              size: expandedFileStats.size,
              localUrl: expansionResult.outputPath, // Local path before cleanup
              dropboxPath: expandedUploadResult.dropboxPath,
              dropboxUrl: expandedUploadResult.dropboxUrl,
              dropboxFileId: expandedUploadResult.fileId,
              metadata: {
                prompt: prompt,
                aspectRatio: expansionResult.aspectRatio,
                provider: 'Photoroom AI Expand',
                productName,
                productDescription,
                productCategory,
                targetAudience,
                targetMarket,
                additionalPromptInstructions,
                baseImage: result.imageUrl,
                generatedAt: expansionResult.expandedAt
              },
              campaignId: campaignId || null,
              productId: productId || null,
              accountId: null // Will be set based on the account making the request
            });

            generatedAssets.push({
              asset: expandedAsset.toJSON(),
              storedAsset: storedExpandedAsset.toJSON(),
              dropboxPath: expandedUploadResult.dropboxPath,
              dropboxUrl: expandedUploadResult.dropboxUrl + '&raw=1',
              aspectRatio: expansionResult.aspectRatio,
              provider: 'Photoroom AI Expand'
            });

            console.log(`Successfully expanded and uploaded asset for ${expansionResult.aspectRatio}`);

            // Clean up expanded file
            fs.unlinkSync(expansionResult.outputPath);

          } catch (error) {
            console.error(`Failed to upload expanded asset for ${expansionResult.aspectRatio}:`, error.message);
          }
        } else {
          console.error(`Failed to expand to ${expansionResult.aspectRatio}:`, expansionResult.error);
        }
      }
    }

    // Clean up base file
    fs.unlinkSync(localFilePath);

    // Return response with all generated assets
    res.json({
      success: true,
      assets: generatedAssets,
      primaryAsset: generatedAssets[0], // Keep backward compatibility
      asset: generatedAssets[0].asset, // Keep backward compatibility
      dropboxPath: generatedAssets[0].dropboxPath, // Keep backward compatibility
      dropboxUrl: generatedAssets[0].dropboxUrl, // Keep backward compatibility
      message: `Generated ${generatedAssets.length} asset(s) with different aspect ratios`
    });

    console.log('Image generated and uploaded successfully to Dropbox:', {
      assetId: asset.id,
      filename: filename,
      size: fileStats.size,
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl
    });

  } catch (error) {
    console.error('Error generating asset:', error.message);
    console.error('Error stack:', error.stack);
    
    // Clean up local file if it exists
    if (req.body && req.body.campaignDescription) {
      try {
        const filename = path.basename(result?.imageUrl || '');
        if (filename) {
          const localFilePath = path.join(uploadsDir, filename);
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
          }
        }
      } catch (cleanupError) {
        console.error('Error cleaning up local file:', cleanupError);
      }
    }
    
    // Return appropriate error response
    if (error.message.includes('API key not configured')) {
      res.status(500).json({
        error: 'Google AI API key not configured',
        details: error.message
      });
    } else if (error.message.includes('quota')) {
      res.status(429).json({
        error: 'API quota exceeded',
        details: error.message
      });
    } else if (error.message.includes('timeout')) {
      res.status(408).json({
        error: 'Request timeout - image generation took too long',
        details: error.message
      });
    } else if (error.message.includes('Dropbox')) {
      res.status(500).json({
        error: 'Failed to upload generated image to Dropbox',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to generate asset',
        details: error.message,
        provider: 'Google GenAI'
      });
    }
  }
});

// Generate Creatives API using Google GenAI
app.post('/api/generate-creatives', async (req, res) => {
  try {
    const { productId, productName, assetUrls, campaignBrief, accessToken, additionalPromptInstructions, targetAudience, targetRegion, campaignId } = req.body;

    // Validate required fields
    if (!productId || !productName || !assetUrls || !Array.isArray(assetUrls)) {
      return res.status(400).json({ 
        error: 'Product ID, product name, and asset URLs array are required' 
      });
    }

    // Check if API key is configured
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({ 
        error: 'Google AI API key not configured. Please set GOOGLE_AI_API_KEY in your .env file' 
      });
    }

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox service not configured',
        message: 'Dropbox OAuth credentials not configured on server'
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    console.log('=== Generate Creatives Request ===');
    console.log('Product ID:', productId);
    console.log('Product Name:', productName);
    console.log('Number of assets:', assetUrls.length);
    console.log('Asset URLs:', assetUrls);
    console.log('Campaign Brief:', campaignBrief);
    console.log('================================');

    // Download and process all product assets
    const assetBuffers = [];
    for (let i = 0; i < assetUrls.length; i++) {
      try {
        const assetUrl = assetUrls[i];
        console.log(`Downloading asset ${i + 1}/${assetUrls.length}: ${assetUrl}`);
        
        const response = await axios.get(assetUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout
        });
        
        const buffer = Buffer.from(response.data);
        assetBuffers.push({
          buffer,
          url: assetUrl,
          size: buffer.length
        });
        
        console.log(`Successfully downloaded asset ${i + 1}, size: ${buffer.length} bytes`);
      } catch (error) {
        console.error(`Failed to download asset ${i + 1}:`, error.message);
        // Continue with other assets even if one fails
      }
    }

    if (assetBuffers.length === 0) {
      return res.status(400).json({ 
        error: 'No valid assets could be downloaded from the provided URLs' 
      });
    }

    console.log(`Successfully downloaded ${assetBuffers.length} assets for creative generation`);

    // Get brand colors from account settings
    let brandColors = null;
    try {
      const account = await Account.find();
      if (account && account.brandColors && Object.keys(account.brandColors).length > 0) {
        // Extract colors from account brandColors object
        const accountColors = account.brandColors;
        
        // If brandColors is an array, use it directly
        if (Array.isArray(accountColors)) {
          brandColors = accountColors;
        } else {
          // Extract colors from object format
          const colors = [];
          if (accountColors.primary) colors.push(accountColors.primary);
          if (accountColors.secondary) colors.push(accountColors.secondary);
          if (accountColors.accent) colors.push(accountColors.accent);
          if (colors.length > 0) {
            brandColors = colors;
          }
        }
        
        if (brandColors) {
          console.log('Using brand colors from account:', brandColors);
        } else {
          console.log('No valid brand colors found in account settings');
        }
      } else {
        console.log('No account brand colors configured');
      }
    } catch (error) {
      console.error('Error retrieving account brand colors:', error.message);
      console.log('Skipping brand color instructions due to error');
    }

    const generatedCreatives = [];

    try {
      // Step 1: Generate base 1:1 image with Gemini
      console.log('Generating base 1:1 creative with Gemini...');
      
      let prompt = `Generate a professional marketing creative for "${productName}" based on the attached product images. Create a visually striking square (1:1 aspect ratio) advertisement that showcases the product prominently. The creative should be optimized for social media posts and include attractive lighting, composition, and visual elements that make the product appealing for marketing purposes. Use the product images as reference to maintain brand consistency and product accuracy. Do not generate text on the creative.`;
      
      if (targetAudience) {
        prompt += ` Target audience: ${targetAudience}`;
      }
      
      if (targetRegion) {
        prompt += ` Target region: ${targetRegion}`;
      }
      
      if (campaignBrief) {
        prompt += ` Campaign Message: ${campaignBrief.campaignMessage}`;
      }

      // Include brand colors from account settings
      if (brandColors && brandColors.length > 0) {
        const colorsString = brandColors.join(', ');
        prompt += ` Incorporate the brand colors (${colorsString}) subtly into the creative through product styling, background elements, lighting, or complementary design elements. Avoid using these colors as obvious swatches or color blocks - instead integrate them naturally into the overall composition and aesthetic.`;
      }

      if (additionalPromptInstructions) {
        prompt += ` Additional instructions: ${additionalPromptInstructions}`;
      }

      

      // Generate the base 1:1 image with Gemini
      const baseResult = await generateCreativeWithImages(prompt, assetUrls);
      const baseFilename = path.basename(baseResult.imageUrl);
      const baseFilePath = path.join(uploadsDir, baseFilename);

      console.log('Base 1:1 image generated successfully');

      // Step 2: Upload the base 1:1 image to Dropbox
      const baseFileStats = fs.statSync(baseFilePath);
      const baseFileContent = fs.readFileSync(baseFilePath);

      const baseUploadResult = await dropboxService.uploadFileContent(
        validAccessToken,
        baseFileContent,
        `creative_1x1_${Date.now()}.png`,
        'image/png',
        {
          originalName: baseFilename,
          size: baseFileStats.size,
          generatedAt: baseResult.generatedAt,
          prompt: prompt,
          aspectRatio: '1:1',
          provider: 'Google GenAI',
          productId,
          productName,
          creativeType: 'social_post',
          targetAudience,
          targetRegion,
          inputAssets: assetUrls
        }
      );

      // Create Asset model for base creative
      const baseAsset = Asset.fromGeneratedContent(
        baseFilename,
        'image/png',
        baseFileStats.size,
        baseUploadResult.dropboxUrl,
        {
          prompt: prompt,
          aspectRatio: '1:1',
          provider: 'Google GenAI',
          productId,
          productName,
          creativeType: 'social_post',
          targetAudience,
          targetRegion,
          inputAssets: assetUrls
        }
      );
      baseAsset.dropboxPath = baseUploadResult.dropboxPath;
      baseAsset.dropboxUrl = baseUploadResult.dropboxUrl;

      // Store base creative in database
      const storedBaseCreative = await StoredAsset.create({
        id: baseAsset.id,
        type: 'generated',
        filename: baseUploadResult.filename,
        originalName: baseFilename,
        mimeType: 'image/png',
        size: baseFileStats.size,
        localUrl: baseResult.imageUrl, // Local URL from generation
        dropboxPath: baseUploadResult.dropboxPath,
        dropboxUrl: baseUploadResult.dropboxUrl,
        dropboxFileId: baseUploadResult.fileId,
        metadata: {
          prompt: prompt,
          aspectRatio: '1:1',
          provider: 'Google GenAI',
          productId,
          productName,
          creativeType: 'social_post',
          targetAudience,
          targetRegion,
          inputAssets: assetUrls,
          generatedAt: baseResult.generatedAt
        },
        campaignId: campaignId || null,
        productId: productId || null,
        accountId: null // Will be set based on the account making the request
      });

      // Add base 1:1 creative to results
      generatedCreatives.push({
        id: `creative_${Date.now()}_1x1`,
        type: 'social_post',
        format: '1:1',
        description: `Square social media post for ${productName}`,
        previewUrl: baseUploadResult.dropboxUrl + '&raw=1',
        dropboxPath: baseUploadResult.dropboxPath,
        dropboxUrl: baseUploadResult.dropboxUrl,
        asset: baseAsset.toJSON(),
        storedAsset: storedBaseCreative.toJSON(),
        status: 'generated'
      });

      console.log('Successfully generated and uploaded base 1:1 creative');

      // Step 3: Expand to other aspect ratios using Photoroom AI Expand
      if (photoroomService.isAvailable()) {
        console.log('Expanding to additional aspect ratios with Photoroom AI Expand...');
        
        const aspectRatioConfigs = photoroomService.getAspectRatioConfigs();
        const expansionResults = await photoroomService.expandToMultipleRatios(
          baseFilePath,
          aspectRatioConfigs,
          uploadsDir
        );

        // Process each expanded image
        for (const expansionResult of expansionResults) {
          if (expansionResult.success) {
            try {
              // Upload expanded image to Dropbox
              const expandedFileStats = fs.statSync(expansionResult.outputPath);
              const expandedFileContent = fs.readFileSync(expansionResult.outputPath);

              const expandedUploadResult = await dropboxService.uploadFileContent(
                validAccessToken,
                expandedFileContent,
                `creative_${expansionResult.aspectRatio.replace(':', 'x')}_${Date.now()}.png`,
                'image/png',
                {
                  originalName: path.basename(expansionResult.outputPath),
                  size: expandedFileStats.size,
                  generatedAt: expansionResult.expandedAt,
                  prompt: prompt,
                  aspectRatio: expansionResult.aspectRatio,
                  provider: 'Photoroom AI Expand',
                  productId,
                  productName,
                  creativeType: expansionResult.type,
                  targetAudience,
                  targetRegion,
                  inputAssets: assetUrls,
                  baseImage: baseResult.imageUrl
                }
              );

              // Create Asset model for expanded creative
              const expandedAsset = Asset.fromGeneratedContent(
                path.basename(expansionResult.outputPath),
                'image/png',
                expandedFileStats.size,
                expandedUploadResult.dropboxUrl,
                {
                  prompt: prompt,
                  aspectRatio: expansionResult.aspectRatio,
                  provider: 'Photoroom AI Expand',
                  productId,
                  productName,
                  creativeType: expansionResult.type,
                  targetAudience,
                  targetRegion,
                  inputAssets: assetUrls,
                  baseImage: baseResult.imageUrl
                }
              );
              expandedAsset.dropboxPath = expandedUploadResult.dropboxPath;
              expandedAsset.dropboxUrl = expandedUploadResult.dropboxUrl;

              // Store expanded creative in database
              const storedExpandedCreative = await StoredAsset.create({
                id: expandedAsset.id,
                type: 'generated',
                filename: expandedUploadResult.filename,
                originalName: path.basename(expansionResult.outputPath),
                mimeType: 'image/png',
                size: expandedFileStats.size,
                localUrl: expansionResult.outputPath, // Local path before cleanup
                dropboxPath: expandedUploadResult.dropboxPath,
                dropboxUrl: expandedUploadResult.dropboxUrl,
                dropboxFileId: expandedUploadResult.fileId,
                metadata: {
                  prompt: prompt,
                  aspectRatio: expansionResult.aspectRatio,
                  provider: 'Photoroom AI Expand',
                  productId,
                  productName,
                  creativeType: expansionResult.type,
                  targetAudience,
                  targetRegion,
                  inputAssets: assetUrls,
                  baseImage: baseResult.imageUrl,
                  generatedAt: expansionResult.expandedAt
                },
                campaignId: campaignId || null,
                productId: productId || null,
                accountId: null // Will be set based on the account making the request
              });

              const creativeId = `creative_${Date.now()}_${expansionResult.aspectRatio.replace(':', 'x')}`;

              generatedCreatives.push({
                id: creativeId,
                type: expansionResult.type,
                aspectRatio: expansionResult.aspectRatio,
                description: `${expansionResult.description} for ${productName}`,
                previewUrl: expandedUploadResult.dropboxUrl + '&raw=1',
                dropboxPath: expandedUploadResult.dropboxPath,
                dropboxUrl: expandedUploadResult.dropboxUrl,
                asset: expandedAsset.toJSON(),
                storedAsset: storedExpandedCreative.toJSON(),
                status: 'generated'
              });

              console.log(`Successfully expanded and uploaded creative for ${expansionResult.aspectRatio} ${creativeId}`);

              // Clean up expanded file
              fs.unlinkSync(expansionResult.outputPath);

            } catch (error) {
              console.error(`Failed to upload expanded creative for ${expansionResult.aspectRatio}:`, error.message);
            }
          } else {
            console.error(`Failed to expand to ${expansionResult.aspectRatio}:`, expansionResult.error);
          }
        }
      } else {
        console.warn('Photoroom service not available. Only generating 1:1 aspect ratio.');
      }

      // Clean up base file
      fs.unlinkSync(baseFilePath);

    } catch (error) {
      console.error('Failed to generate creatives:', error.message);
      return res.status(500).json({ 
        error: 'Failed to generate creatives',
        details: error.message
      });
    }

    if (generatedCreatives.length === 0) {
      return res.status(500).json({ 
        error: 'Failed to generate any creatives',
        details: 'All creative generation attempts failed'
      });
    }

    const response = {
      success: true,
      productId,
      productName,
      inputAssets: assetUrls,
      generatedCreatives,
      campaignContext: {
        message: campaignBrief?.campaignMessage || 'No campaign message provided',
        brandColors: campaignBrief?.brandColors || [],
        targetAudience: campaignBrief?.targetAudience || 'General audience'
      },
      generatedAt: new Date().toISOString(),
      message: `Successfully generated ${generatedCreatives.length} creative variations for ${productName}`
    };

    res.json(response);

    console.log('Generated creatives response:', {
      productId,
      productName,
      generatedCount: generatedCreatives.length,
      inputAssetsCount: assetUrls.length
    });

  } catch (error) {
    console.error('Error in generate-creatives endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to generate creatives',
      details: error.message 
    });
  }
});

// Regenerate Campaign Message API using OpenAI ChatGPT
app.post('/api/regenerate-campaign-message', async (req, res) => {
  try {
    const { campaignId, campaignBrief, additionalInstructions } = req.body;

    // Validate required fields
    if (!campaignBrief) {
      return res.status(400).json({ 
        error: 'Campaign brief is required' 
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_KEY in your .env file' 
      });
    }

    console.log('=== Regenerate Campaign Message Request ===');
    console.log('Campaign ID:', campaignId);
    console.log('Campaign Brief:', campaignBrief);
    console.log('Additional Instructions:', additionalInstructions);
    console.log('==========================================');

    // Build the prompt for OpenAI
    let prompt = `You are a professional marketing copywriter. Generate a compelling campaign message based on the following campaign brief:

Campaign Name: ${campaignBrief.name}
Target Audience: ${campaignBrief.targetAudience || 'Not specified'}
Target Market/Region: ${campaignBrief.targetRegion || 'Not specified'}
Primary Language: ${campaignBrief.localization?.primaryLanguage || 'English'}

Products:
${campaignBrief.products?.map(product => 
  `- ${product.name}: ${product.description} (Category: ${product.category})`
).join('\n') || 'No products specified'}

Current Campaign Message: ${campaignBrief.campaignMessage || 'No current message'}

Please generate a new, compelling campaign message that:
1. Is tailored to the target audience and market
2. Highlights the key benefits of the products
3. Uses appropriate tone and language for the target region
4. Is engaging and persuasive
5. Is concise but impactful
6. Aligns with the campaign objectives

${additionalInstructions ? `Additional Instructions: ${additionalInstructions}` : ''}

Generate a professional campaign message that will resonate with the target audience and drive engagement. 

Make it text only, no images, no markdown, no html, no quotes, no links, no formatting, no bold, no italic, no underline, no strikethrough, no list, no table, no code, no blockquote, no h1, no h2, no h3, no h4, no h5, no h6.`;

    console.log('Sending prompt to OpenAI:\n', prompt);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional marketing copywriter with expertise in creating compelling campaign messages for various industries and target audiences."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.8,
    });

    let generatedMessage = completion.choices[0]?.message?.content?.trim();
    if (generatedMessage && (generatedMessage.startsWith('"') && generatedMessage.endsWith('"'))) {
      generatedMessage = generatedMessage.slice(1, -1).trim();
    }

    if (!generatedMessage) {
      throw new Error('No message generated by OpenAI');
    }

    console.log('Generated campaign message:', generatedMessage);

    const response = {
      success: true,
      campaignId,
      campaignMessage: generatedMessage,
      generatedAt: new Date().toISOString(),
      additionalInstructions: additionalInstructions || null,
      message: 'Campaign message regenerated successfully'
    };

    res.json(response);

    console.log('Campaign message regenerated successfully:', {
      campaignId,
      messageLength: generatedMessage.length,
      hasAdditionalInstructions: !!additionalInstructions
    });

  } catch (error) {
    console.error('Error regenerating campaign message:', error);
    
    // Return appropriate error response
    if (error.message.includes('API key not configured')) {
      res.status(500).json({
        error: 'OpenAI API key not configured',
        details: error.message
      });
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      res.status(429).json({
        error: 'API quota exceeded or rate limited',
        details: error.message
      });
    } else if (error.message.includes('timeout')) {
      res.status(408).json({
        error: 'Request timeout - message generation took too long',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to regenerate campaign message',
        details: error.message,
        provider: 'OpenAI ChatGPT'
      });
    }
  }
});

// Dropbox Storage Endpoints

// Upload asset to Dropbox
app.post('/api/dropbox/upload', async (req, res) => {
  try {
    const { accessToken, assetId, localFilePath, dropboxPath } = req.body;

    if (!assetId || !localFilePath) {
      return res.status(400).json({ 
        error: 'Asset ID and local file path are required' 
      });
    }

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox OAuth credentials not configured. Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file' 
      });
    }

    // Check if local file exists
    if (!fs.existsSync(localFilePath)) {
      return res.status(404).json({ 
        error: 'Local file not found' 
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    // Upload to Dropbox
    const uploadResult = await dropboxService.uploadFile(
      validAccessToken,
      localFilePath, 
      dropboxPath || path.basename(localFilePath)
    );

    // Get file stats for database storage
    const fileStats = fs.statSync(localFilePath);
    const filename = path.basename(localFilePath);

    // Store asset information in database
    const storedAsset = await StoredAsset.create({
      id: assetId,
      type: 'uploaded',
      filename: filename,
      originalName: filename,
      mimeType: req.body.mimeType || 'application/octet-stream',
      size: fileStats.size,
      localUrl: localFilePath,
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl,
      dropboxFileId: uploadResult.fileId,
      metadata: {
        originalPath: localFilePath,
        uploadedAt: uploadResult.uploadedAt,
        ...req.body.metadata
      },
      campaignId: req.body.campaignId || null,
      productId: req.body.productId || null,
      accountId: req.body.accountId || null
    });

    res.json({
      success: true,
      assetId: assetId,
      storedAsset: storedAsset.toJSON(),
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl,
      uploadedAt: uploadResult.uploadedAt
    });

  } catch (error) {
    console.error('Dropbox upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload to Dropbox',
      details: error.message 
    });
  }
});

// Upload file content directly to Dropbox (for generated assets)
app.post('/api/dropbox/upload-content', async (req, res) => {
  try {
    const { accessToken, filename, mimeType, fileContent, metadata } = req.body;

    if (!filename || !fileContent) {
      return res.status(400).json({ 
        error: 'Filename and file content are required' 
      });
    }

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox OAuth credentials not configured. Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file' 
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    // Convert base64 content to buffer if needed
    let buffer;
    if (typeof fileContent === 'string') {
      buffer = Buffer.from(fileContent, 'base64');
    } else {
      buffer = Buffer.from(fileContent);
    }

    // Upload to Dropbox
    const uploadResult = await dropboxService.uploadFileContent(
      validAccessToken,
      buffer,
      filename,
      mimeType || 'image/png',
      metadata || {}
    );

    // Store asset information in database
    const storedAsset = await StoredAsset.create({
      id: `asset_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
      type: 'generated',
      filename: uploadResult.filename,
      originalName: filename,
      mimeType: mimeType || 'image/png',
      size: uploadResult.size,
      localUrl: null, // No local file for content uploads
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl,
      dropboxFileId: uploadResult.fileId,
      metadata: {
        uploadedAt: uploadResult.uploadedAt,
        ...metadata
      },
      campaignId: req.body.campaignId || null,
      productId: req.body.productId || null,
      accountId: req.body.accountId || null
    });

    res.json({
      success: true,
      storedAsset: storedAsset.toJSON(),
      dropboxPath: uploadResult.dropboxPath,
      dropboxUrl: uploadResult.dropboxUrl,
      filename: uploadResult.filename,
      size: uploadResult.size,
      uploadedAt: uploadResult.uploadedAt
    });

  } catch (error) {
    console.error('Dropbox content upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload content to Dropbox',
      details: error.message 
    });
  }
});

// Delete asset from Dropbox
app.delete('/api/dropbox/delete/:dropboxPath(*)', async (req, res) => {
  try {
    const { accessToken } = req.body;
    const dropboxPath = req.params.dropboxPath;

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox OAuth credentials not configured. Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file' 
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    const deleteResult = await dropboxService.deleteFile(validAccessToken, dropboxPath);

    res.json({
      success: true,
      deletedPath: deleteResult.deletedPath,
      deletedAt: deleteResult.deletedAt
    });

  } catch (error) {
    console.error('Dropbox delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete from Dropbox',
      details: error.message 
    });
  }
});

// Get file metadata from Dropbox
app.get('/api/dropbox/metadata/:dropboxPath(*)', async (req, res) => {
  try {
    const { accessToken } = req.query;
    const dropboxPath = req.params.dropboxPath;

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox OAuth credentials not configured. Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file' 
      });
    }

    // Get valid access token (refresh if necessary)
    const validAccessToken = await getValidDropboxToken(accessToken);

    const metadataResult = await dropboxService.getFileMetadata(validAccessToken, dropboxPath);

    res.json({
      success: true,
      metadata: metadataResult.metadata,
      retrievedAt: metadataResult.retrievedAt
    });

  } catch (error) {
    console.error('Dropbox metadata error:', error);
    res.status(500).json({ 
      error: 'Failed to get metadata from Dropbox',
      details: error.message 
    });
  }
});

// List files in Dropbox folder
app.get('/api/dropbox/list', async (req, res) => {
  try {
    const { accessToken, folderPath } = req.query;

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox OAuth credentials not configured. Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file' 
      });
    }

    // Get valid access token (refresh if necessary) - supports both account token and request token
    const validAccessToken = await getValidDropboxToken(accessToken);

    const listResult = await dropboxService.listFiles(validAccessToken, folderPath);

    res.json({
      success: true,
      files: listResult.files,
      path: listResult.path,
      retrievedAt: listResult.retrievedAt
    });

  } catch (error) {
    console.error('Dropbox list error:', error);
    res.status(500).json({ 
      error: 'Failed to list files from Dropbox',
      details: error.message 
    });
  }
});

// List files in Dropbox folder with shared URLs
app.get('/api/dropbox/list-with-urls', async (req, res) => {
  try {
    const { folderPath } = req.query;

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox OAuth credentials not configured. Please set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET in your .env file' 
      });
    }

    // Get valid access token from account (refresh if necessary)
    const validAccessToken = await getValidDropboxToken();

    const listResult = await dropboxService.listFiles(validAccessToken, folderPath);

    console.log('Dropbox list result:', listResult);

    // Get shared link metadata for each file
    const filesWithUrls = await Promise.all(
      listResult.files.map(async (file) => {
        try {
          // Get shared link metadata for the file
          const sharedLinkMetadata = await dropboxService.getSharedLinkMetadata(validAccessToken, file.path_lower);
          
          // Extract preview URL from metadata
          const previewUrl = sharedLinkMetadata.metadata.preview_url;
          
          return {
            ...file,
            sharedUrl: previewUrl ? previewUrl + '&raw=1' : null
          };
        } catch (error) {
          console.error(`Failed to get shared link metadata for ${file.name}:`, error);
          return {
            ...file,
            sharedUrl: null,
            error: 'Failed to get shared link metadata'
          };
        }
      })
    );

    res.json({
      success: true,
      files: filesWithUrls,
      path: listResult.path,
      retrievedAt: listResult.retrievedAt
    });

  } catch (error) {
    console.error('Dropbox list with URLs error:', error);
    res.status(500).json({ 
      error: 'Failed to list files from Dropbox',
      details: error.message 
    });
  }
});

// Check Dropbox configuration status
app.get('/api/dropbox/status', (req, res) => {
  res.json({
    available: dropboxService.isAvailable(),
    oauthConfigured: !!(process.env.DROPBOX_CLIENT_ID && process.env.DROPBOX_CLIENT_SECRET),
    basePath: process.env.DROPBOX_BASE_PATH || '/campaign-assets'
  });
});

// Asset Management API Endpoints

// Get all stored assets with pagination
app.get('/api/assets', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, campaignId, productId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const options = {
      limit: parseInt(limit),
      offset: offset
    };

    if (type) options.type = type;
    if (campaignId) options.campaignId = campaignId;
    if (productId) options.productId = productId;

    const result = await StoredAsset.findAll(options);

    res.json({
      success: true,
      assets: result.assets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch assets',
      details: error.message 
    });
  }
});

// Get asset by ID
app.get('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await StoredAsset.findById(id);

    if (!asset) {
      return res.status(404).json({ 
        error: 'Asset not found' 
      });
    }

    res.json({
      success: true,
      asset: asset.toJSON()
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ 
      error: 'Failed to fetch asset',
      details: error.message 
    });
  }
});

// Get assets by type
app.get('/api/assets/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { campaignId, productId, limit } = req.query;

    if (!['uploaded', 'generated'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid asset type. Must be "uploaded" or "generated"' 
      });
    }

    const options = {};
    if (campaignId) options.campaignId = campaignId;
    if (productId) options.productId = productId;
    if (limit) options.limit = parseInt(limit);

    const assets = await StoredAsset.findByType(type, options);

    res.json({
      success: true,
      assets: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error fetching assets by type:', error);
    res.status(500).json({ 
      error: 'Failed to fetch assets by type',
      details: error.message 
    });
  }
});

// Get assets by campaign ID
app.get('/api/campaigns/:campaignId/assets', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const assets = await StoredAsset.findByCampaignId(campaignId);

    res.json({
      success: true,
      campaignId: campaignId,
      assets: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error fetching campaign assets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch campaign assets',
      details: error.message 
    });
  }
});

// Get assets by product ID
app.get('/api/products/:productId/assets', async (req, res) => {
  try {
    const { productId } = req.params;
    const assets = await StoredAsset.findByProductId(productId);

    res.json({
      success: true,
      productId: productId,
      assets: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error fetching product assets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch product assets',
      details: error.message 
    });
  }
});

// Get asset by Dropbox path
app.get('/api/assets/dropbox/:dropboxPath(*)', async (req, res) => {
  try {
    const dropboxPath = req.params.dropboxPath;
    const asset = await StoredAsset.findByDropboxPath(dropboxPath);

    if (!asset) {
      return res.status(404).json({ 
        error: 'Asset not found for the given Dropbox path' 
      });
    }

    res.json({
      success: true,
      asset: asset.toJSON()
    });
  } catch (error) {
    console.error('Error fetching asset by Dropbox path:', error);
    res.status(500).json({ 
      error: 'Failed to fetch asset by Dropbox path',
      details: error.message 
    });
  }
});

// Update asset information
app.put('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const asset = await StoredAsset.findById(id);
    if (!asset) {
      return res.status(404).json({ 
        error: 'Asset not found' 
      });
    }

    const updatedAsset = await asset.update(updateData);

    res.json({
      success: true,
      asset: updatedAsset.toJSON()
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ 
      error: 'Failed to update asset',
      details: error.message 
    });
  }
});

// Delete asset from database (does not delete from Dropbox)
app.delete('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await StoredAsset.findById(id);
    if (!asset) {
      return res.status(404).json({ 
        error: 'Asset not found' 
      });
    }

    const deleted = await asset.delete();

    if (deleted) {
      res.json({
        success: true,
        message: 'Asset deleted from database successfully'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to delete asset' 
      });
    }
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ 
      error: 'Failed to delete asset',
      details: error.message 
    });
  }
});

// OAuth flow endpoints
app.get('/api/dropbox/auth', (req, res) => {
  try {
    const { redirect_uri } = req.query;
    
    if (!redirect_uri) {
      return res.status(400).json({ 
        error: 'redirect_uri query parameter is required' 
      });
    }

    const authUrl = dropboxService.getAuthUrl(redirect_uri);
    
    res.json({
      success: true,
      authUrl: authUrl,
      message: 'Redirect user to this URL for authorization'
    });

  } catch (error) {
    console.error('OAuth auth URL error:', error);
    res.status(500).json({ 
      error: 'Failed to generate auth URL',
      details: error.message 
    });
  }
});

app.post('/api/dropbox/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;

    if (!code || !redirect_uri) {
      return res.status(400).json({ 
        error: 'code and redirect_uri are required' 
      });
    }

    const tokenResult = await dropboxService.exchangeCodeForToken(code, redirect_uri);

    // Store tokens in account settings
    const account = await Account.upsert({
      dropboxAccessToken: tokenResult.access_token,
      dropboxRefreshToken: tokenResult.refresh_token,
      dropboxTokenExpiresAt: tokenResult.expires_at
    });

    res.json({
      success: true,
      access_token: tokenResult.access_token,
      refresh_token: tokenResult.refresh_token,
      token_type: tokenResult.token_type,
      expires_in: tokenResult.expires_in,
      expires_at: tokenResult.expires_at,
      scope: tokenResult.scope,
      message: 'Tokens stored in account settings and will be automatically refreshed when needed'
    });

  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange code for token',
      details: error.message 
    });
  }
});

// Manual token refresh endpoint
app.post('/api/dropbox/refresh', async (req, res) => {
  try {
    const account = await Account.find();
    
    if (!account || !account.dropboxAccessToken) {
      return res.status(400).json({ 
        error: 'No Dropbox access token found. Please authenticate with Dropbox first.' 
      });
    }

    if (!account.dropboxRefreshToken) {
      return res.status(400).json({ 
        error: 'No refresh token available. Please re-authenticate with Dropbox.' 
      });
    }

    // Ensure token is valid (refresh if necessary)
    const validAccount = await dropboxService.ensureValidToken(account);

    res.json({
      success: true,
      access_token: validAccount.dropboxAccessToken,
      refresh_token: validAccount.dropboxRefreshToken,
      expires_at: validAccount.dropboxTokenExpiresAt,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      error: 'Failed to refresh token',
      details: error.message 
    });
  }
});

// Analyze Brand Colors from Logo using Google Gemini
app.post('/api/analyze-brand-colors', async (req, res) => {
  try {
    const { logoUrl } = req.body;

    if (!logoUrl) {
      return res.status(400).json({ 
        error: 'Logo URL is required' 
      });
    }

    // Check if Google AI API key is configured
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({ 
        error: 'Google AI API key not configured. Please set GOOGLE_AI_API_KEY in your .env file' 
      });
    }

    if (!genAI) {
      return res.status(500).json({ 
        error: 'Google AI service not initialized' 
      });
    }

    console.log('=== Analyze Brand Colors Request ===');
    console.log('Logo URL:', logoUrl);
    console.log('===================================');

    // Download the logo image
    let imageBuffer;
    try {
      const imageResponse = await axios.get(logoUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });
      imageBuffer = Buffer.from(imageResponse.data);
      console.log('Successfully downloaded logo image, size:', imageBuffer.length, 'bytes');
    } catch (error) {
      console.error('Failed to download logo image:', error.message);
      return res.status(400).json({ 
        error: 'Failed to download logo image. Please ensure the logo URL is accessible.' 
      });
    }

    // Prepare the image for Gemini
    const imageData = imageBuffer.toString('base64');
    
    // Create the prompt for color analysis
    const prompt = `Analyze this brand logo image and extract the 3 most prominent brand colors. 

Please identify:
1. Primary color - the most dominant color in the logo
2. Secondary color - the second most prominent color 
3. Accent color - a third color that adds visual interest

For each color, provide the exact hex color code (e.g., #FF6B6B). The colors should be representative of the brand identity and suitable for use in marketing materials.

Return your response in this exact JSON format:
{
  "primary": "#hexcode",
  "secondary": "#hexcode", 
  "accent": "#hexcode"
}

Only return the JSON object, no additional text or explanation.`;

    console.log('Sending image to Google Gemini for color analysis...');

    // Call Google Gemini API
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: createUserContent([
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg"
          }
        },
        prompt
      ])
    });

    // Extract the response text
    let responseText = '';
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        responseText += part.text;
      }
    }

    console.log('Gemini response:', responseText);

    // Parse the JSON response
    let brandColors;
    try {
      // Clean up the response text (remove any markdown formatting)
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      brandColors = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
      console.error('Raw response:', responseText);
      return res.status(500).json({ 
        error: 'Failed to parse color analysis response',
        details: 'The AI response was not in the expected JSON format'
      });
    }

    // Validate the response structure
    if (!brandColors.primary || !brandColors.secondary || !brandColors.accent) {
      return res.status(500).json({ 
        error: 'Invalid color analysis response',
        details: 'The AI response did not contain all required color fields (primary, secondary, accent)'
      });
    }

    // Validate hex color format
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexColorRegex.test(brandColors.primary) || 
        !hexColorRegex.test(brandColors.secondary) || 
        !hexColorRegex.test(brandColors.accent)) {
      return res.status(500).json({ 
        error: 'Invalid color format',
        details: 'One or more colors are not in valid hex format (#RRGGBB)'
      });
    }

    console.log('Successfully analyzed brand colors:', brandColors);

    const response_data = {
      success: true,
      brandColors: brandColors,
      logoUrl: logoUrl,
      analyzedAt: new Date().toISOString(),
      message: 'Brand colors analyzed successfully'
    };

    res.json(response_data);

    console.log('Brand color analysis completed successfully:', {
      primary: brandColors.primary,
      secondary: brandColors.secondary,
      accent: brandColors.accent
    });

  } catch (error) {
    console.error('Error analyzing brand colors:', error);
    
    // Return appropriate error response
    if (error.message.includes('API key not configured')) {
      res.status(500).json({
        error: 'Google AI API key not configured',
        details: error.message
      });
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      res.status(429).json({
        error: 'API quota exceeded or rate limited',
        details: error.message
      });
    } else if (error.message.includes('timeout')) {
      res.status(408).json({
        error: 'Request timeout - color analysis took too long',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to analyze brand colors',
        details: error.message,
        provider: 'Google Gemini'
      });
    }
  }
});

// Brand Compliance Analysis endpoint
app.post('/api/analyze-brand-compliance', async (req, res) => {
  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({ 
        error: 'Campaign ID is required' 
      });
    }

    // Check if Google AI API key is configured
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({ 
        error: 'Google AI API key not configured. Please set GOOGLE_AI_API_KEY in your .env file' 
      });
    }

    if (!genAI) {
      return res.status(500).json({ 
        error: 'Google AI service not initialized' 
      });
    }

    console.log('=== Brand Compliance Analysis Request ===');
    console.log('Campaign ID:', campaignId);
    console.log('========================================');

    // Get campaign data
    const Campaign = require('./models/Campaign');
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ 
        error: 'Campaign not found' 
      });
    }

    // Get account brand colors
    const account = await Account.find();
    if (!account || !account.brandColors || Object.keys(account.brandColors).length === 0) {
      return res.status(400).json({ 
        error: 'No brand colors configured. Please set up brand colors in account settings first.' 
      });
    }

    // Extract brand colors
    let brandColors = [];
    if (Array.isArray(account.brandColors)) {
      brandColors = account.brandColors;
    } else {
      if (account.brandColors.primary) brandColors.push(account.brandColors.primary);
      if (account.brandColors.secondary) brandColors.push(account.brandColors.secondary);
      if (account.brandColors.accent) brandColors.push(account.brandColors.accent);
    }

    if (brandColors.length === 0) {
      return res.status(400).json({ 
        error: 'No valid brand colors found in account settings' 
      });
    }

    // Get only generated creatives from the campaign (exclude assets)
    const allCreatives = [...campaign.generatedCreatives];
    
    if (allCreatives.length === 0) {
      return res.status(400).json({ 
        error: 'No generated creatives found in this campaign to analyze' 
      });
    }

    console.log(`Analyzing ${allCreatives.length} generated creatives for brand compliance...`);
    console.log('Brand colors:', brandColors);
    console.log('Campaign generatedCreatives:', JSON.stringify(campaign.generatedCreatives, null, 2));

    const complianceResults = [];
    const brandColorsString = brandColors.join(', ');

    // Analyze each creative
    for (let i = 0; i < allCreatives.length; i++) {
      const creative = allCreatives[i];
      let imageUrl = null;

      console.log(`Processing creative ${i + 1}`);

      // Get image URL from different creative types
      if (creative.previewUrl) {
        imageUrl = creative.previewUrl;
        console.log(`Using previewUrl: ${imageUrl}`);
      } else if (creative.imageUrl) {
        imageUrl = creative.imageUrl;
        console.log(`Using imageUrl: ${imageUrl}`);
      } else if (creative.url) {
        imageUrl = creative.url;
        console.log(`Using url: ${imageUrl}`);
      } else if (creative.dropboxUrl) {
        imageUrl = creative.dropboxUrl + '&raw=1';
        console.log(`Using dropboxUrl: ${imageUrl}`);
      } else if (creative.asset && creative.asset.url) {
        imageUrl = creative.asset.url;
        console.log(`Using asset.url: ${imageUrl}`);
      } else if (creative.asset && creative.asset.dropboxUrl) {
        imageUrl = creative.asset.dropboxUrl + '&raw=1';
        console.log(`Using asset.dropboxUrl: ${imageUrl}`);
      }

      if (!imageUrl) {
        console.warn(`No image URL found for creative ${i + 1}, skipping...`);
        console.warn('Creative structure:', JSON.stringify(creative, null, 2));
        continue;
      }

      try {
        console.log(`Analyzing creative ${i + 1}/${allCreatives.length}: ${imageUrl}`);

        // Download the creative image
        const imageResponse = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout
        });
        const imageBuffer = Buffer.from(imageResponse.data);
        const imageData = imageBuffer.toString('base64');

        // Create the prompt for brand compliance analysis
        const prompt = `Analyze this marketing creative image for brand compliance. 

Brand Colors to Check: ${brandColorsString}

Please analyze the image and determine:
1. Does this creative use the brand colors effectively or even subtly?
2. Are there any colors that conflict with the brand identity?
3. Overall brand compliance score (0-100)

Return your response in this exact JSON format:
{
  "usesBrandColors": true/false,
  "brandColorUsage": "excellent|good|moderate|poor",
  "conflictingColors": ["#hexcode1", "#hexcode2"],
  "complianceScore": 85,
  "analysis": "Detailed analysis of how well this creative aligns with brand guidelines"
}

Only return the JSON object, no additional text or explanation.`;

        // Call Google Gemini API
        const response = await genAI.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: createUserContent([
            {
              inlineData: {
                data: imageData,
                mimeType: "image/jpeg"
              }
            },
            prompt
          ])
        });

        // Extract the response text
        let responseText = '';
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }

        console.log(`Gemini response for creative ${i + 1}:`, responseText);

        // Parse the JSON response
        let complianceData;
        try {
          const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          complianceData = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error(`Failed to parse compliance response for creative ${i + 1}:`, parseError);
          complianceData = {
            usesBrandColors: false,
            brandColorUsage: "unknown",
            conflictingColors: [],
            complianceScore: 0,
            analysis: "Failed to analyze this creative"
          };
        }

        complianceResults.push({
          creativeIndex: i + 1,
          creativeId: creative.id || `creative_${i + 1}`,
          imageUrl: imageUrl,
          compliance: complianceData,
          analyzedAt: new Date().toISOString()
        });

        console.log(`Successfully analyzed creative ${i + 1}`);

      } catch (error) {
        console.error(`Failed to analyze creative ${i + 1}:`, error.message);
        complianceResults.push({
          creativeIndex: i + 1,
          creativeId: creative.id || `creative_${i + 1}`,
          imageUrl: imageUrl,
          compliance: {
            usesBrandColors: false,
            brandColorUsage: "error",
            conflictingColors: [],
            complianceScore: 0,
            analysis: `Failed to analyze: ${error.message}`
          },
          analyzedAt: new Date().toISOString(),
          error: error.message
        });
      }
    }

    // Calculate overall compliance metrics
    const totalCreatives = complianceResults.length;
    const compliantCreatives = complianceResults.filter(r => r.compliance.usesBrandColors).length;
    const averageScore = complianceResults.reduce((sum, r) => sum + r.compliance.complianceScore, 0) / totalCreatives;
    const allConflictingColors = [...new Set(complianceResults.flatMap(r => r.compliance.conflictingColors))];

    const overallCompliance = {
      totalCreatives,
      compliantCreatives,
      complianceRate: Math.round((compliantCreatives / totalCreatives) * 100),
      averageScore: Math.round(averageScore),
      conflictingColors: allConflictingColors,
      brandColors: brandColors
    };

    console.log('Brand compliance analysis completed:', overallCompliance);

    // Save compliance results to database
    try {
      // Delete existing compliance analyses for this campaign
      await BrandCompliance.deleteByCampaignId(campaignId);
      
      // Save each creative analysis
      const savedAnalyses = [];
      for (const analysis of complianceResults) {
        const complianceData = {
          campaignId: campaignId,
          productId: analysis.creative?.productId || null,
          creativeId: analysis.creativeId,
          creativeType: analysis.creative?.type || 'unknown',
          imageUrl: analysis.imageUrl,
          usesBrandColors: analysis.compliance.usesBrandColors,
          brandColorUsage: analysis.compliance.brandColorUsage,
          conflictingColors: analysis.compliance.conflictingColors,
          complianceScore: analysis.compliance.complianceScore,
          analysis: analysis.compliance.analysis,
          overallCompliance: overallCompliance,
          analyzedAt: analysis.analyzedAt
        };
        
        const savedAnalysis = await BrandCompliance.create(complianceData);
        savedAnalyses.push(savedAnalysis);
      }
      
      console.log(`Saved ${savedAnalyses.length} compliance analyses to database`);
    } catch (error) {
      console.error('Error saving compliance analyses to database:', error);
      // Continue with response even if database save fails
    }

    const response_data = {
      success: true,
      campaignId,
      overallCompliance,
      creativeAnalyses: complianceResults,
      analyzedAt: new Date().toISOString(),
      message: `Analyzed ${totalCreatives} creatives for brand compliance`
    };

    res.json(response_data);

  } catch (error) {
    console.error('Error analyzing brand compliance:', error);
    
    // Return appropriate error response
    if (error.message.includes('API key not configured')) {
      res.status(500).json({
        error: 'Google AI API key not configured',
        details: error.message
      });
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      res.status(429).json({
        error: 'API quota exceeded or rate limited',
        details: error.message
      });
    } else if (error.message.includes('timeout')) {
      res.status(408).json({
        error: 'Request timeout - compliance analysis took too long',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to analyze brand compliance',
        details: error.message,
        provider: 'Google Gemini'
      });
    }
  }
});

// Get brand compliance analysis results for a campaign
app.get('/api/campaigns/:campaignId/brand-compliance', async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({ 
        error: 'Campaign ID is required' 
      });
    }

    console.log('=== Get Brand Compliance Results Request ===');
    console.log('Campaign ID:', campaignId);
    console.log('==========================================');

    // Get all compliance analyses for this campaign
    const complianceAnalyses = await BrandCompliance.findByCampaignId(campaignId);
    
    if (complianceAnalyses.length === 0) {
      return res.json({
        success: true,
        campaignId,
        hasComplianceData: false,
        message: 'No brand compliance analysis found for this campaign'
      });
    }

    // Reconstruct the response format to match the analysis endpoint
    const creativeAnalyses = complianceAnalyses.map(analysis => ({
      creativeIndex: complianceAnalyses.indexOf(analysis) + 1,
      creativeId: analysis.creativeId,
      imageUrl: analysis.imageUrl,
      compliance: {
        usesBrandColors: analysis.usesBrandColors,
        brandColorUsage: analysis.brandColorUsage,
        conflictingColors: analysis.conflictingColors,
        complianceScore: analysis.complianceScore,
        analysis: analysis.analysis
      },
      analyzedAt: analysis.analyzedAt
    }));

    // Calculate overall compliance metrics from saved data
    const totalCreatives = complianceAnalyses.length;
    const compliantCreatives = complianceAnalyses.filter(a => a.usesBrandColors).length;
    const averageScore = complianceAnalyses.reduce((sum, a) => sum + a.complianceScore, 0) / totalCreatives;
    const allConflictingColors = [...new Set(complianceAnalyses.flatMap(a => a.conflictingColors))];

    const overallCompliance = {
      totalCreatives,
      compliantCreatives,
      complianceRate: Math.round((compliantCreatives / totalCreatives) * 100),
      averageScore: Math.round(averageScore),
      conflictingColors: allConflictingColors,
      brandColors: complianceAnalyses[0].overallCompliance.brandColors || []
    };

    const response_data = {
      success: true,
      campaignId,
      hasComplianceData: true,
      overallCompliance,
      creativeAnalyses,
      analyzedAt: complianceAnalyses[0].analyzedAt,
      message: `Retrieved brand compliance analysis for ${totalCreatives} creatives`
    };

    res.json(response_data);

  } catch (error) {
    console.error('Error retrieving brand compliance results:', error);
    res.status(500).json({
      error: 'Failed to retrieve brand compliance results',
      details: error.message
    });
  }
});

// Legal Content Review endpoint
app.post('/api/analyze-legal-content', async (req, res) => {
  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({ 
        error: 'Campaign ID is required' 
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_KEY in your .env file' 
      });
    }

    if (!openai) {
      return res.status(500).json({ 
        error: 'OpenAI service not initialized' 
      });
    }

    console.log('=== Legal Content Review Request ===');
    console.log('Campaign ID:', campaignId);
    console.log('===================================');

    // Get campaign data
    const Campaign = require('./models/Campaign');
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ 
        error: 'Campaign not found' 
      });
    }

    const campaignBrief = campaign.brief;
    const campaignMessage = campaignBrief.campaignMessage;
    const targetAudience = campaignBrief.targetAudience;
    const targetRegion = campaignBrief.targetRegion;

    if (!campaignMessage || !campaignMessage.trim()) {
      return res.status(400).json({ 
        error: 'Campaign message is required for legal content review' 
      });
    }

    // Get all localized messages for this campaign
    const localizedMessages = await LocalizedMessage.findByCampaignId(campaignId);
    console.log(`Found ${localizedMessages.length} localized messages for campaign ${campaignId}`);

    // Prepare all messages for analysis
    const messagesToAnalyze = [];
    
    // Add original message
    let originalLanguage = 'English';
    if (targetRegion) {
      const regionLanguageMap = {
        'United States': 'English',
        'United Kingdom': 'English',
        'Canada': 'English',
        'Australia': 'English',
        'Germany': 'German',
        'France': 'French',
        'Spain': 'Spanish',
        'Italy': 'Italian',
        'Brazil': 'Portuguese',
        'Mexico': 'Spanish',
        'Japan': 'Japanese',
        'China': 'Chinese',
        'South Korea': 'Korean',
        'India': 'English',
        'Netherlands': 'Dutch',
        'Sweden': 'Swedish',
        'Norway': 'Norwegian',
        'Denmark': 'Danish',
        'Finland': 'Finnish',
        'Poland': 'Polish',
        'Russia': 'Russian',
        'Turkey': 'Turkish',
        'Saudi Arabia': 'Arabic',
        'UAE': 'Arabic',
        'Egypt': 'Arabic',
        'South Africa': 'English',
        'Nigeria': 'English',
        'Kenya': 'English',
        'Argentina': 'Spanish',
        'Chile': 'Spanish',
        'Colombia': 'Spanish',
        'Peru': 'Spanish',
        'Venezuela': 'Spanish'
      };
      originalLanguage = regionLanguageMap[targetRegion] || 'English';
    }

    messagesToAnalyze.push({
      message: campaignMessage,
      language: originalLanguage,
      languageCode: 'en',
      isOriginal: true,
      targetAudience,
      targetRegion
    });

    // Add localized messages
    localizedMessages.forEach(localizedMsg => {
      messagesToAnalyze.push({
        message: localizedMsg.translatedMessage,
        language: localizedMsg.targetLanguage,
        languageCode: localizedMsg.languageCode,
        isOriginal: false,
        targetAudience,
        targetRegion
      });
    });

    console.log(`Analyzing legal content for ${messagesToAnalyze.length} messages:`, {
      original: 1,
      localized: localizedMessages.length,
      targetAudience,
      targetRegion
    });

    // Analyze each message
    const messageAnalyses = [];
    
    for (const msgData of messagesToAnalyze) {
      console.log(`Analyzing ${msgData.isOriginal ? 'original' : 'localized'} message in ${msgData.language}...`);
      
      // Create the prompt for OpenAI
      const prompt = `You are a legal content reviewer specializing in marketing and advertising compliance. Please analyze the following campaign message for legal appropriateness and regulatory compliance.

CAMPAIGN DETAILS:
- Message: "${msgData.message}"
- Target Audience: "${msgData.targetAudience || 'General audience'}"
- Target Market/Region: "${msgData.targetRegion || 'Global'}"
- Language: "${msgData.language}"
- Message Type: ${msgData.isOriginal ? 'Original' : 'Localized'}

Please provide a comprehensive legal content review that includes:

1. APPROPRIATENESS ASSESSMENT: Is this content appropriate for the target audience and market?
2. PROHIBITED CONTENT CHECK: Does this content contain any prohibited words, phrases, or concepts that could violate advertising standards?
3. RISK LEVEL: What is the legal risk level (LOW, MEDIUM, HIGH)?
4. REGULATORY COMPLIANCE: Are there any potential regulatory issues for the target market?
5. RECOMMENDATIONS: Specific recommendations for improvement if needed.

Please respond in the following JSON format:
{
  "isAppropriate": true/false,
  "prohibitedWords": ["list", "of", "prohibited", "words", "if", "any"],
  "riskLevel": "LOW/MEDIUM/HIGH",
  "recommendations": "Detailed recommendations for improvement",
  "analysis": "Comprehensive analysis of legal compliance and appropriateness"
}

Focus on:
- Truth in advertising laws
- Consumer protection regulations
- Industry-specific regulations (if applicable)
- Cultural sensitivity for the target market
- Age-appropriate content for the target audience
- Prohibited claims or misleading statements
- Compliance with advertising standards in the target region
- Language-specific legal requirements`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a legal content reviewer with expertise in marketing and advertising compliance across different markets and cultures. Provide accurate, professional legal analysis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      const responseText = completion.choices[0].message.content;
      console.log(`OpenAI Legal Review Response for ${msgData.language}:`, responseText.substring(0, 200) + '...');

      // Parse the JSON response
      let legalAnalysis;
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          legalAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.error('Raw response:', responseText);
        
        // Fallback analysis if JSON parsing fails
        legalAnalysis = {
          isAppropriate: true,
          prohibitedWords: [],
          riskLevel: "MEDIUM",
          recommendations: "Unable to parse AI analysis. Please review content manually.",
          analysis: responseText || "Legal content review completed but analysis could not be parsed properly."
        };
      }

      // Ensure all required fields are present
      const finalAnalysis = {
        isAppropriate: legalAnalysis.isAppropriate !== undefined ? legalAnalysis.isAppropriate : true,
        prohibitedWords: Array.isArray(legalAnalysis.prohibitedWords) ? legalAnalysis.prohibitedWords : [],
        riskLevel: legalAnalysis.riskLevel || "MEDIUM",
        recommendations: legalAnalysis.recommendations || "No specific recommendations provided.",
        analysis: legalAnalysis.analysis || "Legal content review completed."
      };

      messageAnalyses.push({
        ...msgData,
        legalAnalysis: finalAnalysis
      });
    }

    console.log(`Completed analysis for ${messageAnalyses.length} messages`);

    // Save legal content reviews to database
    try {
      // Delete existing legal content reviews for this campaign
      await LegalContentReview.deleteByCampaignId(campaignId);
      
      // Save each message analysis
      const savedReviews = [];
      for (const msgAnalysis of messageAnalyses) {
        const reviewData = {
          campaignId: campaignId,
          messageContent: msgAnalysis.message,
          targetAudience: msgAnalysis.targetAudience || 'General audience',
          targetMarket: msgAnalysis.targetRegion || 'Global',
          language: msgAnalysis.language,
          languageCode: msgAnalysis.languageCode,
          isOriginalMessage: msgAnalysis.isOriginal,
          isAppropriate: msgAnalysis.legalAnalysis.isAppropriate,
          prohibitedWords: msgAnalysis.legalAnalysis.prohibitedWords,
          riskLevel: msgAnalysis.legalAnalysis.riskLevel,
          recommendations: msgAnalysis.legalAnalysis.recommendations,
          analysis: msgAnalysis.legalAnalysis.analysis,
          analyzedAt: new Date().toISOString()
        };
        
        const savedReview = await LegalContentReview.create(reviewData);
        savedReviews.push(savedReview);
      }
      
      console.log(`Saved ${savedReviews.length} legal content reviews to database`);
    } catch (error) {
      console.error('Error saving legal content reviews to database:', error);
      // Continue with response even if database save fails
    }

    // Calculate overall statistics
    const totalMessages = messageAnalyses.length;
    const appropriateMessages = messageAnalyses.filter(msg => msg.legalAnalysis.isAppropriate).length;
    const highRiskMessages = messageAnalyses.filter(msg => msg.legalAnalysis.riskLevel === 'HIGH').length;
    const allProhibitedWords = [...new Set(messageAnalyses.flatMap(msg => msg.legalAnalysis.prohibitedWords))];

    const response_data = {
      success: true,
      campaignId,
      targetAudience: targetAudience || 'General audience',
      targetMarket: targetRegion || 'Global',
      totalMessages,
      appropriateMessages,
      highRiskMessages,
      allProhibitedWords,
      messageAnalyses: messageAnalyses.map(msg => ({
        message: msg.message,
        language: msg.language,
        languageCode: msg.languageCode,
        isOriginal: msg.isOriginal,
        legalAnalysis: msg.legalAnalysis
      })),
      overallSummary: {
        totalMessages,
        appropriateMessages,
        inappropriateMessages: totalMessages - appropriateMessages,
        highRiskMessages,
        mediumRiskMessages: messageAnalyses.filter(msg => msg.legalAnalysis.riskLevel === 'MEDIUM').length,
        lowRiskMessages: messageAnalyses.filter(msg => msg.legalAnalysis.riskLevel === 'LOW').length,
        allProhibitedWords
      },
      analyzedAt: new Date().toISOString(),
      message: `Legal content review completed for ${totalMessages} messages successfully`
    };

    res.json(response_data);

  } catch (error) {
    console.error('Error in legal content review:', error);
    res.status(500).json({
      error: 'Failed to analyze legal content',
      details: error.message,
      provider: 'OpenAI GPT-4'
    });
  }
});

// Get legal content review results for a campaign
app.get('/api/campaigns/:campaignId/legal-content-review', async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({ 
        error: 'Campaign ID is required' 
      });
    }

    console.log('=== Get Legal Content Review Results Request ===');
    console.log('Campaign ID:', campaignId);
    console.log('==============================================');

    // Get legal content review for this campaign
    const legalReviews = await LegalContentReview.findByCampaignId(campaignId);
    
    if (legalReviews.length === 0) {
      return res.json({
        success: true,
        campaignId,
        hasLegalReviewData: false,
        message: 'No legal content review found for this campaign'
      });
    }

    // Group reviews by language and organize data
    const messageAnalyses = legalReviews.map(review => ({
      message: review.messageContent,
      language: review.language,
      languageCode: review.languageCode,
      isOriginal: review.isOriginalMessage,
      legalAnalysis: {
        isAppropriate: review.isAppropriate,
        prohibitedWords: review.prohibitedWords,
        riskLevel: review.riskLevel,
        recommendations: review.recommendations,
        analysis: review.analysis
      }
    }));

    // Calculate overall statistics
    const totalMessages = messageAnalyses.length;
    const appropriateMessages = messageAnalyses.filter(msg => msg.legalAnalysis.isAppropriate).length;
    const highRiskMessages = messageAnalyses.filter(msg => msg.legalAnalysis.riskLevel === 'HIGH').length;
    const allProhibitedWords = [...new Set(messageAnalyses.flatMap(msg => msg.legalAnalysis.prohibitedWords))];

    const response_data = {
      success: true,
      campaignId,
      hasLegalReviewData: true,
      targetAudience: legalReviews[0].targetAudience,
      targetMarket: legalReviews[0].targetMarket,
      totalMessages,
      appropriateMessages,
      highRiskMessages,
      allProhibitedWords,
      messageAnalyses,
      overallSummary: {
        totalMessages,
        appropriateMessages,
        inappropriateMessages: totalMessages - appropriateMessages,
        highRiskMessages,
        mediumRiskMessages: messageAnalyses.filter(msg => msg.legalAnalysis.riskLevel === 'MEDIUM').length,
        lowRiskMessages: messageAnalyses.filter(msg => msg.legalAnalysis.riskLevel === 'LOW').length,
        allProhibitedWords
      },
      analyzedAt: legalReviews[0].analyzedAt,
      message: `Retrieved legal content review for ${totalMessages} messages`
    };

    res.json(response_data);

  } catch (error) {
    console.error('Error retrieving legal content review results:', error);
    res.status(500).json({
      error: 'Failed to retrieve legal content review results',
      details: error.message
    });
  }
});

// Brand Logo Upload endpoint
app.post('/api/upload-brand-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file uploaded' });
    }

    if (!dropboxService.isAvailable()) {
      return res.status(500).json({ 
        error: 'Dropbox service not configured',
        message: 'Dropbox OAuth credentials not configured on server'
      });
    }

    // Get account and ensure Dropbox token is valid
    const account = await Account.find();
    if (!account || !account.dropboxAccessToken) {
      return res.status(400).json({ 
        error: 'No Dropbox access token found. Please authenticate with Dropbox first.' 
      });
    }

    // Ensure token is valid (refresh if necessary)
    const validAccount = await dropboxService.ensureValidToken(account);

    // Read the uploaded file content
    const fileContent = fs.readFileSync(req.file.path);
    
    // Upload to Dropbox with a specific path for brand logos
    const dropboxPath = `brand-logos/brand_logo_${Date.now()}.${path.extname(req.file.originalname).slice(1)}`;
    const uploadResult = await dropboxService.uploadFileContent(
      validAccount.dropboxAccessToken,
      fileContent,
      path.basename(dropboxPath),
      req.file.mimetype,
      {
        originalName: req.file.originalname,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        type: 'brand_logo'
      }
    );

    // Update account with new brand logo URL
    const updatedAccount = await account.update({
      brandLogo: uploadResult.dropboxUrl + '&raw=1'
    });

    // Clean up local file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      brandLogoUrl: uploadResult.dropboxUrl + '&raw=1',
      dropboxPath: uploadResult.dropboxPath,
      account: updatedAccount.toJSON(),
      message: 'Brand logo uploaded and saved successfully'
    });

    console.log('Brand logo uploaded successfully:', {
      filename: req.file.originalname,
      size: req.file.size,
      dropboxPath: uploadResult.dropboxPath,
      brandLogoUrl: uploadResult.dropboxUrl + '&raw=1'
    });

  } catch (error) {
    console.error('Error uploading brand logo:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to upload brand logo',
      details: error.message 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🗄️  SQLite database initialized`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    dbManager.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    dbManager.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

module.exports = app;
