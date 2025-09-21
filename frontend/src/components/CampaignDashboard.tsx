import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { SavedCampaign } from '../types/campaign';
import { CampaignBrief } from '../types/campaignBrief';
import { CampaignCreationModal } from './CampaignCreationModal';
import { SettingsModal } from './SettingsModal';
import { JsonImportModal } from './JsonImportModal';
import { useCampaigns } from '../hooks/useCampaigns';
import { TranslationService } from '../services/translationService';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Target, 
  TrendingUp, 
  Edit,
  Trash2,
  Sparkles,
  Settings,
  FileText,
  Package,
  FolderOpen,
  Palette,
  Globe
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';




export function CampaignDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isJsonImportModalOpen, setIsJsonImportModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<SavedCampaign | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [loadingEditCampaign, setLoadingEditCampaign] = useState<string | null>(null);
  const [localizedMessagesCounts, setLocalizedMessagesCounts] = useState<Record<string, number>>({});

  const {
    campaigns,
    loading: campaignsLoading,
    error: campaignsError,
    getCampaignById,
    deleteCampaign,
    refreshCampaigns,
    clearError,
    createCampaign
  } = useCampaigns(); 

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.brief.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.brief.targetRegion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.brief.products.some(product => 
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Fetch localized messages counts for all campaigns
  const fetchLocalizedMessagesCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    
    for (const campaign of campaigns) {
      try {
        const messages = await TranslationService.getLocalizedMessages(campaign.id);
        counts[campaign.id] = messages.length;
      } catch (error) {
        console.error(`Error fetching localized messages for campaign ${campaign.id}:`, error);
        counts[campaign.id] = 0;
      }
    }
    
    setLocalizedMessagesCounts(counts);
  }, [campaigns]);

  // Fetch localized messages counts when campaigns change
  useEffect(() => {
    if (campaigns.length > 0) {
      fetchLocalizedMessagesCounts();
    }
  }, [campaigns, fetchLocalizedMessagesCounts]);

  const handleCreateCampaign = () => {
    setIsCreateModalOpen(false);
  };

  const handleJsonImport = async (brief: CampaignBrief) => {
    try {
      // Create the campaign from the imported JSON
      const createdCampaign = await createCampaign(brief, [], 'draft', []);
      
      // Set the created campaign for editing and open the edit modal
      setEditingCampaign(createdCampaign);
      setIsEditModalOpen(true);
      
      // Refresh campaigns list
      await refreshCampaigns();
    } catch (error) {
      console.error('Failed to create campaign from JSON:', error);
    }
  };

  const handleEditCampaign = async (campaign: SavedCampaign) => {
    try {
      setLoadingEditCampaign(campaign.id);
      
      const freshCampaign = await getCampaignById(campaign.id);
      
      if (freshCampaign) {
        setEditingCampaign(freshCampaign);
        setIsEditModalOpen(true);
      } else {
        console.error('Campaign not found in database');
        // Fallback to cached data if fresh data is not available
        setEditingCampaign(campaign);
        setIsEditModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to reload campaign for editing:', error);
      // Fallback to cached data if reload fails
      setEditingCampaign(campaign);
      setIsEditModalOpen(true);
    } finally {
      setLoadingEditCampaign(null);
    }
  };

  const handleUpdateCampaign = () => {
    setIsEditModalOpen(false);
    setEditingCampaign(null);
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      setDeletingCampaignId(id);
      await deleteCampaign(id);
      // Refresh campaigns after deletion
      await refreshCampaigns();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const getStatusBadge = (status: SavedCampaign['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'generated':
        return <Badge variant="default">Generated</Badge>;
      case 'published':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Published</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Generate chart data for campaign creation over time
  const generateChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    const data = last7Days.map(date => {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const campaignsCreated = campaigns.filter(campaign => {
        const campaignDate = new Date(campaign.createdAt);
        return campaignDate.toDateString() === date.toDateString();
      }).length;

      return {
        day: dayName,
        campaigns: campaignsCreated
      };
    });

    // Return empty data if no campaigns exist
    if (data.every(item => item.campaigns === 0)) {
      return data; // Return the actual data (all zeros) instead of mock data
    }

    return data;
  };

  const chartData = generateChartData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaign Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your creative automation campaigns
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setIsJsonImportModalOpen(true)}
          >
            <FileText className="w-4 h-4" />
            Create Campaign from JSON
          </Button>
          <Button 
            className="flex items-center gap-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Create New Campaign
          </Button>
        </div>
      </div>

      {/* Stats Overview and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Statistics Grid */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                  <p className="text-3xl font-bold text-gray-900">{campaigns.length}</p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <FolderOpen className="w-7 h-7 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Assets</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {campaigns.reduce((sum, campaign) => sum + (campaign.assets.length || 0), 0)}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <Target className="w-7 h-7 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {campaigns.reduce((sum, campaign) => sum + (campaign.brief.products.length || 0), 0)}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <Package className="w-7 h-7 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-orange-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Creatives</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {campaigns.reduce((sum, campaign) => sum + (campaign.generatedCreatives.length || 0), 0)}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <Palette className="w-7 h-7 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-indigo-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Localized Messages</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Object.values(localizedMessagesCounts).reduce((sum, count) => sum + count, 0)}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <Globe className="w-7 h-7 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Campaign Creation Chart */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-lg">Campaign Creation Trend</CardTitle>
            <p className="text-sm text-muted-foreground self-start ml-auto">Last 7 days</p>
          </CardHeader>
          <CardContent>            
            <div style={{ width: '100%', height: '256px' }}>
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="campaigns" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No chart data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCampaigns.map((campaign) => (
          <Card key={campaign.id} className="group hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{campaign.brief.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {campaign.brief.products.length} products • {campaign.brief.targetRegion}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(campaign.status)}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Campaign Message */}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {campaign.brief.campaignMessage}
              </p>

              {/* Products */}
              <div className="flex flex-wrap gap-2">
                {campaign.brief.products.slice(0, 3).map((product) => (
                  <Badge key={product.id} variant="secondary" className="text-xs">
                    {product.name}
                  </Badge>
                ))}
                {campaign.brief.products.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{campaign.brief.products.length - 3} more
                  </Badge>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                <div className="text-center">
                  <p className="text-sm font-medium">{campaign.assets.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Assets</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{campaign.generatedCreatives.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Creatives</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{campaign.brief.products.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{localizedMessagesCounts[campaign.id] || 0}</p>
                  <p className="text-xs text-muted-foreground">Languages</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Created {formatDate(campaign.createdAt)}
                </p>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleEditCampaign(campaign)}
                    disabled={loadingEditCampaign === campaign.id}
                  >
                    {loadingEditCampaign === campaign.id ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Edit className="w-4 h-4" />
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDeleteCampaign(campaign.id)}
                    disabled={deletingCampaignId === campaign.id}
                  >
                    {deletingCampaignId === campaign.id ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State - No Search Results */}
      {filteredCampaigns.length === 0 && searchQuery && (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">No campaigns found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search terms or filters
              </p>
            </div>
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {campaignsLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-5 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="text-center space-y-1">
                      <div className="h-4 bg-muted rounded w-8 mx-auto"></div>
                      <div className="h-3 bg-muted rounded w-12 mx-auto"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State - No Campaigns */}
      {!campaignsLoading && campaigns.length === 0 && (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Create your first campaign</h3>
              <p className="text-sm text-muted-foreground">
                Get started by creating a new creative automation campaign
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </Card>
      )}

      {/* Campaign Creation Modal */}
      <CampaignCreationModal
        isOpen={isCreateModalOpen}
        onClose={async () => {
          setIsCreateModalOpen(false);
          await refreshCampaigns();
        }}
        onComplete={handleCreateCampaign}
      />

      {/* Campaign Edit Modal */}
      <CampaignCreationModal
        isOpen={isEditModalOpen}
        onClose={async () => {
          setIsEditModalOpen(false);
          setEditingCampaign(null);
          await refreshCampaigns();
        }}
        onComplete={handleUpdateCampaign}
        editingCampaign={editingCampaign}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* JSON Import Modal */}
      <JsonImportModal
        isOpen={isJsonImportModalOpen}
        onClose={() => setIsJsonImportModalOpen(false)}
        onImport={handleJsonImport}
      />
    </div>
  );
}