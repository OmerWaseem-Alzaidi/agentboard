import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CompanyKnowledge } from '@/types';
import { db } from '@/lib/powersync';
import { uploadCompanyDocument, deleteCompanyDocument } from '@/lib/knowledge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Trash2, X, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { TextShimmer } from '@/components/ui/text-shimmer';

interface KnowledgeBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeBaseDialog({ open, onOpenChange }: KnowledgeBaseDialogProps) {
  const [docs, setDocs] = useState<CompanyKnowledge[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      for await (const result of db.watch(
        'SELECT * FROM company_knowledge ORDER BY created_at DESC',
        []
      )) {
        if (cancelled) break;
        const rows: CompanyKnowledge[] = [];
        if (result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            rows.push(result.rows.item(i) as CompanyKnowledge);
          }
        }
        setDocs(rows);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (status) {
      const t = setTimeout(() => setStatus(null), 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setStatus(null);

    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadCompanyDocument(file);
        successCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setStatus({ type: 'error', message: `${file.name}: ${msg}` });
      }
    }

    if (successCount > 0) {
      setStatus({ type: 'success', message: `${successCount} file${successCount > 1 ? 's' : ''} uploaded` });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (doc: CompanyKnowledge) => {
    if (!doc.id) {
      setStatus({ type: 'error', message: 'Cannot delete: missing document ID' });
      return;
    }
    try {
      await deleteCompanyDocument(doc.id, doc.storage_path);
      setStatus({ type: 'success', message: `Deleted ${doc.filename}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      console.error('Delete failed:', err);
      setStatus({ type: 'error', message: msg });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const getFileIcon = () => {
    return <FileText className="h-4 w-4 text-neutral-400" />;
  };

  const formatSize = (text: string | null) => {
    if (!text) return 'No content';
    const chars = text.length;
    if (chars > 1000) return `${(chars / 1000).toFixed(1)}k chars`;
    return `${chars} chars`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-neutral-400" />
            <DialogTitle>Company Knowledge Base</DialogTitle>
          </div>
          <DialogDescription>
            Upload company documents so AI agents give company-specific answers.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 touch-manipulation ${
            dragOver
              ? 'border-blue-500/50 bg-blue-500/10'
              : 'border-neutral-700/50 hover:border-neutral-600/50 hover:bg-neutral-800/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-transparent" />
              <TextShimmer className="text-sm font-medium" duration={1.5}>
                Uploading documents...
              </TextShimmer>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-neutral-500" />
              <p className="text-sm text-neutral-300 font-medium">
                Drop files here or click to upload
              </p>
              <p className="text-xs text-neutral-500">
                .txt, .md, .pdf — Max 10MB per file
              </p>
            </div>
          )}
        </div>

        {/* Status message */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                status.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{status.message}</span>
              <button onClick={() => setStatus(null)}>
                <X className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-200" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Documents list */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {docs.length === 0 && (
            <p className="text-sm text-neutral-600 text-center py-6">
              No documents uploaded yet
            </p>
          )}
          <AnimatePresence initial={false}>
            {docs.map(doc => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/30 group"
              >
                {getFileIcon()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-200 font-medium truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatSize(doc.content_text)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc)}
                  className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-500/50"
                  aria-label={`Delete ${doc.filename}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {docs.length > 0 && (
          <p className="text-xs text-neutral-500 text-center">
            {docs.length} document{docs.length !== 1 ? 's' : ''} — Agents will use these as context when processing tasks
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
