import React, { useState, useEffect } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { CampaignBrief } from '../types/campaignBrief';
import { Asset } from '../types/asset';
import { dropboxService } from '../services/dropboxService';

interface AssetGeneratorProps {
  campaignBrief: CampaignBrief;
  productId?: string; // Optional - if not provided, generate for all products
  onAssetsGenerated: (assets: Asset[], operation: 'add' | 'remove') => void;
}

const ASPECT_RATIOS = [
  { key: '1:1' as const, label: 'Square (1:1)', width: 400, height: 400 }
];


export function AssetGenerator({ campaignBrief, productId, onAssetsGenerated }: AssetGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [currentProduct, setCurrentProduct] = useState('');
  const [generatedAssets, setGeneratedAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dropboxToken, setDropboxToken] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Check for existing Dropbox token on component mount
  useEffect(() => {
    const checkToken = async () => {
      const token = await dropboxService.getValidToken();
      if (token) {
        setDropboxToken(token);
      }
    };
    checkToken();
  }, []);

  const generateAssets = async (instructions: string = '') => {
    setIsGenerating(true);
    setProgress(0);
    setGeneratedAssets([]);
    setError(null);

    // Check if Dropbox is authenticated
    if (!dropboxToken) {
      setError('Please authenticate with Dropbox first to generate assets. Go to Settings to connect your Dropbox account.');
      setIsGenerating(false);
      return;
    }

    try {
      // Determine which products to generate assets for
      const productsToProcess = productId 
        ? campaignBrief.products.filter(p => p.id === productId)
        : campaignBrief.products;

      if (productsToProcess.length === 0) {
        setError('No products found to generate assets for');
        return;
      }

      const totalSteps = productsToProcess.length * ASPECT_RATIOS.length;
      let currentStepIndex = 0;
      const assets: Asset[] = [];

      for (const product of productsToProcess) {
        setCurrentProduct(product.name);
        setCurrentStep(`Generating assets for ${product.name}`);

        for (const aspectRatio of ASPECT_RATIOS) {
          currentStepIndex++;
          setProgress((currentStepIndex / totalSteps) * 100);
          setCurrentStep(`Creating ${aspectRatio.label} format for ${product.name}`);

          try {
            // Call backend API to generate asset
            const response = await fetch('/api/generate-asset', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productName: product.name,
                productDescription: product.description,
                productCategory: product.category,
                aspectRatio: aspectRatio.key,
                additionalPromptInstructions: instructions,
                accessToken: dropboxToken
              })
            });

            const result = await response.json();

            let imageUrl: string;
            if (response.ok && result.success) {
              // Use the Dropbox URL from the new response format
              imageUrl = result.dropboxUrl || result.asset?.url || result.imageUrl;
            } else {
              console.error('API Error:', result.error);
              setError(result.error || 'Failed to generate asset');
              // Set to empty string so ImageWithFallback component can handle the error
              imageUrl = '';
            }

            const asset: Asset = {
              id: `${product.id}-${aspectRatio.key}-${Date.now()}`,
              productId: product.id,
              productName: product.name,
              // aspectRatio: aspectRatio.key,
              imageUrl,
              campaignText: campaignBrief.campaignMessage,
              type: 'generated',
              // generatedAt: new Date().toISOString()
            };

            assets.push(asset);

          } catch (error) {
            console.error(`Error generating ${aspectRatio.key} asset for ${product.name}:`, error);
            
            // Create a fallback asset with error indication
            const fallbackAsset: Asset = {
              id: `${product.id}-${aspectRatio.key}-${Date.now()}-error`,
              productId: product.id,
              productName: product.name,
              // aspectRatio: aspectRatio.key,
              imageUrl: '', // Empty string so ImageWithFallback component can handle the error
              campaignText: campaignBrief.campaignMessage,
              type: 'generated',
              // generatedAt: new Date().toISOString()
            };

            assets.push(fallbackAsset);
          }
        }
      }

      setGeneratedAssets(assets);
      onAssetsGenerated(assets, 'add');
      setCurrentStep('Asset generation complete');
      setProgress(100);

    } catch (error) {
      console.error('Fatal error during generation:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateWithInstructions = () => {
    setIsDialogOpen(false);
    generateAssets(additionalInstructions);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Generation Controls */}

      <div className="w-full">
        <Button 
            onClick={() => setIsDialogOpen(true)}
            disabled={isGenerating}
            className="flex items-center gap-2 w-full">
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {isGenerating ? 'Generating...' : 'Generate Image'}
        </Button>
        
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
              <h2 className="text-xl font-semibold">Generate Image</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Add any additional instructions to customize your image generation. This is optional.
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
                  <Sparkles className="w-3 h-3" />
                  Generate Image
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </div>

      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
      
    </div>
  );
}