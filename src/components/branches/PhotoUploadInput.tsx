'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface PhotoUploadInputProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

const PRESET_STORE_PHOTOS = [
  {
    name: 'Showroom Facade',
    url: 'https://images.unsplash.com/photo-1555529771-7888783a18d3?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Mattress Display Plaza',
    url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Wholesale Depot Strip',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Corner Bedding Studio',
    url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80',
  },
];

export default function PhotoUploadInput({
  value,
  onChange,
  label = 'Storefront Photo',
}: PhotoUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Compress image to canvas max 800px width/height and quality 0.8
  const processAndCompressFile = (file: File) => {
    setError(null);

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    // Validate original size limit (max 3MB before compression)
    if (file.size > 3 * 1024 * 1024) {
      setError('Original image exceeds 3MB limit. Please choose a smaller file.');
      return;
    }

    setIsCompressing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback to original data URL
            onChange(e.target?.result as string);
            setIsCompressing(false);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          onChange(compressedDataUrl);
        } catch {
          // If canvas fails (e.g. cross-origin), fallback
          onChange(e.target?.result as string);
        } finally {
          setIsCompressing(false);
        }
      };

      img.onerror = () => {
        setError('Failed to load image preview.');
        setIsCompressing(false);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setError('Error reading local file.');
      setIsCompressing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndCompressFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] text-red-600 hover:text-red-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 h-36 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Branch Storefront Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-semibold shadow-md hover:bg-gray-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Change Photo</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-brand-blue rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/20"
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-brand-blue">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-800">
              {isCompressing ? 'Compressing photo...' : 'Upload Storefront Image'}
            </span>
            <span className="text-[11px] text-gray-400">
              PNG, JPG or WEBP (automatically optimized for demo storage)
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-600 font-medium">{error}</p>
      )}

      {/* Quick Demo Presets */}
      <div className="pt-1">
        <span className="text-[10px] text-gray-400 block mb-1">
          Or select a demo storefront preset:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_STORE_PHOTOS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange(preset.url)}
              className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-md text-[10px] font-medium text-gray-600 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ImageIcon className="w-3 h-3 text-brand-blue" />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
