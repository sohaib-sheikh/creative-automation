import React, { useState } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Card, CardContent } from './ui/card';
import { CampaignBriefForm, CampaignBriefFormRef } from './CampaignBriefForm';
import { AssetManagement } from './AssetManagement';
import { CreativePreview } from './CreativePreview';
import { getStorableAssets } from './ImageUpload';
import { Asset } from '../types/asset';
import { useCampaigns } from '../hooks/useCampaigns';
import { SavedCampaign } from '../types/campaign';
import { GeneratedCreative } from '../types/generatedCreative';
import { CampaignBrief } from '../types/campaignBrief';
import { ChevronLeft, ChevronRight, CheckCircle, FileText, Image, Palette, MessageSquare, Shield, Eye, Loader2, Languages, Plus, Minus } from 'lucide-react';
import { TranslationModal } from './TranslationModal';
import { LocalizedMessagesList } from './LocalizedMessagesList';
import { FinalReviewStep } from './FinalReviewStep';


interface CampaignCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (brief: CampaignBrief, assets: Asset[]) => void;
  editingCampaign?: SavedCampaign | null;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function CampaignCreationModal({ isOpen, onClose, onComplete, editingCampaign }: CampaignCreationModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [campaignBrief, setCampaignBrief] = useState<CampaignBrief | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [generatedCreatives, setGeneratedCreatives] = useState<GeneratedCreative[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [refreshLocalizedMessages, setRefreshLocalizedMessages] = useState(0);
  const [isAnalyzingCompliance, setIsAnalyzingCompliance] = useState(false);
  const [complianceResults, setComplianceResults] = useState<any>(null);
  const [isAnalyzingLegalContent, setIsAnalyzingLegalContent] = useState(false);
  const [legalContentResults, setLegalContentResults] = useState<any>(null);
  const briefFormRef = React.useRef<CampaignBriefFormRef>(null);
  
  // State for expand/collapse functionality in compliance check step
  const [isBrandComplianceExpanded, setIsBrandComplianceExpanded] = useState(false);
  const [isLegalReviewExpanded, setIsLegalReviewExpanded] = useState(false);
  
  // Use campaigns hook for creating and updating campaigns
  const { createCampaign, updateCampaign, addAsset, removeAsset, addCreative, removeCreative } = useCampaigns();

  // Initialize with existing campaign data when editing
  React.useEffect(() => {
    if (editingCampaign && isOpen) {
      setCampaignBrief(editingCampaign.brief);
      setCreatedCampaignId(editingCampaign.id);

      console.log("Editing campaign assets:", editingCampaign.assets);

      setAssets(editingCampaign.assets);
      setGeneratedCreatives(editingCampaign.generatedCreatives);
      
      // Load existing compliance results if available
      loadExistingComplianceResults(editingCampaign.id);
      loadExistingLegalContentResults(editingCampaign.id);
      
      // Always start at step 1 when editing
      setCurrentStep(1);
    } else if (!editingCampaign && isOpen) {
      // Reset for new campaign
      handleReset();
    }
  }, [editingCampaign, isOpen]);

  // Load compliance results when campaign ID changes
  React.useEffect(() => {
    if (createdCampaignId && isOpen) {
      loadExistingComplianceResults(createdCampaignId);
      loadExistingLegalContentResults(createdCampaignId);
    }
  }, [createdCampaignId, isOpen]);

  const steps = [
    {
      id: 1,
      title: 'Campaign Brief',
      description: 'Define your campaign details',
      icon: FileText,
      completed: campaignBrief !== null
    },
    {
      id: 2,
      title: 'Upload & Generate Assets',
      description: 'Upload assets or generate new ones',
      icon: Image,
      completed: assets.length > 0
    },
    {
      id: 3,
      title: 'Creative Preview',
      description: 'Review and finalize creatives',
      icon: Palette,
      completed: false
    },
    {
      id: 4,
      title: 'Message Customization',
      description: 'Customize and localize campaign messages',
      icon: MessageSquare,
      completed: false
    },
    {
      id: 5,
      title: 'Compliance Check',
      description: 'Brand and legal validation',
      icon: Shield,
      completed: false
    },
    {
      id: 6,
      title: 'Final Review',
      description: 'Review everything before launch',
      icon: Eye,
      completed: false
    }
  ];

  const handleBriefSubmit = async (brief: CampaignBrief) => {
    try {
      setIsCreatingDraft(true);
      setCampaignBrief(brief);
      
      if (editingCampaign) {
        // Update existing campaign
        await updateCampaign(editingCampaign.id, { brief });
        setCreatedCampaignId(editingCampaign.id);
      } else {
        // Create new campaign as draft after step 1
        const totalAssets = assets;
        const totalGeneratedCreatives = generatedCreatives;
        const createdCampaign = await createCampaign(brief, [], 'draft', totalGeneratedCreatives);
        setCreatedCampaignId(createdCampaign.id);
      }
      
      // Move to step 2
      setCurrentStep(2);
    } catch (error) {
      console.error('Failed to save campaign:', error);
      // Still allow progression to step 2 even if save fails
      setCurrentStep(2);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleProductAssets = async (productId: string, newAssets: Asset[], operation: 'add' | 'remove') => {
    console.log("Assets received:", newAssets.length);
    console.log("Current Assets:", assets?.length || 0);
    
    const existingAssets = assets;
    
    if (operation === 'add' && createdCampaignId) {
      for (const asset of newAssets) {
        await addAsset(createdCampaignId, asset);
      }

      setAssets([...existingAssets, ...newAssets]);
    } else if (operation === 'remove' && createdCampaignId) {
      for (const asset of newAssets) {
        await removeAsset(createdCampaignId, asset.id);
      }

      setAssets(existingAssets.filter(asset => !newAssets.map(a => a.id).includes(asset.id)));
    }
  };

  const handleProductCreatives = async (creatives: GeneratedCreative[], operation: 'add' | 'remove') => {
    console.log("Creatives received:", creatives.length);
    console.log("Existing creatives for this product:", generatedCreatives.length || 0);
    
    const existingCreatives = generatedCreatives;
    
    if (operation === 'add' && createdCampaignId) {
      for (const creative of creatives) {
        await addCreative(createdCampaignId, creative);
      }

      setGeneratedCreatives([...existingCreatives, ...creatives]);
    } else if (operation === 'remove' && createdCampaignId) {
      for (const creative of creatives) {
        await removeCreative(createdCampaignId, creative.id);
      }

      setGeneratedCreatives(existingCreatives.filter(creative => !creatives.map(c => c.id).includes(creative.id)));
    }
  };

  const handleComplete = async () => {
    const totalAssets = assets;
    const totalGeneratedCreatives = generatedCreatives;
    
    if (campaignBrief) {
      try {
        // Update the existing campaign to 'generated' status if we have assets
        if (createdCampaignId && (totalAssets.length > 0 || totalGeneratedCreatives.length > 0)) {
          await updateCampaign(createdCampaignId, {
            assets: totalAssets,
            generatedCreatives: totalGeneratedCreatives,
            status: 'generated'
          });
        }
        
        // Don't call onComplete to avoid redirect - just close the modal
        // The campaign is already saved and will appear in the dashboard
        handleReset();
        onClose();
      } catch (error) {
        console.error('Failed to finalize campaign:', error);
        // Still close the modal even if update fails
        handleReset();
        onClose();
      }
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setCampaignBrief(null);
    setAssets([]);
    setGeneratedCreatives([]);
    setIsGenerating(false);
    setCreatedCampaignId(null);
    setIsCreatingDraft(false);
    setIsAnalyzingCompliance(false);
    setComplianceResults(null);
    setIsAnalyzingLegalContent(false);
    setLegalContentResults(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleRegenerateMessage = async (additionalInstructions: string) => {
    if (!campaignBrief || !createdCampaignId) return;
    
    try {
      setIsRegenerating(true);
      
      const response = await fetch('/api/regenerate-campaign-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: createdCampaignId,
          campaignBrief: campaignBrief,
          additionalInstructions: additionalInstructions
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate campaign message');
      }

      const result = await response.json();
      
      // Update the campaign brief with the new message
      const updatedBrief = {
        ...campaignBrief,
        campaignMessage: result.campaignMessage
      };
      
      setCampaignBrief(updatedBrief);
      
      // Update the campaign in the database
      await updateCampaign(createdCampaignId, { brief: updatedBrief });
      
      setShowRegenerateModal(false);
    } catch (error) {
      console.error('Error regenerating campaign message:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsRegenerating(false);
    }
  };

  const loadExistingComplianceResults = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/brand-compliance`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.hasComplianceData) {
          setComplianceResults(result);
          console.log('Loaded existing compliance results:', result);
        }
      }
    } catch (error) {
      console.error('Error loading existing compliance results:', error);
    }
  };

  const handleBrandComplianceCheck = async () => {
    if (!createdCampaignId) return;
    
    try {
      setIsAnalyzingCompliance(true);
      setComplianceResults(null);
      
      const response = await fetch('/api/analyze-brand-compliance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: createdCampaignId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze brand compliance');
      }

      const result = await response.json();
      setComplianceResults(result);
      
    } catch (error) {
      console.error('Error analyzing brand compliance:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsAnalyzingCompliance(false);
    }
  };

  const loadExistingLegalContentResults = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/legal-content-review`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.hasLegalReviewData) {
          setLegalContentResults(result);
          console.log('Loaded existing legal content review results:', result);
        }
      }
    } catch (error) {
      console.error('Error loading existing legal content review results:', error);
    }
  };

  const handleLegalContentReview = async () => {
    if (!createdCampaignId) return;
    
    try {
      setIsAnalyzingLegalContent(true);
      setLegalContentResults(null);
      
      const response = await fetch('/api/analyze-legal-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: createdCampaignId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze legal content');
      }

      const result = await response.json();
      setLegalContentResults(result);
      
    } catch (error) {
      console.error('Error analyzing legal content:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsAnalyzingLegalContent(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // Submit the form for step 1
      briefFormRef.current?.submit();
    } else {
      setCurrentStep(Math.min(6, currentStep + 1) as Step);
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return isFormValid;
      case 2:
        return assets.length > 0 || generatedCreatives.length > 0;
      case 3:
        return true;
      case 4:
        return true; // Placeholder - can always proceed for now
      case 5:
        return true; // Placeholder - can always proceed for now
      case 6:
        return true; // Placeholder - can always proceed for now
      default:
        return false;
    }
  };

  const canGoPrevious = () => {
    return currentStep > 1 && !isGenerating && !isCreatingDraft;
  };

  const getProgressPercentage = () => {
    return ((currentStep - 1) / (steps.length - 1)) * 100;
  };

  const canNavigateToStep = (stepId: Step) => {
    switch (stepId) {
      case 1:
        return true; // Always can go to step 1
      case 2:
        return campaignBrief !== null; // Need campaign brief
      case 3:
        return campaignBrief !== null && (assets.length > 0 || generatedCreatives.length > 0); // Need brief and assets
      case 4:
        return campaignBrief !== null && (assets.length > 0 || generatedCreatives.length > 0); // Same as step 3
      case 5:
        return campaignBrief !== null && (assets.length > 0 || generatedCreatives.length > 0); // Same as step 3
      case 6:
        return campaignBrief !== null && (assets.length > 0 || generatedCreatives.length > 0); // Same as step 3
      default:
        return false;
    }
  };

  const handleStepClick = (stepId: number) => {
    const stepIdTyped = stepId as Step;
    if (canNavigateToStep(stepIdTyped)) {
      setCurrentStep(stepIdTyped);
    }
  };

  const StepIcon = ({ step }: { step: typeof steps[0] }) => {
    const IconComponent = step.icon;
    const isCurrent = step.id === currentStep;
    const isClickable = true || step.id <= currentStep || (step.id === currentStep + 1 && canNavigateToStep(step.id as Step));
    const isPrevious = step.id < currentStep;
    
    return (
      <div 
        className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors cursor-pointer ${
          isPrevious
            ? 'bg-primary border-primary text-primary-foreground'
            : isCurrent
            ? 'border-primary text-primary bg-white'
            : 'border-muted-foreground/30 text-muted-foreground bg-white'
        } ${isClickable ? 'hover:border-primary/50' : 'cursor-not-allowed opacity-50'}`}
        style={{cursor: isClickable ? 'pointer' : 'not-allowed'}}
        onClick={() => {if (isClickable) {
          handleStepClick(step.id);
        }}}
      >
        {false ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <IconComponent className="w-5 h-5" />
        )}
      </div>
    );
  };

  return (
    <>
    <Modal
      open={isOpen}
      onClose={handleClose}
      center
      classNames={{
        modal: 'max-w-2xl w-full h-[95vh] p-0 flex flex-col bg-background rounded-lg',
        overlay: 'bg-black/50',
        modalContainer: 'flex items-center justify-center p-4'
      }}
      styles={{
        modal: {
          margin: 0,
          maxWidth: '45vw',
          maxHeight: '95vh',
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
        <div className="flex-shrink-0 p-6 pb-4 border-b space-y-4">
          <h2 className="text-2xl font-semibold">
            {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
          </h2>
          
          {/* Progress Bar */}
          <Progress value={getProgressPercentage()} className="w-full" />
          
          {/* Step Indicators */}
          <div className="flex justify-between items-start">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center space-y-2">
                  <StepIcon step={step} />
                  <div className="text-center">
                    <div className={`text-sm font-medium ${
                      step.id === currentStep ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 mt-[-2rem] ${
                    step.id < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {currentStep === 1 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Campaign Brief</h3>
                      <p className="text-muted-foreground">
                        Start by defining your campaign details, products, and target audience. 
                        Your campaign will be saved as a draft after this step, allowing you to continue later.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <CampaignBriefForm 
                ref={briefFormRef}
                onSubmit={handleBriefSubmit} 
                onValidationChange={setIsFormValid}
                initialBrief={editingCampaign?.brief || campaignBrief || undefined}
              />
            </div>
          )}

          {currentStep === 2 && campaignBrief && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Upload & Generate Assets</h3>
                      <p className="text-muted-foreground mb-0">
                        Upload your existing assets or let AI generate creative assets for each of your products in multiple aspect ratios.
                        This process includes brand compliance checks and legal content validation.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <AssetManagement
                campaignBrief={campaignBrief}
                assets={assets}
                onProductAssetsUploaded={handleProductAssets}
                onProductAssetsGenerated={handleProductAssets}
              />
            </div>
          )}

          {currentStep === 3 && campaignBrief && (assets.length > 0 || generatedCreatives.length > 0) && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Creative Preview</h3>
                      <p className="text-muted-foreground">
                        Review your generated creative assets. You can preview them in different formats,
                        check brand compliance scores, and download individual assets or the complete campaign.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <CreativePreview 
                assets={assets}
                generatedCreatives={generatedCreatives}
                campaignBrief={campaignBrief}
                campaignId={createdCampaignId || undefined}
                onCreativesGenerated={handleProductCreatives}
              />
            </div>
          )}

          {currentStep === 4 && campaignBrief && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Message Customization & Localization</h3>
                      <p className="text-muted-foreground">
                        Customize your campaign messages and localize them for different markets and languages.
                        This step allows you to tailor your messaging for specific audiences and regions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium">Campaign Message</h4>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowRegenerateModal(true)}
                        className="flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Regenerate Message
                      </Button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Target Audience</label>
                          <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                            {campaignBrief.targetAudience || 'Not specified'}
                          </p>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Target Market</label>
                          <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                            {campaignBrief.targetRegion || 'Not specified'}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Campaign Message</label>
                        <textarea
                          value={campaignBrief.campaignMessage || ''}
                          onChange={(e) => setCampaignBrief(prev => prev ? ({ ...prev, campaignMessage: e.target.value }) : null)}
                          placeholder="Enter your campaign message here..."
                          className="mt-1 w-full p-3 border border-input rounded-md resize-none min-h-[100px] text-sm bg-textarea-background"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-medium mb-2">Localization</h4>
                        <p className="text-muted-foreground">
                          Translate your campaign message to different languages to reach global audiences.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowTranslationModal(true)}
                        className="flex items-center gap-2"
                        disabled={!campaignBrief?.campaignMessage?.trim()}
                      >
                        <Languages className="w-4 h-4" />
                        Translate Message
                      </Button>
                    </div>
                    
                    {createdCampaignId && (
                      <LocalizedMessagesList 
                        campaignId={createdCampaignId}
                        onRefresh={() => {
                          // Trigger a refresh of the localized messages list
                          setRefreshLocalizedMessages(prev => prev + 1);
                        }}
                        refreshTrigger={refreshLocalizedMessages}
                      />
                    )}
                    
                    {!createdCampaignId && (
                      <div className="text-center py-8">
                        <Languages className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Save your campaign first to start translating messages.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 5 && campaignBrief && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Compliance & Legal Check</h3>
                      <p className="text-muted-foreground">
                        Ensure your campaign meets brand guidelines and legal requirements before launch.
                        This includes brand compliance checks, legal content validation, and approval workflows.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div>
                          <h4 className="text-lg font-medium mb-2">Brand Compliance</h4>
                          <p className="text-muted-foreground">
                            Verify that all creative assets and messaging align with your brand guidelines and standards.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsBrandComplianceExpanded(!isBrandComplianceExpanded)}
                          className="h-8 w-8 p-0"
                        >
                          {isBrandComplianceExpanded ? (
                            <Minus className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {isBrandComplianceExpanded && (
                      <div className="transition-all duration-300">
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleBrandComplianceCheck}
                            disabled={!createdCampaignId || isAnalyzingCompliance}
                            className="flex items-center gap-2"
                          >
                            {isAnalyzingCompliance ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4" />
                                {complianceResults ? 'Re-analyze Brand Compliance' : 'Check Brand Compliance'}
                              </>
                            )}
                          </Button>
                        </div>
                        {complianceResults && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium">Compliance Analysis Results</h5>
                              <span className="text-sm text-muted-foreground">
                                Last analyzed: {new Date(complianceResults.analyzedAt).toLocaleString()}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-primary">
                                  {complianceResults.overallCompliance.complianceRate}%
                                </div>
                                <div className="text-sm text-muted-foreground">Compliance Rate</div>
                              </div>
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-primary">
                                  {complianceResults.overallCompliance.averageScore}
                                </div>
                                <div className="text-sm text-muted-foreground">Average Score</div>
                              </div>
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-primary">
                                  {complianceResults.overallCompliance.compliantCreatives}/{complianceResults.overallCompliance.totalCreatives}
                                </div>
                                <div className="text-sm text-muted-foreground">Compliant Creatives</div>
                              </div>
                            </div>
                            
                            {complianceResults.overallCompliance.conflictingColors.length > 0 && (
                              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <h5 className="font-medium text-destructive mb-2">Conflicting Colors Found</h5>
                                <div className="flex flex-wrap gap-2">
                                  {complianceResults.overallCompliance.conflictingColors.map((color, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <div 
                                        className="w-4 h-4 rounded border"
                                        style={{ backgroundColor: color }}
                                      />
                                      <span className="text-sm font-mono">{color}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="space-y-4">
                              <h5 className="font-medium">Individual Creative Analysis</h5>
                              {complianceResults.creativeAnalyses.map((analysis, index) => (
                                <div key={index} className="border rounded-lg overflow-hidden">
                                  <div className="flex">
                                    {/* Creative Image */}
                                    <div className="w-48 flex-shrink-0 bg-muted/20 flex items-center justify-center">
                                      <img
                                        src={analysis.imageUrl}
                                        alt={`Creative ${analysis.creativeIndex}`}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                          if (nextElement) {
                                            nextElement.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      <div className="hidden w-full h-full items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                          <Image className="w-8 h-8 mx-auto mb-2" />
                                          <p className="text-sm">Image unavailable</p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Analysis Results */}
                                    <div className="flex-1 p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium">Creative {analysis.creativeIndex}</span>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            analysis.compliance.complianceScore >= 80 
                                              ? 'bg-green-100 text-green-800' 
                                              : analysis.compliance.complianceScore >= 60 
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-red-100 text-red-800'
                                          }`}>
                                            {analysis.compliance.complianceScore}/100
                                          </span>
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            analysis.compliance.usesBrandColors 
                                              ? 'bg-green-100 text-green-800' 
                                              : 'bg-red-100 text-red-800'
                                          }`}>
                                            {analysis.compliance.usesBrandColors ? 'Compliant' : 'Non-compliant'}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        <div>
                                          <h6 className="text-sm font-medium text-muted-foreground mb-1">Brand Color Usage</h6>
                                          <p className="text-sm capitalize">{analysis.compliance.brandColorUsage}</p>
                                        </div>
                                        
                                        {analysis.compliance.conflictingColors.length > 0 && (
                                          <div>
                                            <h6 className="text-sm font-medium text-muted-foreground mb-1">Conflicting Colors</h6>
                                            <div className="flex flex-wrap gap-2">
                                              {analysis.compliance.conflictingColors.map((color, colorIndex) => (
                                                <div key={colorIndex} className="flex items-center gap-1">
                                                  <div 
                                                    className="w-3 h-3 rounded border"
                                                    style={{ backgroundColor: color }}
                                                  />
                                                  <span className="text-xs font-mono">{color}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div>
                                          <h6 className="text-sm font-medium text-muted-foreground mb-1">Analysis</h6>
                                          <p className="text-sm text-muted-foreground">
                                            {analysis.compliance.analysis}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {!complianceResults && (
                          <div className="text-center py-8">
                            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                              Click "Check Brand Compliance" to analyze your campaign creatives against your brand colors.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div>
                          <h4 className="text-lg font-medium">Legal Review</h4>
                          <p className="text-muted-foreground">
                            Ensure all content meets legal requirements and regulatory compliance standards.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsLegalReviewExpanded(!isLegalReviewExpanded)}
                        className="h-8 w-8 p-0"
                      >
                        {isLegalReviewExpanded ? (
                          <Minus className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    {isLegalReviewExpanded && (
                      <div className="transition-all duration-300">
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleLegalContentReview}
                            disabled={!createdCampaignId || isAnalyzingLegalContent}
                            className="flex items-center gap-2"
                          >
                            {isAnalyzingLegalContent ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4" />
                                {legalContentResults ? 'Re-analyze Legal Content' : 'Check Legal Content'}
                              </>
                            )}
                          </Button>
                        </div>
                        {legalContentResults && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium">Legal Content Analysis Results</h5>
                              <span className="text-sm text-muted-foreground">
                                Last analyzed: {new Date(legalContentResults.analyzedAt).toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Overall Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-primary">
                                  {legalContentResults.totalMessages}
                                </div>
                                <div className="text-sm text-muted-foreground">Total Messages</div>
                              </div>
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className={`text-2xl font-bold ${
                                  legalContentResults.overallSummary.appropriateMessages === legalContentResults.totalMessages
                                    ? 'text-green-600' 
                                    : legalContentResults.overallSummary.appropriateMessages > 0
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }`}>
                                  {legalContentResults.overallSummary.appropriateMessages}/{legalContentResults.totalMessages}
                                </div>
                                <div className="text-sm text-muted-foreground">Approved</div>
                              </div>
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className={`text-2xl font-bold ${
                                  legalContentResults.overallSummary.highRiskMessages === 0
                                    ? 'text-green-600' 
                                    : legalContentResults.overallSummary.highRiskMessages > 0
                                    ? 'text-red-600'
                                    : 'text-yellow-600'
                                }`}>
                                  {legalContentResults.overallSummary.highRiskMessages}
                                </div>
                                <div className="text-sm text-muted-foreground">High Risk</div>
                              </div>
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <div className="text-2xl font-bold text-primary">
                                  {legalContentResults.allProhibitedWords.length}
                                </div>
                                <div className="text-sm text-muted-foreground">Prohibited Words</div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Target Audience</label>
                                <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                                  {legalContentResults.targetAudience}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Target Market</label>
                                <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                                  {legalContentResults.targetMarket}
                                </p>
                              </div>
                            </div>
                            
                            {/* All Prohibited Words */}
                            {legalContentResults.allProhibitedWords.length > 0 && (
                              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <h5 className="font-medium text-destructive mb-2">Prohibited Words Found</h5>
                                <div className="flex flex-wrap gap-2">
                                  {legalContentResults.allProhibitedWords.map((word, index) => (
                                    <span key={index} className="px-2 py-1 bg-destructive/20 text-destructive text-sm rounded">
                                      {word}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Individual Message Analyses */}
                            <div className="space-y-4">
                              <h5 className="font-medium">Individual Message Analysis</h5>
                              {legalContentResults.messageAnalyses.map((msgAnalysis, index) => (
                                <div key={index} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {msgAnalysis.isOriginal ? 'Original' : 'Localized'} Message
                                      </span>
                                      <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                                        {msgAnalysis.language}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        msgAnalysis.legalAnalysis.isAppropriate 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {msgAnalysis.legalAnalysis.isAppropriate ? 'APPROVED' : 'REJECTED'}
                                      </span>
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        msgAnalysis.legalAnalysis.riskLevel === 'LOW' 
                                          ? 'bg-green-100 text-green-800' 
                                          : msgAnalysis.legalAnalysis.riskLevel === 'MEDIUM'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {msgAnalysis.legalAnalysis.riskLevel}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Message Content</label>
                                    <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                                      {msgAnalysis.message}
                                    </p>
                                  </div>
                                  
                                  {msgAnalysis.legalAnalysis.prohibitedWords.length > 0 && (
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Prohibited Words</label>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {msgAnalysis.legalAnalysis.prohibitedWords.map((word, wordIndex) => (
                                          <span key={wordIndex} className="px-2 py-1 bg-destructive/20 text-destructive text-sm rounded">
                                            {word}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Analysis</label>
                                    <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                                      {msgAnalysis.legalAnalysis.analysis}
                                    </p>
                                  </div>
                                  
                                  {msgAnalysis.legalAnalysis.recommendations && (
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Recommendations</label>
                                      <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                                        {msgAnalysis.legalAnalysis.recommendations}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {!legalContentResults && (
                          <div className="text-center py-8">
                            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                              Click "Check Legal Content" to analyze your campaign message for legal compliance and appropriateness.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 6 && campaignBrief && (
            <FinalReviewStep 
              campaignBrief={campaignBrief}
              assets={assets}
              generatedCreatives={generatedCreatives}
              campaignId={createdCampaignId}
            />
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex-shrink-0 flex justify-between items-center p-6 pt-4 border-t bg-background">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1) as Step)}
            disabled={!canGoPrevious()}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 2 ? 'Campaign Brief' : 
             currentStep === 3 ? 'Upload & Generate Assets' :
             currentStep === 4 ? 'Creative Preview' :
             currentStep === 5 ? 'Message Customization' :
             currentStep === 6 ? 'Compliance Check' : 'Previous'}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            
            {currentStep < 6 ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext() || isCreatingDraft}
                className="flex items-center gap-2"
              >
                {isCreatingDraft ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {editingCampaign ? 'Updating...' : 'Creating Draft...'}
                  </>
                ) : (
                  <>
                    {currentStep === 1 ? (editingCampaign ? 'Update & Continue' : 'Create & Continue') : 
                     currentStep === 2 ? 'Creative Preview' : 
                     currentStep === 3 ? 'Message Customization' :
                     currentStep === 4 ? 'Compliance Check' :
                     currentStep === 5 ? 'Final Review' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {editingCampaign ? 'Update Campaign' : 'Complete Campaign'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>

    {/* Regenerate Message Modal */}
    <RegenerateMessageModal
      isOpen={showRegenerateModal}
      onClose={() => setShowRegenerateModal(false)}
      onRegenerate={handleRegenerateMessage}
      isRegenerating={isRegenerating}
      currentMessage={campaignBrief?.campaignMessage || ''}
    />

    {/* Translation Modal */}
    <TranslationModal
      isOpen={showTranslationModal}
      onClose={() => setShowTranslationModal(false)}
      onTranslationComplete={() => {
        // Refresh localized messages list after translation is complete
        setRefreshLocalizedMessages(prev => prev + 1);
      }}
      campaignId={createdCampaignId || ''}
      originalMessage={campaignBrief?.campaignMessage || ''}
    />
    </>
  );
}

// Regenerate Message Modal Component
interface RegenerateMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (additionalInstructions: string) => void;
  isRegenerating: boolean;
  currentMessage: string;
}

function RegenerateMessageModal({ isOpen, onClose, onRegenerate, isRegenerating, currentMessage }: RegenerateMessageModalProps) {
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegenerate(additionalInstructions);
  };

  const handleClose = () => {
    setAdditionalInstructions('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      center
      classNames={{
        modal: 'max-w-lg w-full p-0 bg-background rounded-lg',
        overlay: 'bg-black/50',
        modalContainer: 'flex items-center justify-center p-4'
      }}
      showCloseIcon={true}
      closeOnOverlayClick={!isRegenerating}
      closeOnEsc={!isRegenerating}
    >
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Regenerate Campaign Message</h3>
            <p className="text-muted-foreground text-sm">
              Provide additional instructions to customize the campaign message generation.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Current Message</label>
            <div className="mt-1 p-3 bg-muted/50 rounded-md min-h-[80px] max-h-[120px] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">
                {currentMessage || 'No current message'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="instructions" className="text-sm font-medium text-muted-foreground">
                Additional Instructions (Optional)
              </label>
              <textarea
                id="instructions"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="e.g., Make it more emotional, focus on sustainability, use a professional tone..."
                className="mt-1 w-full p-3 border border-input rounded-md resize-none bg-textarea-background"
                rows={4}
                disabled={isRegenerating}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isRegenerating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRegenerating}
                className="flex items-center gap-2"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Regenerate Message
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
