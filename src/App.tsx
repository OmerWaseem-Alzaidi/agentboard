import { useEffect, useState } from 'react';
import { initPowerSync } from './lib/powersync';
import { supabase } from './lib/supabase';
import { KanbanBoard } from '@/components/ui/KanbanBoard';
import { CreateTaskDialog } from '@/components/ui/CreateTaskDialog';
import { KnowledgeBaseDialog } from '@/components/ui/KnowledgeBaseDialog';
import { Plus, Database } from 'lucide-react';

function App() {
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => {
    initPowerSync()
      .then(() => setSyncing(true))
      .catch((err: unknown) => console.error('PowerSync init failed', err));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state changed:', event);
        if (event === 'TOKEN_REFRESHED' && session) {
          console.log('🔄 Session refreshed, PowerSync will use new token on next fetchCredentials');
        }
      }
    );
    return () => subscription.unsubscribe();
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
    <div className="min-h-screen bg-neutral-950 min-h-[100dvh]">
      <div className="max-w-[1400px] mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-neutral-100 mb-0.5">AgentBoard</h1>
            <p className="text-sm text-neutral-500">AI-powered task management</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setKbOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-full bg-white/5 backdrop-blur-sm border border-neutral-700/50 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors touch-manipulation"
              aria-label="Knowledge Base"
            >
              <Database className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-sm font-medium">Knowledge Base</span>
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-full bg-white/10 backdrop-blur-sm border border-neutral-700/50 text-neutral-200 hover:bg-white/20 transition-colors touch-manipulation"
              aria-label="New Task"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-sm font-medium">New Task</span>
            </button>
          </div>
        </div>
        <KanbanBoard />
      </div>

      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <KnowledgeBaseDialog open={kbOpen} onOpenChange={setKbOpen} />
    </div>
  );
}

export default App;
