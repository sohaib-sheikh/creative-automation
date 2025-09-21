import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, X, Image as ImageIcon, FileImage, Sparkles, Eye, Download } from 'lucide-react';
import { Asset } from '../types/asset';
import { dropboxService } from '../services/dropboxService';

interface ImageUploadProps {
  onAssetsChange: (assets: Asset[], operation: 'add' | 'remove') => void;
  productId: string; // Required: ID of the product this upload is associated with
  maxFiles?: number;
  acceptedTypes?: string[];
}

export function ImageUpload({ 
  onAssetsChange, 
  productId,
  maxFiles = 10, 
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] 
}: ImageUploadProps) {
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dropboxToken, setDropboxToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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


  const handleFiles = async (files: FileList) => {
    // Check if Dropbox is authenticated
    if (!dropboxToken) {
      alert('Please authenticate with Dropbox first to upload files.');
      return;
    }

    const newAssets: Asset[] = [];
    setIsUploading(true);
    
    for (const file of Array.from(files)) {
      // Check file type
      if (!acceptedTypes.includes(file.type)) {
        alert(`File type ${file.type} is not supported. Please upload images only.`);
        continue;
      }
      
      // Check if we're not exceeding max files
      if (uploadedAssets.length + newAssets.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed.`);
        break;
      }
      
      try {
        // Upload file directly to Dropbox via backend
        const formData = new FormData();
        formData.append('file', file);
        formData.append('accessToken', dropboxToken);
        
        const response = await fetch('/api/upload-asset', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          // Create asset object with Dropbox URL
          const asset: Asset = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            file, 
            imageUrl: result.dropboxUrl || result.asset.url, // Use Dropbox URL
            // name: file.name,
            // size: file.size,
            // type: file.type,
            productId, // Associate with the specific product
            dropboxPath: result.dropboxPath,
            dropboxUrl: result.dropboxUrl,
            type: 'uploaded',
          };
          
          newAssets.push(asset);
        } else {
          console.error('Upload failed:', result.error);
          alert(`Failed to upload ${file.name}: ${result.error}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
    
    if (newAssets.length > 0) {
      const updatedAssets = [...uploadedAssets, ...newAssets];
      console.log('ImageUpload: updatedAssets', updatedAssets.length);
      console.log('ImageUpload: newAssets', newAssets.length);
      console.log('ImageUpload: existing assets', uploadedAssets.length);
      setUploadedAssets(updatedAssets);
      onAssetsChange(newAssets, 'add');
    }
    
    setIsUploading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-6 w-full" style={{ margin:0 }}>

      <div className="w-full" style={{ margin:0 }}>

        <Button 
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 w-full"
          disabled={isUploading || !dropboxToken}
        >
          <ImageIcon className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Upload Image'}
        </Button>
      </div>

      {!dropboxToken && (
        <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md">
          Please connect to Dropbox first to upload files.
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}

// Utility function to convert UploadedAsset to storage-safe format (without File object)
export function getStorableAsset(asset: Asset): Asset {
  const { file, ...storableAsset } = asset;
  return storableAsset;
}

// Utility function to convert multiple assets to storage-safe format
export function getStorableAssets(assets: Asset[]): Asset[] {
  return assets.map(getStorableAsset);
}
