import React, { useState } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert } from './ui/alert';
import { CampaignBrief } from '../types/campaignBrief';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

interface JsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (brief: CampaignBrief) => void;
}

const JSON_PLACEHOLDER = `{
  "name": "Summer Sale Campaign",
  "products": [
    {
      "name": "Wireless Headphones",
      "description": "High-quality wireless headphones with noise cancellation",
      "category": "electronics"
    },
    {
      "name": "Smart Watch",
      "description": "Fitness tracking smartwatch with heart rate monitor",
      "category": "electronics"
    }
  ],
  "targetRegion": "north-america",
  "targetAudience": "Tech-savvy consumers aged 25-45",
  "campaignMessage": "Get ready for summer with our latest tech innovations! Save up to 30% on premium electronics.",
  "localization": {
    "primaryLanguage": "en",
    "additionalLanguages": ["es", "fr"]
  }
}`;

export function JsonImportModal({ isOpen, onClose, onImport }: JsonImportModalProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const validateAndParseJson = (): CampaignBrief | null => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Validate required fields (excluding id as it will be generated)
      const requiredFields = ['name', 'products', 'targetRegion', 'targetAudience', 'campaignMessage', 'localization'];
      const missingFields = requiredFields.filter(field => !parsed[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate products array
      if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
        throw new Error('Products must be a non-empty array');
      }

      // Validate each product (excluding id as it will be generated)
      const productRequiredFields = ['name', 'description', 'category'];
      for (const product of parsed.products) {
        const missingProductFields = productRequiredFields.filter(field => !product[field]);
        if (missingProductFields.length > 0) {
          throw new Error(`Product missing required fields: ${missingProductFields.join(', ')}`);
        }
      }

      // Validate localization
      if (!parsed.localization.primaryLanguage || !Array.isArray(parsed.localization.additionalLanguages)) {
        throw new Error('Localization must have primaryLanguage and additionalLanguages array');
      }

      // Generate IDs for campaign and products
      const campaignBrief: CampaignBrief = {
        id: generateId(), // Generate campaign ID
        name: parsed.name,
        products: parsed.products.map((product: any) => ({
          id: generateId(), // Generate product ID
          name: product.name,
          description: product.description,
          category: product.category
        })),
        targetRegion: parsed.targetRegion,
        targetAudience: parsed.targetAudience,
        campaignMessage: parsed.campaignMessage,
        localization: parsed.localization
      };

      return campaignBrief;
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      setError('Please enter JSON data');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const campaignBrief = validateAndParseJson();
      if (campaignBrief) {
        onImport(campaignBrief);
        handleClose();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid JSON format');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClose = () => {
    setJsonInput('');
    setError(null);
    setIsValidating(false);
    onClose();
  };

  const handleLoadExample = () => {
    setJsonInput(JSON_PLACEHOLDER);
    setError(null);
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      center
      classNames={{
        modal: 'max-w-4xl w-full h-[90vh] p-0 flex flex-col bg-background rounded-lg',
        overlay: 'bg-black/50',
        modalContainer: 'flex items-center justify-center p-4'
      }}
      styles={{
        modal: {
          margin: 0,
          maxWidth: '80vw',
          maxHeight: '90vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      showCloseIcon={true}
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Import Campaign from JSON</h2>
              <p className="text-muted-foreground mt-1">
                Paste your campaign JSON data below to create a new campaign
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="space-y-6">
            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">JSON Format Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your JSON must include the following required fields:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <code className="bg-muted px-1 rounded">name</code> - Campaign name</li>
                  <li>• <code className="bg-muted px-1 rounded">products</code> - Array of product objects with name, description, category</li>
                  <li>• <code className="bg-muted px-1 rounded">targetRegion</code> - Target geographic region</li>
                  <li>• <code className="bg-muted px-1 rounded">targetAudience</code> - Target audience description</li>
                  <li>• <code className="bg-muted px-1 rounded">campaignMessage</code> - Campaign message</li>
                  <li>• <code className="bg-muted px-1 rounded">localization</code> - Object with primaryLanguage and additionalLanguages</li>
                </ul>
                <Button variant="outline" size="sm" onClick={handleLoadExample} className="mt-3">
                  Load Example JSON
                </Button>
              </CardContent>
            </Card>

            {/* JSON Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={JSON_PLACEHOLDER}
                  className="min-h-[300px] font-mono text-sm"
                  disabled={isValidating}
                />
                {error && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <div className="ml-2">
                      <div className="font-medium">Validation Error</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end items-center gap-3 p-6 pt-4 border-t bg-background">
          <Button variant="outline" onClick={handleClose} disabled={isValidating}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!jsonInput.trim() || isValidating}
            className="flex items-center gap-2"
          >
            {isValidating ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Import Campaign
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
