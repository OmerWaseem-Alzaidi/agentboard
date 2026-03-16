import { useEffect, useState, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { db, updateInSupabase } from '@/lib/powersync';
import { supabase } from '@/lib/supabase';
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
  const [tasks, setTasks] = useState<TasksByStatus>({
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
        bucketTasks(all);
      }
    })();
    return () => { cancelled = true; };
  }, [bucketTasks]);

  // Supabase Realtime: listen for agent-side changes and sync to local DB
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async (payload) => {
          try {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { id?: string }).id;
              if (oldId) {
                await db.execute('DELETE FROM tasks WHERE id = ?', [oldId]);
              }
              return;
            }

            const row = payload.new as Record<string, unknown>;
            if (!row.id) return;

            await db.execute(
              `INSERT OR REPLACE INTO tasks (id, title, description, status, label, assigned_to, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.id,
                row.title ?? '',
                row.description ?? null,
                row.status ?? 'todo',
                row.label ?? null,
                row.assigned_to ?? null,
                row.created_by ?? 'unknown',
                row.created_at ?? new Date().toISOString(),
                row.updated_at ?? new Date().toISOString(),
              ]
            );
          } catch (err) {
            console.error('Realtime sync error:', err);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fallback poll: fetch from Supabase every 8s in case Realtime misses something
  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await supabase.from('tasks').select('*');
        if (!data) return;
        for (const row of data) {
          await db.execute(
            `INSERT OR REPLACE INTO tasks (id, title, description, status, label, assigned_to, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              row.title ?? '',
              row.description ?? null,
              row.status ?? 'todo',
              row.label ?? null,
              row.assigned_to ?? null,
              row.created_by ?? 'unknown',
              row.created_at ?? new Date().toISOString(),
              row.updated_at ?? new Date().toISOString(),
            ]
          );
        }
      } catch (err) {
        console.error('Poll sync error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  const allTasks = [...tasks.todo, ...tasks.in_progress, ...tasks.review, ...tasks.done];

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            count={tasks[col.id as keyof TasksByStatus].length}
            tasks={tasks[col.id as keyof TasksByStatus]}
            onTaskClick={setSelectedTask}
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
      task={selectedTask}
      open={selectedTask !== null}
      onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
    />
    </>
  );
}
