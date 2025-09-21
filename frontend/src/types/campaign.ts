import { CampaignBrief } from './campaignBrief';
import { Asset } from './asset';
import { GeneratedCreative } from './generatedCreative';


export interface SavedCampaign {
    id: string;
    brief: CampaignBrief;
    assets: Asset[];
    generatedCreatives: GeneratedCreative[]; // Store generated creative assets
    createdAt: string;
    updatedAt: string;
    status: 'draft' | 'generated' | 'published';
  }