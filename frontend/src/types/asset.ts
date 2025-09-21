/**
 * Asset Types
 * Common interfaces for uploaded and generated assets
 */

export interface Asset {
  id: string;
  type: 'uploaded' | 'generated' | 'creative';
  productId?: string;
  productName?: string;
  imageUrl: string;
  file?: File;
  dropboxPath?: string; // Dropbox path for the uploaded file
  dropboxUrl?: string; // Direct Dropbox URL
  campaignText?: string;
  aspectRatio?: string; // Aspect ratio like '1:1', '9:16', '16:9'
  provider?: string; // 'Google GenAI', 'Photoroom AI Expand', etc.
}

export interface GeneratedAsset {
  asset: Asset;
  dropboxPath: string;
  dropboxUrl: string;
  aspectRatio: string;
  provider: string;
}

export interface MultiAspectRatioResponse {
  success: boolean;
  assets: GeneratedAsset[];
  primaryAsset?: GeneratedAsset; // For backward compatibility
  asset?: Asset; // For backward compatibility
  dropboxPath?: string; // For backward compatibility
  dropboxUrl?: string; // For backward compatibility
  message: string;
}