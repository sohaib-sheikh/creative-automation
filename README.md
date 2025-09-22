# Creative Automation Pipeline

A full-stack web application that automates the creation of social media advertising campaigns using AI-powered image generation, content localization, and brand compliance checking.

## Table of Contents

- [How to Run](#how-to-run)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
  - [Environment Configuration](#environment-configuration)
  - [Manual Setup](#manual-setup)
  - [API Setup Instructions](#api-setup-instructions)
- [Example Input and Output](#example-input-and-output)
  - [Input: Campaign Brief](#input-campaign-brief)
  - [Output: Generated Campaign Assets](#output-generated-campaign-assets)
- [Key Design Decisions](#key-design-decisions)
  - [1. Modular Architecture](#1-modular-architecture)
  - [2. AI Service Integration Strategy](#2-ai-service-integration-strategy)
  - [3. Asset Management System](#3-asset-management-system)
  - [4. Campaign Workflow Design](#4-campaign-workflow-design)
  - [5. Brand Compliance Architecture](#5-brand-compliance-architecture)
- [Assumptions and Limitations](#assumptions-and-limitations)
  - [Assumptions](#assumptions)
  - [Limitations](#limitations)
  - [Cost Considerations](#cost-considerations)
  - [Security Notes](#security-notes)

## How to Run

### Prerequisites
- Node.js (v16 or higher)
- npm (comes with Node.js)

### Quick Start

1. **Clone and navigate to the project**

2. **Install all dependencies:**
   ```bash
   npm run install-all
   ```

3. **Configure environment variables** (see [Environment Configuration](#environment-configuration) section below)

4. **Start both frontend and backend:**
   ```bash
   npm run dev
   ```

   This starts:
   - Backend server on `http://localhost:5002`
   - Frontend development server on `http://localhost:3000`

### Environment Configuration

**⚠️ Important: Configure environment variables before starting the application**

Create a `.env` file in the `/backend` directory with:

```env
# Server Configuration
PORT=5002
NODE_ENV=development

# Google GenAI Configuration (Required for image generation)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# OpenAI Configuration (Required for message regeneration)
OPENAI_KEY=your_openai_api_key_here

# Dropbox Configuration (Optional - for cloud storage)
DROPBOX_CLIENT_ID=your_dropbox_app_key
DROPBOX_CLIENT_SECRET=your_dropbox_app_secret
DROPBOX_BASE_PATH=/

# Photoroom Configuration (Optional - for aspect ratio expansion)
PHOTOROOM_API_KEY=your_photoroom_api_key_here
```

### Manual Setup

If you prefer to start services individually:

1. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

2. **Start backend:**
   ```bash
   npm run server
   ```

3. **Start frontend (in new terminal):**
   ```bash
   npm run client
   ```

### API Setup Instructions

#### Google Gemini API Setup

**Google GenAI (Required for image generation):**
- Go to [Google AI Studio](https://aistudio.google.com/)
- Create a new API key
- Add it as `GOOGLE_AI_API_KEY` in your `.env` file

#### OpenAI API Setup

**OpenAI (Required for message generation and image analysis):**
- Go to [OpenAI Platform](https://platform.openai.com/)
- Create a new API key
- Add it as `OPENAI_KEY` in your `.env` file

#### Dropbox API Setup

1. **Create a Dropbox App:**
   - Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
   - Click "Create app"
   - Choose "Scoped access"
   - Select "Full Dropbox" access
   - Give your app a name (e.g., "Creative Automation Pipeline")

2. **Configure App Settings:**
   - In your app settings, go to the "Permissions" tab
   - Go to the "Settings" tab and add redirect URIs:
     - `http://localhost:3000/dropbox-callback.html` (for development)
     - `https://yourdomain.com/dropbox-callback.html` (for production)
   - Enable the following scopes:
     - `files.metadata.write` - Create and modify files
     - `files.metadata.read` - Read file metadata
     - `files.content.write` - Upload files
     - `files.content.read` - Download files
     - `sharing.write` - Create and manage shared links
     - `sharing.read` - Read shared links and folder information
     - Under "Connect" section, enable: `openid` - OpenID Connect authentication

3. **Get Your Credentials:**
   - Copy your "App key" (this is your `DROPBOX_CLIENT_ID`)
   - Copy your "App secret" (this is your `DROPBOX_CLIENT_SECRET`)
   - Add these to your `.env` file

4. **Test the Integration:**
   - Start your application
   - Go to Settings and click "Connect Dropbox"
   - Complete the OAuth flow
   - Your assets will now be automatically uploaded to Dropbox

#### PhotoRoom API Setup

1. **Create a PhotoRoom Account:**
   - Go to [PhotoRoom API](https://www.photoroom.com/api/)
   - Sign up for an account or log in

2. **Get Your API Key:**
   - Navigate to your API dashboard
   - Create a new API key
   - Copy the API key (this is your `PHOTOROOM_API_KEY`)
   - Add it to your `.env` file

3. **API Usage:**
   - PhotoRoom is used for aspect ratio expansion of generated images
   - The service automatically expands images to different aspect ratios (1:1, 9:16, 16:9)
   - Each expansion costs credits based on PhotoRoom's pricing

4. **Testing:**
   - Create a campaign with image generation
   - The system will automatically use PhotoRoom to create multiple aspect ratios
   - Check the generated assets to see the expanded versions

## Example Input and Output

### Input: Campaign Brief
```json
{
  "name": "Summer Sale Campaign",
  "products": [
    {
      "name": "Premium Headphones",
      "description": "High-quality wireless headphones with noise cancellation",
      "category": "Electronics"
    },
    {
      "name": "Smart Watch",
      "description": "Fitness tracking smartwatch with heart rate monitor",
      "category": "Wearables"
    }
  ],
  "targetRegion": "North America",
  "targetAudience": "Tech-savvy consumers aged 25-45",
  "campaignMessage": "Get ready for summer with our latest tech innovations! Save up to 30% on premium electronics.",
  "localization": {
    "primaryLanguage": "en",
    "additionalLanguages": ["es", "fr"]
  }
}
```

### Output: Generated Campaign Assets
The system generates:
- **AI-powered marketing creatives** in multiple aspect ratios (1:1, 9:16, 16:9)
- **Localized campaign messages** in multiple languages
- **Brand compliance analysis** with color usage scoring
- **Legal content validation** with prohibited word detection
- **Organized asset storage** in Dropbox with structured folder hierarchy

## Key Design Decisions

### 1. **Modular Architecture**
- **Frontend**: React 18 with TypeScript for type safety and modern development experience
- **Backend**: Express.js with Node.js for rapid API development
- **Database**: SQLite for lightweight, file-based storage with better-sqlite3 for performance
- **UI**: Tailwind CSS v4 with Shadcn/ui components for consistent, accessible design

### 2. **AI Service Integration Strategy**
- **Google GenAI**: Primary image generation using `gemini-2.5-flash-image-preview` model
- **OpenAI**: Campaign message regeneration and content optimization
- **Photoroom**: AI-powered aspect ratio expansion for multi-format output
- **Fallback Design**: Graceful degradation when services are unavailable

### 3. **Asset Management System**
- **Unified Asset Model**: Common data structure for both uploaded and generated assets
- **Storage**: Dropbox integration
- **Organized Structure**: Hierarchical folder organization by product and aspect ratio
- **OAuth Integration**: Secure Dropbox access with automatic token refresh

### 4. **Campaign Workflow Design**
- **Step-by-Step Process**: 6-stage campaign creation with validation at each step
- **Draft System**: Save campaigns as drafts for iterative refinement
- **Asset Reuse**: Check for existing assets before generating new ones
- **Real-time Preview**: Immediate feedback on generated content

### 5. **Brand Compliance Architecture**
- **Automated Analysis**: AI-powered brand color compliance checking
- **Legal Validation**: Prohibited word detection and content flagging
- **Scoring System**: Quantitative compliance metrics for quality assurance
- **Audit Trail**: Complete history of compliance analyses

## Assumptions and Limitations

### Assumptions
1. **API Key Availability**: Users have access to required API keys (Google AI, OpenAI, Dropbox, Photoroom)
2. **Image Format Support**: System assumes standard image formats (PNG, JPG, JPEG)
3. **Network Connectivity**: Reliable internet connection for AI service calls
4. **Storage Permissions**: Write access to local uploads directory and Dropbox (if configured)
5. **Browser Compatibility**: Modern browsers with JavaScript enabled

### Limitations
1. **API Rate Limits**: Subject to third-party service rate limits and quotas
2. **File Size Constraints**: 10MB upload limit for individual assets
3. **Language Support**: Translation quality depends on OpenAI's language model capabilities
4. **Brand Compliance**: AI analysis may not catch all brand guideline violations
5. **Aspect Ratio Generation**: Photoroom expansion requires additional API key and may fail
6. **Local Storage**: SQLite database is single-user and not suitable for production scaling
7. **Image Quality**: Generated images depend on AI model capabilities and prompt quality

### Cost Considerations
- **Google GenAI**: Pay-per-use for image generation
- **OpenAI**: Token-based pricing for message generation and translation
- **Photoroom**: Per-image pricing for aspect ratio expansion
- **Dropbox**: Storage and API call costs for cloud integration

### Security Notes
- API keys should never be committed to version control
- Environment variables should be kept secure and private
- Consider using environment-specific keys for different deployments
- Regularly rotate API keys for security
