import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Task } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GripVertical, Brain, Sparkles, Bot } from 'lucide-react';

const labelTagStyles: Record<string, string> = {
  research: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  writing: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  analysis: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
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

function getStatusText(label: string | null | undefined): string {
  if (label === 'research') return 'Searching';
  if (label === 'writing') return 'Writing';
  if (label === 'analysis') return 'Analyzing';
  return 'Processing';
}

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)${isDragging ? ' rotate(2deg)' : ''}`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const isAgent = task.assigned_to && task.assigned_to !== 'test-user';
  const isProcessing = task.status === 'in_progress';

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e as never);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx < 5 && dy < 5) {
      onClick?.(task);
    }
    pointerStart.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="cursor-move transition-all duration-300 border rounded-xl bg-neutral-800/60 backdrop-blur-sm border-neutral-700/50 hover:bg-neutral-700/70 p-4 sm:p-5 touch-manipulation"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h4 className="font-semibold text-neutral-100 leading-tight text-sm">
            {task.title}
          </h4>
          <GripVertical className="w-4 h-4 text-neutral-500 cursor-move shrink-0 ml-2" />
        </div>

        {task.description && (
          <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {task.label && labelTagStyles[task.label] && (
          <div className="flex flex-wrap gap-2">
            <Badge className={`text-xs backdrop-blur-sm ${labelTagStyles[task.label]}`}>
              {capitalize(task.label)}
            </Badge>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-700/30">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-300" />
            </span>
            <span className="shimmer-text text-sm font-medium">
              {getStatusText(task.label)}
            </span>
          </div>
        )}

        {!isProcessing && isAgent && (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-700/30">
            <Avatar className={`h-6 w-6 ${getAgentColor(task.assigned_to!)}`} size="sm">
              <AvatarFallback className="bg-transparent">
                {getAgentIcon(task.assigned_to!)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-neutral-400 font-medium">
              {formatAgentName(task.assigned_to!)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
