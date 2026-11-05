'use client';

import React, { useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon, Loader2, Check } from 'lucide-react';

interface ProductImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  shape?: 'square' | 'rounded';
  presets?: Array<{ name: string; url: string }>;
  uploadFolder?: string;
}

export default function ProductImageUpload({
  value,
  onChange,
  label = 'Image',
  shape = 'rounded',
  presets = [],
  uploadFolder = 'brands',
}: ProductImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const processAndUploadFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP, SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds 5MB limit. Please choose a smaller file.');
      return;
    }

    // Upload directly to server endpoint to save into public/uploads/brands folder
    if (uploadFolder) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', uploadFolder);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success && data.url) {
          onChange(data.url);
        } else {
          setError(data.error || 'Failed to upload image.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error during upload.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Fallback: client-side canvas compression for local previews
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          onChange(compressed);
        } else {
          onChange(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setError('Failed to process image.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">{label}</label>

      {/* Selected Image Preview & File Upload Row */}
      <div className="flex items-center gap-4">
        {/* Preview Container */}
        <div
          className={`relative w-24 h-16 bg-gray-50 border-2 flex items-center justify-center overflow-hidden shrink-0 ${
            value ? 'border-brand-blue/60 bg-blue-50/20' : 'border-dashed border-gray-300'
          } ${shape === 'rounded' ? 'rounded-xl' : 'rounded-lg'}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Brand Logo Preview" className="w-full h-full object-contain p-1" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-400" />
          )}
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Uploading to public...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload Custom File</span>
                </>
              )}
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400">Upload any PNG, JPG, or SVG image file</p>
        </div>
      </div>

      {/* Preset Brand Logos / Labels matching user requirement */}
      {presets.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            Or Select Brand Logo Label:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {presets.map((preset) => {
              const isSelected = value === preset.url;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onChange(preset.url)}
                  className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-brand-blue bg-blue-50/50 shadow-2xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="w-9 h-7 bg-white rounded border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold block truncate ${isSelected ? 'text-brand-blue' : 'text-gray-800'}`}>
                      {preset.name}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-blue shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
    </div>
  );
}
