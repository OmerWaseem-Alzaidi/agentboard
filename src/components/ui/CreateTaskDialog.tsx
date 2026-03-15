import { useState } from 'react';
import { db, upsertToSupabase } from '@/lib/powersync';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const taskId = crypto.randomUUID();
      const now = new Date().toISOString();

      const record = {
        id: taskId,
        title: title.trim(),
        description: description.trim() || null,
        status: 'todo',
        label: label || null,
        assigned_to: null,
        created_by: 'test-user',
        created_at: now,
        updated_at: now,
      };

      await db.execute(
        "INSERT INTO tasks (id, title, description, status, label, assigned_to, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [record.id, record.title, record.description, record.status, record.label, record.assigned_to, record.created_by, record.created_at, record.updated_at]
      );

      await upsertToSupabase('tasks', record);

      setTitle('');
      setDescription('');
      setLabel('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to your board.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-label">Label</Label>
            <select
              id="task-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-neutral-700/50 bg-neutral-800/60 px-3 py-1 text-sm text-neutral-200 shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">No label</option>
              <option value="research">Research</option>
              <option value="writing">Writing</option>
              <option value="analysis">Analysis</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!title.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
