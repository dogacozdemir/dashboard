'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileUploader } from '@/components/shared/FileUploader';
import { Sparkles } from 'lucide-react';
import type { BrandAssetType } from '../types';

interface BrandUploadPanelProps {
  companyId: string;
  onSuccess?: () => void;
}

export function BrandUploadPanel({ companyId, onSuccess }: BrandUploadPanelProps) {
  const router = useRouter();
  const t = useTranslations('Features.BrandVault');
  const [saving, setSaving]     = useState(false);
  const [assetKind, setAssetKind] = useState<'auto' | BrandAssetType>('auto');

  const TYPE_OPTIONS: Array<{ value: 'auto' | BrandAssetType; labelKey: string }> = [
    { value: 'auto',           labelKey: 'typeAuto' },
    { value: 'logo',           labelKey: 'typeLogo' },
    { value: 'brand-book',     labelKey: 'typeBrandBook' },
    { value: 'color-palette',  labelKey: 'typePalette' },
    { value: 'font',           labelKey: 'typeFont' },
    { value: 'other',          labelKey: 'typeOther' },
  ];

  async function handleUpload(files: Array<{ name: string; s3Key: string; contentType: string; size: number }>) {
    setSaving(true);
    try {
      const res = await fetch('/api/assets/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          companyId,
          assetType: assetKind === 'auto' ? null : assetKind,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[BrandUploadPanel]', err);
        return;
      }
      onSuccess?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.10] p-5 space-y-4"
      style={{
        background: 'rgba(29, 15, 29, 0.35)',
        backdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 1px 0 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-[#bea042]" />
          <h3 className="text-sm font-semibold text-white/85 tracking-tight">{t('uploadHeading')}</h3>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="brand-asset-kind" className="sr-only">
            {t('uploadKindSr')}
          </label>
          <select
            id="brand-asset-kind"
            value={assetKind}
            onChange={(e) => setAssetKind(e.target.value as 'auto' | BrandAssetType)}
            disabled={saving}
            className="w-full sm:w-auto sm:min-w-[220px] px-3 py-2 rounded-2xl text-xs font-medium text-white/80 outline-none cursor-pointer disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#1a0f1a]">
                {t(o.labelKey)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-white/28 mt-1.5 line-clamp-3">
            {t('uploadKindHint')}
          </p>
        </div>
      </div>

      <FileUploader
        bucket="brand"
        folder="brand"
        accept="image/*,application/pdf,font/ttf,font/otf,font/woff,font/woff2,.ttf,.otf,.woff,.woff2"
        maxFiles={20}
        onUpload={handleUpload}
        label={t('uploaderLabel')}
        hint={t('uploaderHint')}
      />
    </div>
  );
}
