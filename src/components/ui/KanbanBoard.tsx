import { useEffect, useState, useCallback, useRef } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { db, updateInSupabase } from '@/lib/powersync';
import { supabase } from '@/lib/supabase';
import { wasUserDeletedTask } from '@/lib/deleted-tasks';
import type { Task } from '@/types';
import { KanbanColumn } from './KanbanColumn.tsx';
import { TaskDetailDialog } from './TaskDetailDialog.tsx';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';

type TasksByStatus = {
  todo: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
};

const columns = [
  { id: 'todo', title: 'To Do', color: '#8B7355' },
  { id: 'in_progress', title: 'In Progress', color: '#6B8E23' },
  { id: 'review', title: 'Review', color: '#CD853F' },
  { id: 'done', title: 'Done', color: '#556B2F' },
] as const;

const labelTagStyles: Record<string, string> = {
  research: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  writing: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  analysis: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export function KanbanBoard() {
  /** Stale PUT/sync can re-insert a row; only purge once per id per mount to avoid loops. */
  const ghostPurgeScheduled = useRef<Set<string>>(new Set());

  const [tasks, setTasks] = useState<TasksByStatus>({
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const allTasks = [...tasks.todo, ...tasks.in_progress, ...tasks.review, ...tasks.done];
  const displayedTask = selectedTaskId ? allTasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const bucketTasks = useCallback((all: Task[]) => {
    setTasks({
      todo: all.filter(t => t.status === 'todo'),
      in_progress: all.filter(t => t.status === 'in_progress'),
      review: all.filter(t => t.status === 'review'),
      done: all.filter(t => t.status === 'done'),
    });
  }, []);

  // Watch local PowerSync DB for changes (instant for local writes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for await (const result of db.watch('SELECT * FROM tasks ORDER BY created_at DESC', [])) {
        if (cancelled) break;
        const all: Task[] = [];
        if (result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            all.push(result.rows.item(i) as Task);
          }
        }
        // Hide using localStorage-backed wasUserDeletedTask (30d). Do NOT use only
        // getRecentlyDeletedIds() — that expires in ~30m and ghosts reappear when SQLite re-syncs.
        for (const t of all) {
          if (wasUserDeletedTask(t.id) && !ghostPurgeScheduled.current.has(t.id)) {
            ghostPurgeScheduled.current.add(t.id);
            const id = t.id;
            void (async () => {
              try {
                await db.execute('DELETE FROM task_messages WHERE task_id = ?', [id]);
                await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
                await supabase.from('task_messages').delete().eq('task_id', id);
                await supabase.from('tasks').delete().eq('id', id);
              } catch (e) {
                console.error('Purge resurrected deleted task failed:', id, e);
              }
            })();
          }
        }
        bucketTasks(all.filter((t) => !wasUserDeletedTask(t.id)));
      }
    })();
    return () => { cancelled = true; };
  }, [bucketTasks]);

  // No Supabase Realtime here. Both `tasks` and `task_messages` must flow only through PowerSync.
  // Realtime + PowerSync both writing SQLite caused infinite UPDATE/upload loops (same row ping-pong).

  const handleDragStart = (event: DragStartEvent) => {
    const task = allTasks.find(t => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as Task['status'];
    const task = allTasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const now = new Date().toISOString();

    await db.execute(
      'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
      [newStatus, now, taskId]
    );

    await updateInSupabase('tasks', taskId, { status: newStatus, updated_at: now });
  };

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Mobile: horizontal scroll with swipe; md+: grid */}
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 overflow-x-auto overflow-y-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            count={tasks[col.id as keyof TasksByStatus].length}
            tasks={tasks[col.id as keyof TasksByStatus]}
            onTaskClick={(task) => setSelectedTaskId(task.id)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="bg-neutral-800/90 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-neutral-600/50 w-[260px] rotate-2 scale-105">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-sm font-semibold text-neutral-100">{activeTask.title}</h3>
              <GripVertical className="w-4 h-4 text-neutral-500 shrink-0" />
            </div>
            {activeTask.description && (
              <p className="text-xs text-neutral-400 line-clamp-2 mb-2">{activeTask.description}</p>
            )}
            {activeTask.label && labelTagStyles[activeTask.label] && (
              <Badge className={`text-xs ${labelTagStyles[activeTask.label]}`}>
                {activeTask.label.charAt(0).toUpperCase() + activeTask.label.slice(1)}
              </Badge>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>

    <TaskDetailDialog
      task={displayedTask}
      open={selectedTaskId !== null}
      onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}
    />
    </>
  );
}
