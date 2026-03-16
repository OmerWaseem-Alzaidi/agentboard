import { useDroppable } from '@dnd-kit/core';
import type { Task } from '@/types';
import { TaskCard } from './TaskCard.tsx';
import { Badge } from '@/components/ui/badge';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function KanbanColumn({ id, title, count, color, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[min(320px,85vw)] md:w-auto snap-start bg-neutral-900/20 backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 md:p-5 border transition-colors duration-200 ${
        isOver
          ? 'border-neutral-500/50 bg-neutral-800/30'
          : 'border-neutral-700/50'
      }`}
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-neutral-100 text-sm md:text-base">{title}</h3>
          <Badge className="bg-neutral-800/80 text-neutral-300 border-neutral-600/50 text-xs">
            {count}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 md:space-y-4 min-h-[200px] md:min-h-[400px]">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} />
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-neutral-600 text-center py-12">No tasks</p>
        )}
      </div>
    </div>
  );
}
