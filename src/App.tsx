import { useEffect, useState } from 'react';
import { initPowerSync } from './lib/powersync';
import { KanbanBoard } from '@/components/ui/KanbanBoard';
import { CreateTaskDialog } from '@/components/ui/CreateTaskDialog';
import { Plus } from 'lucide-react';

function App() {
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    initPowerSync()
      .then(() => setSyncing(true))
      .catch((err: unknown) => console.error('PowerSync init failed', err));
  }, []);

  if (!syncing) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neutral-400 border-t-transparent mb-4" />
          <h1 className="text-2xl font-light mb-2 text-neutral-100">AgentBoard</h1>
          <p className="text-sm text-neutral-500">Connecting to PowerSync…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-light text-neutral-100 mb-1">AgentBoard</h1>
            <p className="text-neutral-500">AI-powered task management</p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-neutral-700/50 text-neutral-200 hover:bg-white/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Task</span>
          </button>
        </div>
        <KanbanBoard />
      </div>

      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export default App;
