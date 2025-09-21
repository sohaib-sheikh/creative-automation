import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { TranslationService } from '../services/translationService';
import { LocalizedMessage } from '../types/localizedMessage';
import { Languages, Trash2, Loader2 } from 'lucide-react';

interface LocalizedMessagesListProps {
  campaignId: string;
  onRefresh?: () => void;
  refreshTrigger?: number;
}

export function LocalizedMessagesList({ campaignId, onRefresh, refreshTrigger }: LocalizedMessagesListProps) {
  const [localizedMessages, setLocalizedMessages] = useState<LocalizedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchLocalizedMessages = async () => {
    try {
      setIsLoading(true);
      setError('');
      const messages = await TranslationService.getLocalizedMessages(campaignId);
      setLocalizedMessages(messages);
    } catch (error) {
      console.error('Error fetching localized messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch localized messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this translation?')) {
      return;
    }

    try {
      setDeletingIds(prev => new Set(prev).add(messageId));
      await TranslationService.deleteLocalizedMessage(messageId);
      setLocalizedMessages(prev => prev.filter(msg => msg.id !== messageId));
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting localized message:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete translation');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };


  useEffect(() => {
    if (campaignId) {
      fetchLocalizedMessages();
    }
  }, [campaignId]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchLocalizedMessages();
    }
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading translations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={fetchLocalizedMessages}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (localizedMessages.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Languages className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium mb-2">No Translations Yet</h4>
          <p className="text-muted-foreground">
            Translate your campaign message to different languages to reach global audiences.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex items-center gap-3">
        <Languages className="w-5 h-5 text-primary" />
        <h4 className="text-lg font-medium">Localized Messages</h4>
        <Badge variant="secondary">{localizedMessages.length}</Badge>
      </div>

      <div className="space-y-0">
        {localizedMessages.map((message, index) => (
          <div key={message.id}>
            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-medium">
                  {message.targetLanguage}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(message.id)}
                  disabled={deletingIds.has(message.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  {deletingIds.has(message.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {message.additionalInstructions && (
                <div className="w-full">
                  <label className="text-xs font-medium text-muted-foreground">Translation Instructions:</label>
                  <div className="text-xs mt-1 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                    {message.additionalInstructions}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Translated Message</label>
                <p className="text-sm mt-1 p-2 bg-muted/50 rounded border">
                  {message.translatedMessage}
                </p>
              </div>
            </div>
            {index < localizedMessages.length - 1 && (
              <hr className="border-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
