'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2, AlertCircle, FileText, Image, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatFileSize } from '@/lib/utils/format';
import type { StorageBucket } from '@/lib/storage/s3';

interface UploadedFile {
  name:        string;
  s3Key:       string;
  url:         string;
  size:        number;
  contentType: string;
}

interface FileUploaderProps {
  bucket:      StorageBucket;
  folder:      string;
  accept?:     string;
  maxFiles?:   number;
  onUpload:    (files: UploadedFile[]) => void;
  className?:  string;
  label?:      string;
  hint?:       string;
}

type FileState = {
  file:     File;
  status:   'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  s3Key?:   string;
  error?:   string;
};

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  'image':       Image,
  'video':       Video,
  'application': FileText,
  'font':        FileText,
};

function getIcon(mime: string) {
  const category = mime.split('/')[0];
  return typeIcon[category] ?? FileText;
}

export function FileUploader({
  bucket,
  folder,
  accept = 'image/*,video/*,application/pdf',
  maxFiles = 10,
  onUpload,
  className,
  label = 'Drop files here or click to upload',
  hint,
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (fileState: FileState, index: number) => {
    const { file } = fileState;

    // Step 1: Get presigned URL from our API
    setFiles((prev) =>
      prev.map((f, i) => i === index ? { ...f, status: 'uploading', progress: 5 } : f)
    );

    let presignRes: { uploadUrl: string; s3Key: string };
    try {
      const res = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename:      file.name,
          contentType:   file.type,
          contentLength: file.size,
          bucket,
          folder,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to get upload URL');
      }
      presignRes = await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setFiles((prev) =>
        prev.map((f, i) => i === index ? { ...f, status: 'error', error: msg } : f)
      );
      return null;
    }

    // Step 2: Upload directly to S3 (client → S3, zero server bandwidth)
    try {
      setFiles((prev) =>
        prev.map((f, i) => i === index ? { ...f, progress: 20 } : f)
      );

      const uploadRes = await fetch(presignRes.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          // Must match signed headers in presigned URL generation.
          'x-amz-server-side-encryption': 'AES256',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`S3 upload failed (${uploadRes.status})`);
      }

      const publicUrl = presignRes.s3Key; // stored as key, resolved to URL when displayed

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: 'done', progress: 100, s3Key: presignRes.s3Key } : f
        )
      );

      return {
        name:        file.name,
        s3Key:       presignRes.s3Key,
        url:         publicUrl,
        size:        file.size,
        contentType: file.type,
      } satisfies UploadedFile;
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: 'error', error: 'S3 upload failed' } : f
        )
      );
      return null;
    }
  }, [bucket, folder]);

  const processFiles = useCallback(async (newFiles: File[]) => {
    const limited = newFiles.slice(0, maxFiles - files.length);
    const newStates: FileState[] = limited.map((f) => ({
      file: f, status: 'pending', progress: 0,
    }));

    if (newStates.length === 0) return;

    const startIndex = files.length;
    setFiles((prev) => [...prev, ...newStates]);

    // Start uploads outside setState updater to avoid duplicate side effects in dev/strict mode.
    newStates.forEach((state, relIdx) => {
      const absIdx = startIndex + relIdx;
      setTimeout(() => {
        uploadFile(state, absIdx).then((result) => {
          if (result) onUpload([result]);
        });
      }, relIdx * 200);
    });
  }, [files.length, maxFiles, onUpload, uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  }, [processFiles]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const completedCount = files.filter((f) => f.status === 'done').length;
  const hasFiles = files.length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all select-none',
          dragging
            ? 'border-indigo-500/60 bg-indigo-500/10 scale-[1.01]'
            : 'border-white/[0.1] bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.04]'
        )}
      >
        <div className={cn(
          'flex items-center justify-center w-12 h-12 rounded-2xl transition-colors',
          dragging ? 'bg-indigo-500/20' : 'bg-white/[0.05]'
        )}>
          <Upload className={cn('w-5 h-5', dragging ? 'text-indigo-400' : 'text-white/30')} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/60">{label}</p>
          {hint && <p className="text-xs text-white/30 mt-1">{hint}</p>}
          {!hint && (
            <p className="text-xs text-white/25 mt-1">
              Images, Videos, PDFs — max {maxFiles} files
            </p>
          )}
        </div>

        {/* Drag overlay pulse */}
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-2xl border-2 border-indigo-500/40 pointer-events-none"
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {/* File list */}
      <AnimatePresence>
        {hasFiles && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass glow-inset rounded-xl overflow-hidden"
          >
            {files.map((f, i) => {
              const Icon = getIcon(f.file.type);
              return (
                <div
                  key={`${f.file.name}-${i}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-white/40" />
                  </div>

                  {/* Info + progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-white/70 truncate">{f.file.name}</p>
                      <span className="text-[10px] text-white/25 shrink-0">
                        {formatFileSize(f.file.size)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    {f.status === 'uploading' && (
                      <div className="mt-1.5 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-indigo-500 rounded-full"
                          initial={{ width: '5%' }}
                          animate={{ width: `${f.progress}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    )}
                    {f.status === 'error' && (
                      <p className="text-[10px] text-red-400 mt-0.5">{f.error}</p>
                    )}
                  </div>

                  {/* Status icon */}
                  <div className="shrink-0">
                    {f.status === 'pending'   && <div className="w-4 h-4 rounded-full bg-white/10" />}
                    {f.status === 'uploading' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                    {f.status === 'done'      && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {f.status === 'error'     && <AlertCircle className="w-4 h-4 text-red-400" />}
                  </div>

                  {/* Remove */}
                  {(f.status === 'done' || f.status === 'error') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="text-white/20 hover:text-white/50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Summary footer */}
            {completedCount > 0 && (
              <div className="px-4 py-2 bg-emerald-500/5 border-t border-emerald-500/10">
                <p className="text-[11px] text-emerald-400">
                  {completedCount} file{completedCount > 1 ? 's' : ''} uploaded to S3 ✓
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
