'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, User } from 'lucide-react';

interface AvatarUploadInputProps {
  currentAvatarUrl?: string;
  onChange: (url: string) => void;
  name?: string;
}

const PRESET_AVATARS = [
  {
    name: 'Executive Male',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Executive Female',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Staff Male',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Staff Female',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
  },
];

export default function AvatarUploadInput({
  currentAvatarUrl,
  onChange,
  name,
}: AvatarUploadInputProps) {
  const [preview, setPreview] = useState<string>(currentAvatarUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);

    // Limit to 5MB raw
    if (file.size > 5 * 1024 * 1024) {
      setError('Selected image exceeds 5MB limit.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress using Canvas: 240x240 max square
        const canvas = document.createElement('canvas');
        const maxDim = 240;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Failed to process image canvas.');
          setIsProcessing(false);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

        setPreview(compressedDataUrl);
        onChange(compressedDataUrl);
        setIsProcessing(false);
      };

      img.onerror = () => {
        setError('Failed to load image file.');
        setIsProcessing(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setError('Failed to read file.');
      setIsProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (url: string) => {
    setPreview(url);
    onChange(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* Avatar Preview */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-slate-100 flex items-center justify-center shrink-0 shadow-xs">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={name || 'Employee Avatar'}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-slate-400" />
          )}

          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-full hover:bg-red-700 transition-colors cursor-pointer"
              title="Remove Avatar"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="avatar-file-upload"
          />

          <div className="flex items-center gap-2">
            <label
              htmlFor="avatar-file-upload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-brand-blue" />
              <span>{isProcessing ? 'Optimizing...' : 'Upload Avatar'}</span>
            </label>

            {preview && (
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>

          <span className="text-[11px] text-gray-400 block mt-1">
            Square PNG, JPG, or WEBP (auto-compressed for demo)
          </span>
          {error && <span className="text-[11px] text-red-600 block mt-1">{error}</span>}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
        <span className="text-gray-400 font-medium">Presets:</span>
        {PRESET_AVATARS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => handleSelectPreset(p.url)}
            className="px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors cursor-pointer text-[10px]"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
