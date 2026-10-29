'use client';

import React, { useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface ProductImageUploadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  shape?: 'square' | 'rounded';
  presets?: Array<{ name: string; url: string }>;
}

export default function ProductImageUpload({
  value,
  onChange,
  label = 'Image',
  shape = 'rounded',
  presets = [],
}: ProductImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const processAndCompressFile = (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError('Image exceeds 3MB limit. Please choose a smaller file.');
      return;
    }

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
      processAndCompressFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="flex items-center gap-4">
        {/* Preview Container */}
        <div
          className={`relative w-20 h-20 bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 ${
            shape === 'rounded' ? 'rounded-xl' : 'rounded-lg'
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-400" />
          )}
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-2">
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
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400">JPG, PNG or WebP under 3MB (auto-compressed)</p>
        </div>
      </div>

      {presets.length > 0 && (
        <div className="pt-2">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
            Quick Presets
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onChange(preset.url)}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors cursor-pointer"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
