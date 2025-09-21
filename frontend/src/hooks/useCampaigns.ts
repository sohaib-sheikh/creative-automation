import { useState, useEffect, useCallback } from 'react';
import { campaignService } from '../services/campaignService';
import { SavedCampaign } from '../types/campaign';
import { GeneratedCreative } from '../types/generatedCreative';
import { CampaignBrief } from '../types/campaignBrief';
import { Asset } from '../types/asset';

export interface UseCampaignsReturn {
  campaigns: SavedCampaign[];
  loading: boolean;
  error: string | null;
  
  // CRUD operations
  createCampaign: (brief: CampaignBrief, assets?: Asset[], status?: SavedCampaign['status'], generatedCreatives?: GeneratedCreative[]) => Promise<SavedCampaign>;
  updateCampaign: (id: string, updates: Partial<Omit<SavedCampaign, 'id' | 'createdAt'>>) => Promise<SavedCampaign>;
  deleteCampaign: (id: string) => Promise<void>;
  getCampaignById: (id: string) => Promise<SavedCampaign | null>;
  
  // Asset operations
  addAsset: (campaignId: string, asset: Asset) => Promise<SavedCampaign>;
  removeAsset: (campaignId: string, assetId: string) => Promise<SavedCampaign>;
  
  // Creative operations
  addCreative: (campaignId: string, creative: GeneratedCreative) => Promise<SavedCampaign>;
  removeCreative: (campaignId: string, creativeId: string) => Promise<SavedCampaign>;
  
  // Filtering and searching
  searchCampaigns: (query: string) => Promise<SavedCampaign[]>;
  getCampaignsByStatus: (status: SavedCampaign['status']) => Promise<SavedCampaign[]>;
  
  // Data operations
  refreshCampaigns: () => Promise<void>;
  
  // Utility
  clearError: () => void;
}

export function useCampaigns(): UseCampaignsReturn {
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load campaigns from API
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load campaigns from API
        const response = await campaignService.getAllCampaigns();
        setCampaigns(response.campaigns);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, []);


  const createCampaign = useCallback(async (
    brief: CampaignBrief,
    assets: Asset[] = [],
    status: SavedCampaign['status'] = 'draft',
    generatedCreatives: GeneratedCreative[] = []
  ): Promise<SavedCampaign> => {
    try {
      setError(null);
      
      // Create via API
      const response = await campaignService.createCampaign({
        brief,
        assets,
        generatedCreatives,
        status
      });

      // Update local state
      setCampaigns(prev => [response.campaign, ...prev]);
      
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create campaign';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateCampaign = useCallback(async (
    id: string,
    updates: Partial<Omit<SavedCampaign, 'id' | 'createdAt'>>
  ): Promise<SavedCampaign> => {
    try {
      setError(null);

      // Update via API
      const response = await campaignService.updateCampaign(id, updates);

      // Update local state
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === id ? response.campaign : campaign
      ));
      
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update campaign';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const deleteCampaign = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      
      // Delete via API
      await campaignService.deleteCampaign(id);

      // Update local state
      setCampaigns(prev => prev.filter(campaign => campaign.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete campaign';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getCampaignById = useCallback(async (id: string): Promise<SavedCampaign | null> => {
    try {
      setError(null);
      const response = await campaignService.getCampaignById(id);
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get campaign';
      setError(errorMessage);
      return null;
    }
  }, []);

  const addAsset = useCallback(async (campaignId: string, asset: Asset): Promise<SavedCampaign> => {
    try {
      setError(null);
      
      // Get the current campaign
      const currentCampaign = await getCampaignById(campaignId);
      if (!currentCampaign) {
        throw new Error('Campaign not found');
      }

      // Add the asset to the campaign's assets array
      const updatedAssets = [...currentCampaign.assets, asset];

      // Update the campaign via API
      const response = await campaignService.updateCampaign(campaignId, {
        assets: updatedAssets
      });

      // Update local state
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? response.campaign : campaign
      ));
      
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add asset';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getCampaignById]);

  const removeAsset = useCallback(async (campaignId: string, assetId: string): Promise<SavedCampaign> => {
    try {
      setError(null);
      
      // Get the current campaign
      const currentCampaign = await getCampaignById(campaignId);
      if (!currentCampaign) {
        throw new Error('Campaign not found');
      }

      // Remove the asset from the campaign's assets array
      const updatedAssets = currentCampaign.assets.filter(asset => asset.id !== assetId);

      // Update the campaign via API
      const response = await campaignService.updateCampaign(campaignId, {
        assets: updatedAssets
      });

      // Update local state
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? response.campaign : campaign
      ));
      
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove asset';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getCampaignById]);

  const addCreative = useCallback(async (campaignId: string, creative: GeneratedCreative): Promise<SavedCampaign> => {
    try {
      setError(null);
      
      // Get the current campaign
      const currentCampaign = await getCampaignById(campaignId);
      if (!currentCampaign) {
        throw new Error('Campaign not found');
      }

      // Add the creative to the campaign's generatedCreatives array
      const updatedCreatives = [...currentCampaign.generatedCreatives, creative];

      // Update the campaign via API
      const response = await campaignService.updateCampaign(campaignId, {
        generatedCreatives: updatedCreatives
      });

      // Update local state
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? response.campaign : campaign
      ));
      
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add creative';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getCampaignById]);

  const removeCreative = useCallback(async (campaignId: string, creativeId: string): Promise<SavedCampaign> => {
    try {
      setError(null);
      
      // Get the current campaign
      const currentCampaign = await getCampaignById(campaignId);
      if (!currentCampaign) {
        throw new Error('Campaign not found');
      }

      // Remove the creative from the campaign's generatedCreatives array
      const updatedCreatives = currentCampaign.generatedCreatives.filter(creative => creative.id !== creativeId);

      // Update the campaign via API
      const response = await campaignService.updateCampaign(campaignId, {
        generatedCreatives: updatedCreatives
      });

      // Update local state
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? response.campaign : campaign
      ));
      
      return response.campaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove creative';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getCampaignById]);

  const searchCampaigns = useCallback(async (query: string): Promise<SavedCampaign[]> => {
    try {
      setError(null);
      const response = await campaignService.searchCampaigns(query);
      return response.campaigns;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search campaigns';
      setError(errorMessage);
      return [];
    }
  }, []);

  const getCampaignsByStatusCallback = useCallback(async (status: SavedCampaign['status']): Promise<SavedCampaign[]> => {
    try {
      setError(null);
      const response = await campaignService.getCampaignsByStatus(status);
      return response.campaigns;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get campaigns by status';
      setError(errorMessage);
      return [];
    }
  }, []);

  const refreshCampaigns = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await campaignService.getAllCampaigns();
      setCampaigns(response.campaigns);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh campaigns';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    campaigns,
    loading,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignById,
    addAsset,
    removeAsset,
    addCreative,
    removeCreative,
    searchCampaigns,
    getCampaignsByStatus: getCampaignsByStatusCallback,
    refreshCampaigns,
    clearError,
  };
}
