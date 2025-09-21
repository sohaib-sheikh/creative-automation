import { LocalizedMessage, TranslationRequest } from '../types/localizedMessage';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-api.com' 
  : 'http://localhost:5002';

export class TranslationService {
  static async translateMessage(translationRequest: TranslationRequest): Promise<LocalizedMessage> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(translationRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to translate message');
      }

      const data = await response.json();
      return data.localizedMessage;
    } catch (error) {
      console.error('Error translating message:', error);
      throw error;
    }
  }

  static async getLocalizedMessages(campaignId: string): Promise<LocalizedMessage[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/localized-messages`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch localized messages');
      }

      const data = await response.json();
      return data.localizedMessages;
    } catch (error) {
      console.error('Error fetching localized messages:', error);
      throw error;
    }
  }

  static async deleteLocalizedMessage(messageId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/localized-messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete localized message');
      }
    } catch (error) {
      console.error('Error deleting localized message:', error);
      throw error;
    }
  }
}
