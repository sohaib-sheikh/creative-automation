import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ImageWithFallback } from './ui/ImageWithFallback';
import { CampaignBrief } from '../types/campaignBrief';
import { Asset } from '../types/asset';
import { GeneratedCreative } from '../types/generatedCreative';
import { LocalizedMessage } from '../types/localizedMessage';
import { TranslationService } from '../services/translationService';
import { 
  Package, 
  Image as ImageIcon, 
  MessageSquare, 
  Globe, 
  CheckCircle, 
  AlertCircle,
  Smartphone,
  Monitor,
  Square,
  Loader2,
  Plus,
  Minus,
  Eye
} from 'lucide-react';

interface FinalReviewStepProps {
  campaignBrief: CampaignBrief;
  assets: Asset[];
  generatedCreatives: GeneratedCreative[];
  campaignId: string | null;
}

interface PlatformMockupProps {
  aspectRatio: string;
  imageUrl: string;
  campaignText: string;
  platform: string;
}

function PlatformMockup({ aspectRatio, imageUrl, campaignText, platform }: PlatformMockupProps) {
  const getMockupStyle = () => {
    switch (aspectRatio) {
      case '1:1':
        return {
          container: 'h-32 w-full',
          image: 'w-full h-full object-cover rounded-lg',
          icon: Square,
          platformName: 'Instagram Post'
        };
      case '9:16':
        return {
          container: 'h-36 w-full',
          image: 'w-full h-full object-cover rounded-lg',
          icon: Smartphone,
          platformName: 'Instagram Story'
        };
      case '16:9':
        return {
          container: 'h-24 w-full',
          image: 'w-full h-full object-cover rounded-lg',
          icon: Monitor,
          platformName: 'Facebook Ad'
        };
      default:
        return {
          container: 'h-32 w-full',
          image: 'w-full h-full object-cover rounded-lg',
          icon: Square,
          platformName: 'Social Media'
        };
    }
  };

  const handleViewImage = () => {
    window.open(imageUrl, '_blank');
  };

  const mockup = getMockupStyle();
  const IconComponent = mockup.icon;

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className={`${mockup.container} border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 relative group cursor-pointer`}>
        <ImageWithFallback
          src={imageUrl}
          alt="Creative preview"
          className={mockup.image}
          fallbackClassName={mockup.image}
        />
        
        {/* Overlay with click handler */}
        <div 
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          onClick={handleViewImage}
        >
          <Button 
            size="sm" 
            variant="secondary" 
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleViewImage();
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
        
        {/* <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
          {campaignText.substring(0, 20)}...
        </div> */}
      </div>
      <div className="flex items-center space-x-1">
        <IconComponent className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{mockup.platformName}</span>
      </div>
    </div>
  );
}

