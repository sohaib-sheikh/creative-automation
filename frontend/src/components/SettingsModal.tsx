import React, { useState, useEffect } from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Cloud, CheckCircle, AlertCircle, X, Settings, Upload, Palette, Sparkles } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [dropboxToken, setDropboxToken] = useState<string | null>(null);
  const [dropboxTokenExpiresAt, setDropboxTokenExpiresAt] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string>('');
  const [brandColors, setBrandColors] = useState({
    primary: '',
    secondary: '',
    accent: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isAnalyzingColors, setIsAnalyzingColors] = useState(false);

  // Load account settings function
  const loadAccountSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/account');
      if (response.ok) {
        const account = await response.json();
        if (account) {
          setDropboxToken(account.dropboxAccessToken);
          setDropboxTokenExpiresAt(account.dropboxTokenExpiresAt);
          setBrandLogo(account.brandLogo || '');
          setBrandColors(account.brandColors || { primary: '', secondary: '', accent: '' });
        }
      }
    } catch (error) {
      console.error('Error loading account settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load account settings on component mount
  useEffect(() => {
    if (isOpen) {
      loadAccountSettings();
    }
  }, [isOpen]);

  // Dropbox authentication functions
  const authenticateWithDropbox = async () => {
    setIsAuthenticating(true);
    try {
      // Get authorization URL from backend with redirect URI
      const redirectUri = `${window.location.origin}/dropbox-callback.html`;
      const response = await fetch(`/api/dropbox/auth?redirect_uri=${encodeURIComponent(redirectUri)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get Dropbox auth URL');
      }

      const data = await response.json();
      
      // Open Dropbox OAuth in a popup window
      const popup = window.open(
        data.authUrl,
        'dropbox-auth',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the popup to close and handle the result
      const checkClosed = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setIsAuthenticating(false);
          // Reload account settings to get the updated token information
          await loadAccountSettings();
        }
      }, 1000);

    } catch (error) {
      console.error('Dropbox authentication error:', error);
      alert('Failed to authenticate with Dropbox. Please try again.');
      setIsAuthenticating(false);
    }
  };

  const disconnectDropbox = async () => {
    localStorage.removeItem('dropbox_access_token');
    setDropboxToken(null);
    setDropboxTokenExpiresAt(null);
    await saveAccountSettings(null, brandLogo, brandColors);
  };

  const refreshDropboxToken = async () => {
    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/dropbox/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const result = await response.json();
      
      if (result.success) {
        setDropboxToken(result.access_token);
        setDropboxTokenExpiresAt(result.expires_at);
        localStorage.setItem('dropbox_access_token', result.access_token);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else {
        throw new Error(result.error || 'Failed to refresh token');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      alert('Failed to refresh Dropbox token. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return true;
    const expirationTime = new Date(expiresAt);
    const now = new Date();
    return expirationTime <= now;
  };

  const isTokenExpiringSoon = (expiresAt: string | null, bufferMinutes = 5) => {
    if (!expiresAt) return true;
    const expirationTime = new Date(expiresAt);
    const bufferTime = new Date(Date.now() + (bufferMinutes * 60 * 1000));
    return expirationTime <= bufferTime;
  };

  const saveAccountSettings = async (dropboxTokenValue?: string | null, logoValue?: string, colorsValue?: any) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dropboxAccessToken: dropboxTokenValue !== undefined ? dropboxTokenValue : dropboxToken,
          brandLogo: logoValue !== undefined ? logoValue : brandLogo,
          brandColors: colorsValue !== undefined ? colorsValue : brandColors
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save account settings');
      }

      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving account settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrandColorChange = (colorType: string, value: string) => {
    const newColors = { ...brandColors, [colorType]: value };
    setBrandColors(newColors);
  };

  const handleSaveSettings = async () => {
    await saveAccountSettings();
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file for the brand logo.');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch('/api/upload-brand-logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload logo');
      }

      const result = await response.json();
      
      // Update the brand logo URL in the state
      setBrandLogo(result.brandLogoUrl);
      
      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      
      console.log('Brand logo uploaded successfully:', result);
    } catch (error) {
      console.error('Error uploading brand logo:', error);
      alert(`Failed to upload brand logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingLogo(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleAnalyzeBrandColors = async () => {
    if (!brandLogo) {
      alert('Please upload a brand logo first before analyzing colors.');
      return;
    }

    setIsAnalyzingColors(true);
    try {
      const response = await fetch('/api/analyze-brand-colors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logoUrl: brandLogo
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze brand colors');
      }

      const result = await response.json();
      
      // Update the brand colors with the analyzed colors
      setBrandColors(result.brandColors);
      
      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      
      console.log('Brand colors analyzed successfully:', result);
    } catch (error) {
      console.error('Error analyzing brand colors:', error);
      alert(`Failed to analyze brand colors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzingColors(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      center
      classNames={{
        modal: 'rounded-lg max-w-2xl w-full mx-4',
        overlay: 'bg-black/50'
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Site Settings</h2>
        </div>

        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Settings saved successfully!</span>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Dropbox Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Cloud Storage Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium">Dropbox</h4>
                  <p className="text-sm text-muted-foreground">
                    Connect your Dropbox account to store and manage campaign assets
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {dropboxToken ? (
                    <>
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Connected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={refreshDropboxToken}
                          disabled={isAuthenticating}
                        >
                          {isAuthenticating ? 'Refreshing...' : 'Refresh'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={disconnectDropbox}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm" style={{ textWrap: 'nowrap' }}>Not Connected</span>
                      </div>
                      <Button 
                        onClick={authenticateWithDropbox}
                        disabled={isAuthenticating}
                        className="flex items-center gap-2"
                      >
                        <Cloud className="w-4 h-4" />
                        {isAuthenticating ? 'Connecting...' : 'Connect'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {dropboxToken && (
                <div className={`border rounded-md p-3 ${
                  isTokenExpired(dropboxTokenExpiresAt) 
                    ? 'bg-red-50 border-red-200' 
                    : isTokenExpiringSoon(dropboxTokenExpiresAt)
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className={`flex items-center gap-2 ${
                    isTokenExpired(dropboxTokenExpiresAt) 
                      ? 'text-red-700' 
                      : isTokenExpiringSoon(dropboxTokenExpiresAt)
                      ? 'text-yellow-700'
                      : 'text-green-700'
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Dropbox Connected Successfully</span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    isTokenExpired(dropboxTokenExpiresAt) 
                      ? 'text-red-600' 
                      : isTokenExpiringSoon(dropboxTokenExpiresAt)
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    Your campaign assets will be automatically uploaded to Dropbox for secure storage and easy sharing.
                    {dropboxTokenExpiresAt && (
                      <span className="block mt-1">
                        Token expires: {new Date(dropboxTokenExpiresAt).toLocaleString()}
                        {isTokenExpired(dropboxTokenExpiresAt) && (
                          <span className="text-red-600 font-medium"> (Expired - Please refresh)</span>
                        )}
                        {!isTokenExpired(dropboxTokenExpiresAt) && isTokenExpiringSoon(dropboxTokenExpiresAt) && (
                          <span className="text-yellow-600 font-medium"> (Expiring soon - Consider refreshing)</span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Brand Logo Card */}
            <Card>
              <CardHeader className="mb-2">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Brand Logo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload Button */}
                <div className="flex items-center gap-3">
                  <input
                    id="brand-logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={isUploadingLogo}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('brand-logo')?.click()}
                    disabled={isUploadingLogo}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  {brandLogo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBrandLogo('')}
                      disabled={isUploadingLogo}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                
                {/* Logo Preview */}
                {brandLogo && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">Current Logo:</p>
                    <img
                      src={brandLogo}
                      alt="Brand logo preview"
                      className="w-full object-contain border rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Brand Colors Card */}
            <Card>
              <CardHeader className="mb-2">
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Brand Colors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Primary Color */}
                <div className="space-y-2">
                  <Label htmlFor="primary-color" className="text-sm font-medium">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={brandColors.primary}
                      onChange={(e) => handleBrandColorChange('primary', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      type="text"
                      placeholder="#000000"
                      value={brandColors.primary}
                      onChange={(e) => handleBrandColorChange('primary', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-2">
                  <Label htmlFor="secondary-color" className="text-sm font-medium">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={brandColors.secondary}
                      onChange={(e) => handleBrandColorChange('secondary', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      type="text"
                      placeholder="#666666"
                      value={brandColors.secondary}
                      onChange={(e) => handleBrandColorChange('secondary', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-2">
                  <Label htmlFor="accent-color" className="text-sm font-medium">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent-color"
                      type="color"
                      value={brandColors.accent}
                      onChange={(e) => handleBrandColorChange('accent', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      type="text"
                      placeholder="#FF6B6B"
                      value={brandColors.accent}
                      onChange={(e) => handleBrandColorChange('accent', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Analyze Colors Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleAnalyzeBrandColors}
                    disabled={isAnalyzingColors || !brandLogo}
                    className="flex items-center gap-2 w-full"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isAnalyzingColors ? 'Analyzing...' : 'Analyze Logo Colors'}
                  </Button>
                  {!brandLogo ? (
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Upload a brand logo first to analyze colors
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Use AI to analyze your brand logo and get the best colors for your brand
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={handleSaveSettings}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
