import React, { useState } from 'react';
import { ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onError?: () => void;
}

export function ImageWithFallback({ 
  src, 
  alt, 
  className = '', 
  fallbackClassName = '',
  onError 
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError || !src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${fallbackClassName}`}>
        <ImageIcon className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