export function FinalReviewStep({ campaignBrief, assets, generatedCreatives, campaignId }: FinalReviewStepProps) {
  const [localizedMessages, setLocalizedMessages] = useState<LocalizedMessage[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('original');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // State for expand/collapse functionality
  const [isCampaignOverviewExpanded, setIsCampaignOverviewExpanded] = useState(false);
  const [isProductsCreativesExpanded, setIsProductsCreativesExpanded] = useState(false);
  const [isCampaignMessageExpanded, setIsCampaignMessageExpanded] = useState(false);

  // Fetch localized messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!campaignId) return;
      
      try {
        setIsLoadingMessages(true);
        const messages = await TranslationService.getLocalizedMessages(campaignId);
        setLocalizedMessages(messages);
      } catch (error) {
        console.error('Error fetching localized messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [campaignId]);

  const getDisplayMessage = () => {
    if (selectedLanguage === 'original') {
      return campaignBrief.campaignMessage;
    }
    
    const message = localizedMessages.find(msg => msg.languageCode === selectedLanguage);
    return message?.translatedMessage || campaignBrief.campaignMessage;
  };

  const getLanguageName = (code: string) => {
    if (code === 'original') return 'Original';
    const message = localizedMessages.find(msg => msg.languageCode === code);
    return message?.targetLanguage || code;
  };

  // Group creatives by product
  const creativesByProduct = generatedCreatives.reduce((acc, creative) => {
    if (!acc[creative.productId]) {
      acc[creative.productId] = [];
    }
    acc[creative.productId].push(creative);
    return acc;
  }, {} as Record<string, GeneratedCreative[]>);

  // Group assets by product
  const assetsByProduct = assets.reduce((acc, asset) => {
    if (asset.productId) {
      if (!acc[asset.productId]) {
        acc[asset.productId] = [];
      }
      acc[asset.productId].push(asset);
    }
    return acc;
  }, {} as Record<string, Asset[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Final Review</h3>
              <p className="text-muted-foreground">
                Review all aspects of your campaign before launching. This is your final opportunity to make any adjustments.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-primary mr-3" />
                <h4 className="text-lg font-medium">Campaign Overview</h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCampaignOverviewExpanded(!isCampaignOverviewExpanded)}
                className="h-8 w-8 p-0"
              >
                {isCampaignOverviewExpanded ? (
                  <Minus className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {isCampaignOverviewExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Campaign Name</label>
                  <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                    {campaignBrief.name}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Target Region</label>
                  <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                    {campaignBrief.targetRegion}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Target Audience</label>
                  <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                    {campaignBrief.targetAudience}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Products</label>
                  <div className="mt-1 space-y-2">
                    {campaignBrief.products.map((product) => (
                      <div key={product.id} className="p-3 bg-muted/50 rounded-md relative">
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{product.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products and Creatives */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-primary mr-3" />
                <h4 className="text-lg font-medium">Products & Creatives</h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsProductsCreativesExpanded(!isProductsCreativesExpanded)}
                className="h-8 w-8 p-0"
              >
                {isProductsCreativesExpanded ? (
                  <Minus className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {isProductsCreativesExpanded && (
              <div className="transition-all duration-300 space-y-4">
                {campaignBrief.products.map((product) => {
                  const productCreatives = creativesByProduct[product.id] || [];
                  const productAssets = assetsByProduct[product.id] || [];
                  
                  return (
                    <div key={product.id} className="border rounded-lg p-4 space-y-4">
                      <div className="relative">
                        <h5 className="font-medium">{product.name}</h5>
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                        <div className="absolute top-0 right-0 text-xs text-muted-foreground" style={{ textTransform: 'capitalize' }}>
                          Category: {product.category}
                        </div>
                      </div>
                      
                      {productCreatives.length > 0 && (
                        <div>
                          <h6 className="text-sm font-medium mb-3">Generated Creatives</h6>
                          <div className="grid grid-cols-3 gap-4">
                            {productCreatives.map((creative) => (
                              <PlatformMockup
                                key={creative.id}
                                aspectRatio={creative.aspectRatio}
                                imageUrl={creative.imageUrl}
                                campaignText={creative.campaignText}
                                platform={creative.platform || 'social'}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* {productAssets.length > 0 && (
                        <div>
                          <h6 className="text-sm font-medium mb-3">Uploaded Assets</h6>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {productAssets.map((asset) => (
                              <div key={asset.id} className="flex flex-col items-center space-y-2">
                                <div className="w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 relative group cursor-pointer">
                                  <ImageWithFallback
                                    src={asset.imageUrl}
                                    alt="Uploaded asset"
                                    className="w-full h-full object-cover"
                                    fallbackClassName="w-full h-full"
                                  />
                                  
                                  <div 
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    onClick={() => window.open(asset.imageUrl, '_blank')}
                                  >
                                    <Button 
                                      size="sm" 
                                      variant="secondary" 
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(asset.imageUrl, '_blank');
                                      }}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )} */}
                      
                      {productCreatives.length === 0 && productAssets.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">No creatives or assets for this product</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Message */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-primary mr-3" />
                <h4 className="text-lg font-medium">Campaign Message</h4>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCampaignMessageExpanded(!isCampaignMessageExpanded)}
                className="h-8 w-8 p-0"
              >
                {isCampaignMessageExpanded ? (
                  <Minus className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {isCampaignMessageExpanded && (
              <div className="transition-all duration-300">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading translations...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {localizedMessages.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground mr-4">Language: </span>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="text-sm border border-input rounded-md px-3 py-1 bg-input-background mr-4"
                        >
                          <option value="original">Original ({campaignBrief.localization.primaryLanguage})</option>
                          {localizedMessages.map((message) => (
                            <option key={message.id} value={message.languageCode}>
                              {message.targetLanguage}
                            </option>
                          ))}
                        </select>
                        <Globe className="w-4 h-4 text-muted-foreground ml-2" />
                        <span className="text-sm text-muted-foreground ml-2">
                          Available in {localizedMessages.length + 1} language{localizedMessages.length + 1 !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Message ({getLanguageName(selectedLanguage)})
                      </label>
                      <div className="mt-1 p-4 bg-muted/50 rounded-md min-h-[100px]">
                        <p className="text-sm whitespace-pre-wrap">
                          {getDisplayMessage() || 'No campaign message available'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
