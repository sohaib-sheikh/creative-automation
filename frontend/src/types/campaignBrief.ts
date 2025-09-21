export interface CampaignBrief {
    id: string;
    name: string;
    products: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
    }>;
    targetRegion: string;
    targetAudience: string;
    campaignMessage: string;
    localization: {
      primaryLanguage: string;
      additionalLanguages: string[];
    };
  }