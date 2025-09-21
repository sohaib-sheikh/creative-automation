import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { CampaignBrief } from '../types/campaignBrief';

interface CampaignBriefFormProps {
  onSubmit: (brief: CampaignBrief) => void;
  initialBrief?: CampaignBrief;
  onValidationChange?: (isValid: boolean) => void;
}

export interface CampaignBriefFormRef {
  submit: () => void;
  isValid: boolean;
}

export const CampaignBriefForm = React.forwardRef<CampaignBriefFormRef, CampaignBriefFormProps>(
  ({ onSubmit, initialBrief, onValidationChange }, ref) => {
  const [brief, setBrief] = useState<CampaignBrief>(
    initialBrief || {
      id: Date.now().toString(),
      name: '',
      products: [
        { id: '1', name: '', description: '', category: '' },
        { id: '2', name: '', description: '', category: '' }
      ],
      targetRegion: '',
      targetAudience: '',
      campaignMessage: '',
      localization: {
        primaryLanguage: 'en',
        additionalLanguages: []
      }
    }
  );

  // Update form data when initialBrief changes (e.g., when navigating back to step 1)
  React.useEffect(() => {
    if (initialBrief) {
      // Ensure localization object exists with defaults
      const briefWithDefaults = {
        ...initialBrief,
        localization: {
          ...(initialBrief.localization || {}),
          primaryLanguage: initialBrief.localization?.primaryLanguage || 'en',
          additionalLanguages: initialBrief.localization?.additionalLanguages || []
        }
      };
      setBrief(briefWithDefaults);
    }
  }, [initialBrief]);

  const addProduct = () => {
    setBrief(prev => ({
      ...prev,
      products: [...prev.products, {
        id: Date.now().toString(),
        name: '',
        description: '',
        category: ''
      }]
    }));
  };

  const removeProduct = (id: string) => {
    setBrief(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id)
    }));
  };

  const updateProduct = (id: string, field: string, value: string) => {
    setBrief(prev => ({
      ...prev,
      products: prev.products.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      )
    }));
  };

  const validateForm = () => {
    // Validate required fields
    if (!brief.name || !brief.targetRegion || !brief.targetAudience || !brief.campaignMessage) {
      return false;
    }

    // Validate products
    const validProducts = brief.products.filter(p => p.name && p.description);
    if (validProducts.length < 2) {
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      alert('Please fill in all required fields and add at least 2 complete products');
      return;
    }

    const validProducts = brief.products.filter(p => p.name && p.description);
    onSubmit({
      ...brief,
      products: validProducts
    });
  };

  // Expose submit function to parent component
  React.useImperativeHandle(ref, () => ({
    submit: handleSubmit,
    isValid: validateForm()
  }));

  // Notify parent of validation changes
  React.useEffect(() => {
    onValidationChange?.(validateForm());
  }, [brief, onValidationChange]);

  return (
    <Card className="w-full mx-auto">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign Name *</Label>
            <Input
              id="campaign-name"
              value={brief.name}
              onChange={(e) => setBrief(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Summer Product Launch 2024"
            />
          </div>

          {/* Products */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Products * (minimum 2)</Label>
              <Button type="button" onClick={addProduct} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {brief.products.map((product, index) => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <h4>Product {index + 1}</h4>
                    {brief.products.length > 2 && (
                      <Button
                        type="button"
                        onClick={() => removeProduct(product.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Product Name</Label>
                      <Input
                        value={product.name}
                        onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                        placeholder="e.g., Wireless Headphones"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select
                        value={product.category}
                        onChange={(e) => updateProduct(product.id, 'category', e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select category</option>
                        <option value="electronics">Electronics</option>
                        <option value="fashion">Fashion</option>
                        <option value="home">Home & Garden</option>
                        <option value="beauty">Beauty</option>
                        <option value="sports">Sports</option>
                        <option value="food">Food & Beverage</option>
                        <option value="automotive">Automotive</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={product.description}
                        onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                        placeholder="Brief product description for asset generation"
                        rows={2}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Target Region */}
          <div className="space-y-2">
            <Label htmlFor="target-region">Target Region/Market *</Label>
            <select
              id="target-region"
              value={brief.targetRegion}
              onChange={(e) => setBrief(prev => ({ ...prev, targetRegion: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select target region</option>
              <option value="north-america">North America</option>
              <option value="europe">Europe</option>
              <option value="asia-pacific">Asia Pacific</option>
              <option value="latin-america">Latin America</option>
              <option value="middle-east-africa">Middle East & Africa</option>
              <option value="global">Global</option>
            </select>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label htmlFor="target-audience">Target Audience *</Label>
            <Textarea
              id="target-audience"
              value={brief.targetAudience}
              onChange={(e) => setBrief(prev => ({ ...prev, targetAudience: e.target.value }))}
              placeholder="e.g., Tech-savvy millennials aged 25-35, urban professionals who value convenience"
              rows={3}
            />
          </div>

          {/* Campaign Message */}
          <div className="space-y-2">
            <Label htmlFor="campaign-message">Campaign Message *</Label>
            <Textarea
              id="campaign-message"
              value={brief.campaignMessage}
              onChange={(e) => setBrief(prev => ({ ...prev, campaignMessage: e.target.value }))}
              placeholder="e.g., Experience the future of audio with our latest wireless technology"
              rows={3}
            />
          </div>

          {/* Localization */}
          <div className="space-y-2">
            <Label htmlFor="primary-language">Primary Language</Label>
            <select
              value={brief.localization?.primaryLanguage || 'en'}
              onChange={(e) => setBrief(prev => ({ 
                ...prev, 
                localization: { 
                  ...(prev.localization || {}),
                  primaryLanguage: e.target.value,
                  additionalLanguages: prev.localization?.additionalLanguages || []
                } 
              }))}
              className="flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

        </div>
      </CardContent>
    </Card>
  );
});

CampaignBriefForm.displayName = 'CampaignBriefForm';