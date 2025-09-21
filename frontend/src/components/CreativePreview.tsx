import React, { useState, useEffect } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { ImageWithFallback } from './ui/ImageWithFallback';
import { Download, Share2, Edit, Filter, Upload, Sparkles, Package, Wand2, RefreshCw, Trash2, Eye } from 'lucide-react';
import { Asset } from '../types/asset';
import { GeneratedCreative } from '../types/generatedCreative';
import { CampaignBrief } from '../types/campaignBrief';
import { campaignService } from '../services/campaignService';
import { dropboxService } from '../services/dropboxService';

interface CreativePreviewProps {
  assets: Asset[];
  generatedCreatives: GeneratedCreative[];
  campaignBrief: CampaignBrief;
  campaignId?: string;
  onCreativesGenerated?: (creatives: GeneratedCreative[], operation: 'add' | 'remove') => void;
}

export function CreativePreview({ assets, generatedCreatives, campaignBrief, campaignId, onCreativesGenerated }: CreativePreviewProps) {
  const [previewMode, setPreviewMode] = useState<'grid' | 'mockup'>('grid');
  const [generatingCreatives, setGeneratingCreatives] = useState<Record<string, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const [currentProductName, setCurrentProductName] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [creativeToDelete, setCreativeToDelete] = useState<GeneratedCreative | null>(null);

  useEffect(() => {
    console.log("generatedCreatives", generatedCreatives);
  }, [generatedCreatives]);


  // const downloadAll = () => {
  //   filteredAssets.forEach(asset => {
  //     const link = document.createElement('a');
  //     link.href = asset.imageUrl;
  //     link.download = `${asset.productName}_${asset.aspectRatio}_${asset.id}.jpg`;
  //     link.click();
  //   });
  // };

  const generateCreatives = async (productId: string, productName: string, instructions: string = '') => {
    setGeneratingCreatives(prev => ({ ...prev, [productId]: true }));
    
    try {
      // Get Dropbox access token
      const dropboxToken = await dropboxService.getValidToken();
      if (!dropboxToken) {
        alert('Please authenticate with Dropbox first to generate creatives. Go to Settings to connect your Dropbox account.');
        setGeneratingCreatives(prev => ({ ...prev, [productId]: false }));
        return;
      }

      console.log("allAssets", assets);

      // Get all asset URLs for this product
      const productAssets = assets.filter(asset => asset.productId === productId);


      console.log("productAssets", productAssets);

      const assetUrls = productAssets.map(asset => asset.imageUrl);
      
      const response = await fetch('/api/generate-creatives', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          productName,
          assetUrls,
          campaignBrief: {
            campaignMessage: campaignBrief.campaignMessage,
            targetAudience: campaignBrief.targetAudience
          },
          additionalPromptInstructions: instructions,
          accessToken: dropboxToken,
          campaignId: campaignId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate creatives');
      }

      const result = await response.json();
      console.log('Generated creatives:', result);
      
      // Process the generated creatives and add them to the state
      if (result.success && result.generatedCreatives && Array.isArray(result.generatedCreatives)) {

        console.log('Generated creatives:', result.generatedCreatives);
        const newGeneratedCreatives: GeneratedCreative[] = result.generatedCreatives.map((creative: any) => ({
          id: `${productId}-creative-${creative.aspectRatio || '1:1'}-${Date.now()}`,
          productId: productId,
          productName: productName,
          aspectRatio: creative.aspectRatio || '1:1',
          imageUrl: creative.previewUrl,
          campaignText: campaignBrief.campaignMessage || '',
          generatedAt: new Date().toISOString(),
          creativeType: creative.creativeType || 'ad',
          platform: creative.platform || 'instagram'
        }));

        console.log('New generated creatives:', newGeneratedCreatives);
        
        // Add the new creatives to the parent component's state
        onCreativesGenerated?.(newGeneratedCreatives, 'add');
        
        // alert(`Creatives generated successfully for ${productName}! ${newGeneratedCreatives.length} new creatives added.`);
      } else {
        alert(`Creatives generated successfully for ${productName}! Check the console for details.`);
      }
      
    } catch (error) {
      console.error('Error generating creatives:', error);
      alert('Failed to generate creatives. Please try again.');
    } finally {
      setGeneratingCreatives(prev => ({ ...prev, [productId]: false }));
    }
  };

  const handleGenerateWithInstructions = () => {
    setIsDialogOpen(false);
    generateCreatives(currentProductId, currentProductName, additionalInstructions);
  };

  const handleGenerateClick = (productId: string, productName: string) => {
    setCurrentProductId(productId);
    setCurrentProductName(productName);
    setAdditionalInstructions('');
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (creative: GeneratedCreative) => {
    setCreativeToDelete(creative);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!creativeToDelete || !campaignId) {
      return;
    }

    try {
      await campaignService.deleteGeneratedCreative(campaignId, creativeToDelete.id);
      
      // Remove the creative from the local state
      onCreativesGenerated?.([creativeToDelete], 'remove');
      
      // alert('Generated creative deleted successfully!');
    } catch (error) {
      console.error('Error deleting creative:', error);
      alert('Failed to delete generated creative. Please try again.');
    } finally {
      setIsDeleteDialogOpen(false);
      setCreativeToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setCreativeToDelete(null);
  };

  const handleViewImage = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Product Cards */}
      <div className="space-y-6">
        {campaignBrief.products.map((product, index) => (
          <Card key={product.id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b gap-0">
              <CardTitle className="flex items-center gap-3">
                <span className="text-lg font-semibold mr-auto">Product {index + 1}: {product.name}</span>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleGenerateClick(product.id, product.name)}
                  disabled={generatingCreatives[product.id] || assets.length === 0}
                  className="ml-2"
                >
                  {generatingCreatives[product.id] ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-1" />
                  )}
                  {generatingCreatives[product.id] ? 'Generating Creatives...' : 'Generate Creatives'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0" style={{ paddingBottom: 0 }}>
              {previewMode === 'grid' ? (
                <>
                  {/* Assets Section */}
                  <div className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">Product Images</h3>
                    </div>
                    <div className="grid grid-cols-5 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4">
                      {assets.filter(asset => asset.productId === product.id).map((asset) => (
                        <div key={asset.id} className="group relative">
                          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            <ImageWithFallback 
                              src={asset.imageUrl} 
                              alt={asset.productName || 'Product image'}
                              className="w-full h-full object-contain"
                              fallbackClassName="w-full h-full"
                            />
                            
                            {/* Overlay controls */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewImage(asset.imageUrl);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>

                            

                            {/* Asset type badge */}
                            <Badge 
                              variant="secondary" 
                              className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1"
                            >
                              {asset.type === 'generated' ? (
                                <Sparkles className="w-3 h-3" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-6"></div>

                  {/* Generated Creatives Section */}
                  <div className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Generated Creatives</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {generatedCreatives.filter(creative => creative.productId === product.id).map((creative) => (
                        <div key={creative.id} className="group relative">
                          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            <ImageWithFallback 
                              src={creative.imageUrl} 
                              alt={creative.productName || 'Product image'}
                              className="w-full h-full object-contain"
                              fallbackClassName="w-full h-full"
                            />
                            
                            {/* Overlay controls */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewImage(creative.imageUrl);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(creative);
                                }}
                                disabled={!campaignId}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <Badge 
                              variant="secondary" 
                              className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1"
                            >
                              {creative.aspectRatio}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <></>
              )}
            </CardContent>
          </Card>
        ))}
        
        {Object.keys(campaignBrief.products).length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal for additional instructions */}
      <Modal 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)}
        center
        classNames={{
          modal: 'max-w-md w-full p-0 flex flex-col bg-background rounded-lg',
          overlay: 'bg-black/50',
          modalContainer: 'flex items-center justify-center p-4'
        }}
        styles={{
          modal: {
            margin: 0,
            maxWidth: '28rem',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999
          },
          overlay: {
            zIndex: 9998
          }
        }}
        showCloseIcon={true}
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 p-6 pb-4 border-b">
            <h2 className="text-xl font-semibold">Generate Creatives</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Add any additional instructions to customize your creative generation. This is optional.
            </p>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="instructions" className="block text-sm font-medium mb-2">
                  Additional Instructions
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="e.g., 'Make it more vibrant', 'Add a sunset background', 'Use a minimalist style'"
                  className="w-full"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex-shrink-0 p-6 pt-4 border-t">
            <div className="flex justify-between gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleGenerateWithInstructions}
                className="flex items-center gap-2"
              >
                <Wand2 className="w-3 h-3" />
                Generate Creatives
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        open={isDeleteDialogOpen} 
        onClose={handleDeleteCancel}
        center
        classNames={{
          modal: 'max-w-md w-full p-0 flex flex-col bg-background rounded-lg',
          overlay: 'bg-black/50',
          modalContainer: 'flex items-center justify-center p-4'
        }}
        styles={{
          modal: {
            margin: 0,
            maxWidth: '28rem',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999
          },
          overlay: {
            zIndex: 9998
          }
        }}
        showCloseIcon={true}
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 p-6 pb-4 border-b">
            <h2 className="text-xl font-semibold text-red-600">Delete Generated Creative</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Are you sure you want to delete this generated creative? This action cannot be undone.
            </p>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-6">
            {creativeToDelete && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                    <ImageWithFallback 
                      src={creativeToDelete.imageUrl} 
                      alt={creativeToDelete.productName || 'Creative preview'}
                      className="w-full h-full object-cover"
                      fallbackClassName="w-full h-full"
                    />
                  </div>
                  <div>
                    <p className="font-medium">{creativeToDelete.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {creativeToDelete.aspectRatio} • {creativeToDelete.creativeType}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex-shrink-0 p-6 pt-4 border-t">
            <div className="flex justify-between gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleDeleteCancel}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDeleteConfirm}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Delete Creative
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}