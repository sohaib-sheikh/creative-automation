import { CampaignBrief } from '../types/campaignBrief';
import { Asset } from '../types/asset';
import { SavedCampaign } from '../types/campaign';
import { GeneratedCreative } from '../types/generatedCreative';

// API base URL - adjust this to match your backend URL
const API_BASE_URL = 'http://localhost:5002/api';


export interface CampaignCreateRequest {
  brief: CampaignBrief;
  assets?: Asset[];
  generatedCreatives?: GeneratedCreative[];
  status?: 'draft' | 'generated' | 'published';
}

export interface CampaignUpdateRequest {
  brief?: CampaignBrief;
  assets?: Asset[];
  generatedCreatives?: GeneratedCreative[];
  status?: 'draft' | 'generated' | 'published';
}

export interface CampaignsResponse {
  campaigns: SavedCampaign[];
  count: number;
}

export interface CampaignResponse {
  campaign: SavedCampaign;
  message?: string;
}

// API service functions
export const campaignService = {
  // Get all campaigns with optional filtering
  async getAllCampaigns(params?: {
    status?: SavedCampaign['status'];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<CampaignsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const url = `${API_BASE_URL}/campaigns${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      return {
        campaigns: data.campaigns,
        count: data.count
      };
    } catch (error) {
      throw new Error(`Failed to fetch campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Get a single campaign by ID
  async getCampaignById(id: string): Promise<CampaignResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Campaign not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch campaign');
      }

      return {
        campaign: data.campaign,
        message: data.message || 'Campaign retrieved successfully'
      };
    } catch (error) {
      throw new Error(`Failed to fetch campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Create a new campaign
  async createCampaign(data: CampaignCreateRequest): Promise<CampaignResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brief: data.brief,
          assets: data.assets || [],
          generatedCreatives: [],
          status: data.status || 'draft'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to create campaign');
      }

      return {
        campaign: responseData.campaign,
        message: responseData.message || 'Campaign created successfully'
      };
    } catch (error) {
      throw new Error(`Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Update an existing campaign
  async updateCampaign(id: string, data: CampaignUpdateRequest): Promise<CampaignResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Campaign not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to update campaign');
      }

      return {
        campaign: responseData.campaign,
        message: responseData.message || 'Campaign updated successfully'
      };
    } catch (error) {
      throw new Error(`Failed to update campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Delete a campaign
  async deleteCampaign(id: string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Campaign not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to delete campaign');
      }

      return { message: responseData.message || 'Campaign deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Get campaigns by status
  async getCampaignsByStatus(status: SavedCampaign['status']): Promise<CampaignsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/status/${status}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch campaigns by status');
      }

      return {
        campaigns: data.campaigns,
        count: data.count
      };
    } catch (error) {
      throw new Error(`Failed to fetch campaigns by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Search campaigns
  async searchCampaigns(query: string): Promise<CampaignsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/search/${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to search campaigns');
      }

      return {
        campaigns: data.campaigns,
        count: data.count
      };
    } catch (error) {
      throw new Error(`Failed to search campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Get campaign statistics
  async getCampaignStats(): Promise<{
    total: number;
    draft: number;
    generated: number;
    published: number;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/stats/overview`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch campaign statistics');
      }

      return data.stats;
    } catch (error) {
      throw new Error(`Failed to fetch campaign statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Delete a specific generated creative from a campaign
  async deleteGeneratedCreative(campaignId: string, creativeId: string): Promise<{ message: string; deletedCreativeId: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/creatives/${creativeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Generated creative not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to delete generated creative');
      }

      return { 
        message: responseData.message || 'Generated creative deleted successfully',
        deletedCreativeId: responseData.deletedCreativeId
      };
    } catch (error) {
      throw new Error(`Failed to delete generated creative: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

// Error handling utility
export class CampaignServiceError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'CampaignServiceError';
  }
}
