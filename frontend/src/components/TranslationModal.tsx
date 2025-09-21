import React, { useState } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Button } from './ui/button';
import { TranslationService } from '../services/translationService';
import { SUPPORTED_LANGUAGES, TranslationRequest } from '../types/localizedMessage';
import { Languages, Loader2 } from 'lucide-react';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranslationComplete: () => void;
  campaignId: string;
  originalMessage: string;
}

export function TranslationModal({ 
  isOpen, 
  onClose, 
  onTranslationComplete, 
  campaignId, 
  originalMessage 
}: TranslationModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLanguage) {
      setError('Please select a target language');
      return;
    }

    setIsTranslating(true);
    setError('');

    try {
      const selectedLang = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);
      if (!selectedLang) {
        throw new Error('Selected language not found');
      }

      const translationRequest: TranslationRequest = {
        campaignId,
        originalMessage,
        targetLanguage: selectedLang.name,
        languageCode: selectedLang.code,
        additionalInstructions: additionalInstructions.trim() || undefined
      };

      await TranslationService.translateMessage(translationRequest);
      
      // Reset form
      setSelectedLanguage('');
      setAdditionalInstructions('');
      setError('');
      
      // Notify parent component
      onTranslationComplete();
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Translation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to translate message');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClose = () => {
    if (!isTranslating) {
      setSelectedLanguage('');
      setAdditionalInstructions('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      center
      classNames={{
        modal: 'max-w-2xl w-full p-0 bg-background rounded-lg',
        overlay: 'bg-black/50',
        modalContainer: 'flex items-center justify-center p-4'
      }}
      showCloseIcon={true}
      closeOnOverlayClick={!isTranslating}
      closeOnEsc={!isTranslating}
    >
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Translate Campaign Message</h3>
            <p className="text-muted-foreground text-sm">
              Translate your campaign message to different languages to reach global audiences.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Original Message Display */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Original Message</label>
              <div className="mt-1 p-3 bg-muted/50 rounded-md min-h-[80px] max-h-[120px] overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {originalMessage || 'No message to translate'}
                </p>
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label htmlFor="target-language" className="text-sm font-medium text-muted-foreground">
                Target Language *
              </label>
              <select
                id="target-language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="mt-1 w-full p-3 border border-input rounded-md bg-input-background"
                disabled={isTranslating}
                required
              >
                <option value="">Select a language</option>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name} ({language.nativeName})
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Instructions */}
            <div>
              <label htmlFor="additional-instructions" className="text-sm font-medium text-muted-foreground">
                Additional Instructions (Optional)
              </label>
              <textarea
                id="additional-instructions"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="e.g., Use formal tone, focus on sustainability, make it more emotional, adapt for local culture..."
                className="mt-1 w-full p-3 border border-input rounded-md resize-none bg-textarea-background"
                rows={4}
                disabled={isTranslating}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide specific instructions to customize the translation style, tone, or focus.
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isTranslating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isTranslating || !selectedLanguage}
                className="flex items-center gap-2"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4" />
                    Translate Message
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
