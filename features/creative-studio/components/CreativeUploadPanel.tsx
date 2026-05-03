'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Calendar, Clapperboard, Loader2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GlassCard } from '@/components/shared/GlassCard';
import type { SocialPlatform } from '@/features/calendar/types';

interface CreativeUploadPanelProps {
  companyId: string;
  onSuccess?: () => void;
}

interface PendingFile {
  file: File;
}

const PLATFORMS: SocialPlatform[] = ['meta', 'google', 'tiktok', 'instagram', 'linkedin', 'x'];

function platformOptionLabel(t: (key: string) => string, p: SocialPlatform): string {
  switch (p) {
    case 'meta': return t('platformMeta');
    case 'google': return t('platformGoogle');
    case 'tiktok': return t('platformTiktok');
    case 'instagram': return t('platformInstagram');
    case 'linkedin': return t('platformLinkedin');
    case 'x': return t('platformX');
    default: return p;
  }
}

export function CreativeUploadPanel({ companyId, onSuccess }: CreativeUploadPanelProps) {
  const router = useRouter();
  const t = useTranslations('Features.Creative');
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [caption, setCaption] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canUpload = useMemo(
    () => !!pendingFile && title.trim().length > 1 && !!scheduledDate,
    [pendingFile, title, scheduledDate]
  );

  function resetModal() {
    setPendingFile(null);
    setTitle('');
    setPlatform('instagram');
    setCaption('');
    setScheduledDate('');
    setScheduledTime('');
    setError(null);
  }

  function openModalWithFile(file: File) {
    setPendingFile({ file });
    setTitle(file.name.replace(/\.[^.]+$/, ''));
    setError(null);
  }

  function handlePickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    openModalWithFile(fileList[0]);
  }

  async function uploadCreative() {
    if (!pendingFile) return;
    const file = pendingFile.file;

    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
        bucket: 'creative',
        folder: 'creative',
      }),
    });

    if (!presignRes.ok) {
      throw new Error('__PRESIGN__');
    }

    const { uploadUrl, s3Key } = (await presignRes.json()) as {
      uploadUrl: string;
      s3Key: string;
    };

    const s3PutRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-amz-server-side-encryption': 'AES256',
      },
      body: file,
    });

    if (!s3PutRes.ok) {
      throw new Error(`__S3__:${s3PutRes.status}`);
    }

    const saveRes = await fetch('/api/assets/creative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        files: [
          {
            name: file.name,
            s3Key,
            contentType: file.type,
            title: title.trim(),
            platform,
            caption: caption.trim(),
            scheduledDate,
            scheduledTime: scheduledTime || undefined,
          },
        ],
      }),
    });

    if (!saveRes.ok) {
      throw new Error('__SAVE__');
    }

    router.refresh();
    onSuccess?.();
    resetModal();
  }

  function handleUploadClick() {
    startTransition(async () => {
      try {
        setError(null);
        await uploadCreative();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === '__PRESIGN__') setError(t('uploadErrorPresign'));
        else if (msg.startsWith('__S3__:')) setError(t('uploadErrorS3', { status: msg.replace('__S3__:', '') }));
        else if (msg === '__SAVE__') setError(t('uploadErrorSave'));
        else if (msg) setError(msg);
        else setError(t('uploadErrorGeneric'));
      }
    });
  }

  return (
    <>
      <GlassCard padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white/80">{t('uploadPanelTitle')}</h3>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handlePickedFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            dragging
              ? 'border-indigo-500/60 bg-indigo-500/10'
              : 'border-white/[0.1] bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.05] flex items-center justify-center">
              <Upload className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60">{t('uploadDropTitle')}</p>
              <p className="text-xs text-white/42 mt-1">
                {t('uploadDropHint')}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handlePickedFiles(e.target.files)}
        />
      </GlassCard>

      <Dialog open={!!pendingFile} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="max-w-lg bg-[#161625] border-white/[0.1] text-white/90">
          <DialogHeader>
            <DialogTitle className="text-white/90">{t('modalTitle')}</DialogTitle>
            <DialogDescription className="text-white/40">
              {t('modalDescription')}
            </DialogDescription>
          </DialogHeader>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3">
              <p className="text-xs text-white/35 mb-1">{t('selectedFile')}</p>
              <p className="text-sm text-white/70 truncate">{pendingFile?.file.name}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">{t('labelPostTitle')}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all"
                placeholder={t('placeholderPostTitle')}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">{t('labelPlatform')}</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all"
              >
                {PLATFORMS.map((value) => (
                  <option key={value} value={value}>{platformOptionLabel(t, value)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/40">{t('labelCaption')}</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all resize-none"
                placeholder={t('placeholderCaption')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-white/40">{t('labelScheduleDate')}</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">{t('labelScheduleTime')}</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </motion.div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={resetModal}
              className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.09] transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={!canUpload || isPending}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              {t('upload')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
