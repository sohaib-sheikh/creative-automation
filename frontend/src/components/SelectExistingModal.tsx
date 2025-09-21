import React, { useState, useEffect } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Button } from './ui/button';
import { ImageWithFallback } from './ui/ImageWithFallback';
import { Asset } from '../types/asset';
import { Loader2, X, Check } from 'lucide-react';

interface SelectExistingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImages: (assets: Asset[]) => void;
  productId: string;
  productName: string;
}

interface StoredAsset {
  id: string;
  type: 'uploaded' | 'generated';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  localUrl?: string;
  dropboxPath: string;
  dropboxUrl: string;
  dropboxFileId?: string;
  metadata: Record<string, any>;
  campaignId?: string;
  productId?: string;
  accountId?: string;
  createdAt: string;
  updatedAt: string;
}

export function SelectExistingModal({ 
  isOpen, 
  onClose, 
  onSelectImages, 
  productId, 
  productName 
}: SelectExistingModalProps) {
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch images from database when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchExistingAssets();
    } else {
      // Reset state when modal closes
      setAssets([]);
      setSelectedAssets(new Set());
      setError('');
    }
  }, [isOpen]);

  const fetchExistingAssets = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch assets from the database, filtering for uploaded assets only
      const response = await fetch(`/api/assets/type/uploaded?limit=100`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch assets from database');
      }

      const data = await response.json();
      
      // Filter for image files only based on mime type
      const imageAssets = data.assets.filter((asset: StoredAsset) => {
        return asset.mimeType.startsWith('image/');
      });

      setAssets(imageAssets);
    } catch (error) {
      console.error('Error fetching existing assets:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch assets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetSelect = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map(asset => asset.id)));
    }
  };

  const handleConfirmSelection = () => {
    const selectedAssetObjects = assets.filter(asset => selectedAssets.has(asset.id));
    
    // Convert stored assets to Asset objects
    const convertedAssets: Asset[] = selectedAssetObjects.map(asset => ({
      id: asset.id,
      productId: productId,
      productName: productName,
      imageUrl: asset.dropboxUrl + '&raw=1', // Add raw parameter for direct image access
      type: asset.type as 'uploaded' | 'generated',
      dropboxPath: asset.dropboxPath,
      dropboxUrl: asset.dropboxUrl,
      aspectRatio: asset.metadata?.aspectRatio || '1:1', // Use stored aspect ratio or default
      provider: asset.metadata?.provider,
      campaignText: asset.metadata?.campaignText
    }));

    onSelectImages(convertedAssets);
    onClose();
  };

  const handleClose = () => {
    setSelectedAssets(new Set());
    setError('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      center
      classNames={{
        modal: 'max-w-4xl w-full p-0 bg-background rounded-lg',
        overlay: 'bg-black/50',
        modalContainer: 'flex items-center justify-center p-4'
      }}
      showCloseIcon={true}
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <div className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Existing Images</h3>
              <p className="text-muted-foreground text-sm">
                Choose from your previously uploaded images
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={isLoading || assets.length === 0}
            >
              {selectedAssets.size === assets.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-muted-foreground">Loading uploaded images...</span>
              </div>
            </div>
          )}

          {/* Images Grid */}
          {!isLoading && !error && (
            <>
              {assets.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-96 overflow-y-auto">
                  {assets.map((asset) => {
                    const isSelected = selectedAssets.has(asset.id);
                    const imageUrl = asset.dropboxUrl + '&raw=1';
                    
                    return (
                      <div
                        key={asset.id}
                        className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-300'
                        }`}
                        onClick={() => handleAssetSelect(asset.id)}
                      >
                        <ImageWithFallback
                          src={imageUrl}
                          alt={asset.originalName}
                          className="w-full h-full object-cover"
                          fallbackClassName="w-full h-full"
                        />
                        
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        
                        {/* Asset info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2">
                          <div className="truncate">{asset.originalName}</div>
                          <div className="text-xs opacity-75">
                            {asset.type} • {Math.round(asset.size / 1024)}KB
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-muted-foreground">
                    <p className="text-sm">No uploaded images found</p>
                    <p className="text-xs mt-1">Upload some images first to see them here</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={isLoading || selectedAssets.size === 0}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Select {selectedAssets.size} Image{selectedAssets.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
