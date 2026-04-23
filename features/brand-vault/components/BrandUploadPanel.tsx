'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/shared/FileUploader';
import { GlassCard } from '@/components/shared/GlassCard';
import { Upload } from 'lucide-react';

interface BrandUploadPanelProps {
  companyId: string;
  onSuccess?: () => void;
}

export function BrandUploadPanel({ companyId, onSuccess }: BrandUploadPanelProps) {
  const [saving, setSaving] = useState(false);

  async function handleUpload(files: Array<{ name: string; s3Key: string; contentType: string; size: number }>) {
    setSaving(true);
    try {
      await fetch('/api/assets/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, companyId }),
      });
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white/80">Upload Brand Assets</h3>
      </div>

      <FileUploader
        bucket="brand"
        folder="brand"
        accept="image/*,application/pdf,font/ttf,font/otf,font/woff,font/woff2,.ttf,.otf,.woff,.woff2"
        maxFiles={20}
        onUpload={handleUpload}
        label="Drop brand files here"
        hint="Logos (SVG/PNG), Brand Books (PDF), Fonts (TTF/OTF/WOFF) — max 50 MB"
      />
    </GlassCard>
  );
}
