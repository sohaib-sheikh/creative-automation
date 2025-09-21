export interface GeneratedCreative {
    id: string;
    productId: string;
    productName: string;
    aspectRatio: '1:1' | '9:16' | '16:9';
    imageUrl: string;
    campaignText: string;
    generatedAt: string;
    creativeType: 'social_post' | 'story_ad' | 'banner_ad';
    platform?: 'instagram' | 'facebook' | 'twitter' | 'linkedin';
    provider?: string; // 'Google GenAI', 'Photoroom AI Expand', etc.
    type: string; // 'social_post', 'story_ad', 'banner_ad'
    format: string; // '1:1', '9:16', '16:9'
    description: string;
    previewUrl: string;
    dropboxPath: string;
    dropboxUrl: string;
    asset: any; // Asset object
    status: string;
  }
  