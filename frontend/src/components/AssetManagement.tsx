import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { AssetGenerator } from './AssetGenerator';
import { ImageUpload } from './ImageUpload';
import { ImageWithFallback } from './ui/ImageWithFallback';
import { SelectExistingModal } from './SelectExistingModal';
import { Asset } from '../types/asset';
import { CampaignBrief } from '../types/campaignBrief';
import { X, Upload, Sparkles, Wand2, Eye, Trash2, FolderOpen } from 'lucide-react';

interface AssetManagementProps {
  campaignBrief: CampaignBrief;
  assets: Asset[];
  onProductAssetsUploaded: (productId: string, assets: Asset[], operation: 'add' | 'remove') => Promise<void>;
  onProductAssetsGenerated: (productId: string, assets: Asset[], operation: 'add' | 'remove') => Promise<void>;
}

export function AssetManagement({
  campaignBrief,
  assets,
  onProductAssetsUploaded,
  onProductAssetsGenerated
}: AssetManagementProps) {
  const [showSelectExistingModal, setShowSelectExistingModal] = useState(false);
  const [currentProductId, setCurrentProductId] = useState<string>('');

  const handleViewImage = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  const handleSelectExistingClick = (productId: string) => {
    setCurrentProductId(productId);
    setShowSelectExistingModal(true);
  };

  const handleSelectExistingImages = async (selectedAssets: Asset[]) => {
    if (selectedAssets.length > 0) {
      await onProductAssetsUploaded(currentProductId, selectedAssets, 'add');
    }
    setShowSelectExistingModal(false);
    setCurrentProductId('');
  };
  return (
      <div className="space-y-6">
        {campaignBrief.products.map((product, index) => (
          <Card key={product.id} className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Product {index + 1}: {product.name}</h4>
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  </div>
                  <div>
                    <div className="space-y-4 flex gap-2">
                        <ImageUpload 
                            onAssetsChange={(assets, operation) => onProductAssetsUploaded(product.id, assets, operation)}
                            productId={product.id}
                            maxFiles={10}
                        />
                        <Button
                            variant="outline"
                            
                            onClick={() => handleSelectExistingClick(product.id)}
                            className="flex items-center gap-2"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Select Existing
                        </Button>
                        <div className="text-center text-sm text-muted-foreground" style= {{ margin: '10px 0px' }}>or</div>
                        <AssetGenerator 
                            campaignBrief={campaignBrief}
                            productId={product.id}
                            onAssetsGenerated={(assets, operation) => onProductAssetsGenerated(product.id, assets, operation)}
                        />
                    </div>
                    <div className="text-sm text-muted-foreground" style={{ margin: 0, padding: 0, textAlign: 'right' }}>Files uploaded to Dropbox</div>
                  </div>
                </div>
                
                <div className="space-y-4 flex flex-wrap gap-2">
                  <h6 className="text-sm font-medium text-muted-foreground w-full">All Product Images</h6>
                  <div className="space-y-4 w-full">
                    {(() => {
                      const filteredAssets = assets ? assets.filter(asset => asset.productId === product.id) : [];
                      if (filteredAssets.length > 0) {
                        return (
                          <div className="grid grid-cols-5 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4">
                            {filteredAssets.map((asset) => (
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
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={async () => {
                                        await onProductAssetsUploaded(product.id, [asset], 'remove');
                                      }}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>

                                  {/* Asset type badge */}
                                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                                    {asset.type === 'generated' ? (
                                      <Sparkles className="w-3 h-3" />
                                    ) : asset.type === 'creative' ? (
                                      <Wand2 className="w-3 h-3" />
                                    ) : (
                                      <Upload className="w-3 h-3" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      } else {
                        return (
                          <div className="w-full flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <p className="text-sm">No assets yet</p>
                            <p className="text-xs">Upload or generate assets to see them here</p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Select Existing Modal */}
        <SelectExistingModal
          isOpen={showSelectExistingModal}
          onClose={() => setShowSelectExistingModal(false)}
          onSelectImages={handleSelectExistingImages}
          productId={currentProductId}
          productName={campaignBrief.products.find(p => p.id === currentProductId)?.name || ''}
        />
      </div>
  );
}
