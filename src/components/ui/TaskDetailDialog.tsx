import { useState } from 'react';
import type { Task } from '@/types';
import { db } from '@/lib/powersync';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Brain, Sparkles, Bot } from 'lucide-react';

const labelTagStyles: Record<string, string> = {
  research: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  writing: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  analysis: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatAgentName(name: string): string {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getAgentIcon(name: string) {
  if (name === 'research_agent') return <Brain className="h-3.5 w-3.5 text-blue-300" />;
  if (name === 'writer_agent') return <Sparkles className="h-3.5 w-3.5 text-emerald-300" />;
  if (name === 'analyst_agent') return <Bot className="h-3.5 w-3.5 text-purple-300" />;
  return <Bot className="h-3.5 w-3.5 text-neutral-300" />;
}

function getAgentColor(name: string): string {
  if (name === 'research_agent') return 'bg-blue-500/20';
  if (name === 'writer_agent') return 'bg-emerald-500/20';
  if (name === 'analyst_agent') return 'bg-purple-500/20';
  return 'bg-neutral-500/20';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/^---+.*$/gm, '')
    .replace(/^#{1,6}\s+(.+)$/gm, (_, h) => h.toUpperCase())
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!task) return null;

  const isAgent = task.assigned_to && task.assigned_to !== 'test-user';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await db.execute('DELETE FROM tasks WHERE id = ?', [task.id]);
      await supabase.from('tasks').delete().eq('id', task.id);
      setConfirming(false);
      onOpenChange(false);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) setConfirming(false);
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
            {task.label && labelTagStyles[task.label] && (
              <Badge className={labelTagStyles[task.label]}>
                {capitalize(task.label)}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {statusLabels[task.status] ?? task.status}
            </Badge>
          </div>
        </DialogHeader>

        {isAgent && (
          <div className="flex items-center gap-2">
            <Avatar className={`h-6 w-6 ${getAgentColor(task.assigned_to!)}`} size="sm">
              <AvatarFallback className="bg-transparent">
                {getAgentIcon(task.assigned_to!)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-neutral-400 font-medium">
              {formatAgentName(task.assigned_to!)}
            </span>
          </div>
        )}

        {task.description ? (
          <pre className="bg-neutral-800/50 p-4 rounded-lg text-sm text-neutral-300 whitespace-pre-wrap break-words font-sans leading-relaxed max-h-[50vh] overflow-y-auto border border-neutral-700/30">
            {cleanMarkdown(task.description)}
          </pre>
        ) : (
          <p className="text-sm text-neutral-500 italic">No description</p>
        )}

        <div className="border-t border-neutral-700/30 pt-3 flex items-center justify-between text-xs text-neutral-500">
          <span>Created {formatDate(task.created_at)}</span>
          <span>Updated {formatDate(task.updated_at)}</span>
        </div>

        <DialogFooter>
          {confirming ? (
            <div className="flex flex-col gap-2 w-full">
              <p className="text-sm text-destructive font-medium">
                Are you sure? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete permanently'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              Delete Task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
