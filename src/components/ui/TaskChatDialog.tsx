import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, TaskMessage } from '@/types';
import { db, upsertToSupabase } from '@/lib/powersync';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Brain, Sparkles, Bot, User, ArrowLeft, Pencil } from 'lucide-react';
import { CopyButton } from './copy-button';
import { formatDistanceToNow } from 'date-fns';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';

function formatAgentName(name: string): string {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getAgentIcon(name: string, size = 'h-3.5 w-3.5') {
  if (name === 'research_agent') return <Brain className={`${size} text-blue-300`} />;
  if (name === 'writer_agent') return <Sparkles className={`${size} text-emerald-300`} />;
  if (name === 'analyst_agent') return <Bot className={`${size} text-purple-300`} />;
  return <Bot className={`${size} text-neutral-300`} />;
}

function getAgentColor(name: string): string {
  if (name === 'research_agent') return 'bg-blue-500/20';
  if (name === 'writer_agent') return 'bg-emerald-500/20';
  if (name === 'analyst_agent') return 'bg-purple-500/20';
  return 'bg-neutral-500/20';
}

function getAgentRole(name: string): string {
  if (name === 'research_agent') return 'a research specialist who finds and synthesizes information';
  if (name === 'writer_agent') return 'a writing specialist who creates clear, compelling content';
  if (name === 'analyst_agent') return 'a data analyst who provides insights and analysis';
  return 'an AI assistant';
}

function getPlaceholders(agentName: string | null): string[] {
  if (agentName === 'research_agent') return [
    'Can you focus on the cost comparison?',
    'Summarize the key findings in 3 bullets',
    'What are the main risks?',
    'Add more data about market trends',
  ];
  if (agentName === 'writer_agent') return [
    'Make this more concise',
    'Change the tone to be more formal',
    'Add a stronger call-to-action',
    'Rewrite the introduction paragraph',
  ];
  if (agentName === 'analyst_agent') return [
    'Can you add percentage changes?',
    'Focus on the top 3 metrics',
    'What are the actionable takeaways?',
    'Compare this with industry benchmarks',
  ];
  return [
    'Can you refine this?',
    'Make it shorter and clearer',
    'Add more specific details',
    'What would you recommend?',
  ];
}

interface TaskChatDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskChatDialog({ task, open, onOpenChange }: TaskChatDialogProps) {
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [editingState, setEditingState] = useState<{ id: string; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMsg = useRef('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      for await (const result of db.watch(
        'SELECT * FROM task_messages WHERE task_id = ? ORDER BY created_at ASC',
        [task.id]
      )) {
        if (cancelled) break;
        const rows: TaskMessage[] = [];
        if (result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            rows.push(result.rows.item(i) as TaskMessage);
          }
        }
        setMessages(rows);
      }
    })();

    return () => { cancelled = true; };
  }, [open, task.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiTyping]);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const messageToSend = editingState?.text ?? lastUserMsg.current;
    if (!messageToSend.trim() || isAiTyping) return;

    const isEditMode = !!editingState;
    const editingSnapshot = editingState;

    lastUserMsg.current = '';
    setEditingState(null);
    setIsAiTyping(true);
    let currentMessages = [...messages];

    try {
      if (isEditMode && editingSnapshot) {
        const editIdx = messages.findIndex(m => m.id === editingSnapshot.id);
        if (editIdx >= 0) {
          const editedMsg = { ...messages[editIdx], message: messageToSend };
          await db.execute('UPDATE task_messages SET message = ? WHERE id = ?', [messageToSend, editingSnapshot.id]);
          await supabase.from('task_messages').update({ message: messageToSend }).eq('id', editingSnapshot.id);
          currentMessages = [...messages.slice(0, editIdx + 1).map((m, i) => (i === editIdx ? editedMsg : m))];
          for (let i = editIdx + 1; i < messages.length; i++) {
            await db.execute('DELETE FROM task_messages WHERE id = ?', [messages[i].id]);
            await supabase.from('task_messages').delete().eq('id', messages[i].id);
          }
        }
      } else {
        const userMsgId = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.execute(
          "INSERT INTO task_messages (id, task_id, sender, message, created_at) VALUES (?, ?, 'user', ?, ?)",
          [userMsgId, task.id, messageToSend, now]
        );
        await upsertToSupabase('task_messages', {
          id: userMsgId,
          task_id: task.id,
          sender: 'user',
          message: messageToSend,
          created_at: now,
        });
        currentMessages = [...messages, { id: userMsgId, task_id: task.id, sender: 'user' as const, message: messageToSend, created_at: now }];
      }

      const userMessage = messageToSend;
      const chatHistory = currentMessages
        .slice(-20)
        .map(m => `${m.sender === 'user' ? 'User' : 'Agent'}: ${m.message}`)
        .join('\n\n');

      if (isEditMode) setMessages(currentMessages);

      let companyContext = '';
      try {
        const { data: docs } = await supabase
          .from('company_knowledge')
          .select('filename, content_text')
          .order('created_at', { ascending: false });
        if (docs && docs.length > 0) {
          companyContext = docs
            .filter(d => d.content_text)
            .map(d => `=== ${d.filename} ===\n${d.content_text}`)
            .join('\n\n');
        }
      } catch { /* ignore */ }

      const contextBlock = companyContext
        ? `\n\nCOMPANY CONTEXT:\n${companyContext}\n`
        : '';

      const prompt = `You are ${getAgentRole(task.assigned_to ?? '')}. You previously worked on a task and the user wants to refine the output through conversation.${contextBlock}

Task Title: ${task.title}
Current Task Description/Output:
${task.description ?? 'No description yet.'}

Previous conversation:
${chatHistory}

User's request: ${userMessage}

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold, # for headers, - for bullets
- Just write naturally in clear paragraphs
- Use CAPITAL LETTERS for emphasis if absolutely needed
- Reference company context when relevant

Provide a helpful, concise response to refine the task.`;

      const res = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Anthropic API ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const aiMessage = data.content?.[0]?.text ?? 'No response generated.';

      const agentMsgId = crypto.randomUUID();
      const agentNow = new Date().toISOString();

      await db.execute(
        "INSERT INTO task_messages (id, task_id, sender, message, created_at) VALUES (?, ?, 'agent', ?, ?)",
        [agentMsgId, task.id, aiMessage, agentNow]
      );
      await upsertToSupabase('task_messages', {
        id: agentMsgId,
        task_id: task.id,
        sender: 'agent',
        message: aiMessage,
        created_at: agentNow,
      });

    } catch (error) {
      console.error('Chat error:', error);
      const errMsgId = crypto.randomUUID();
      const errNow = new Date().toISOString();
      await db.execute(
        "INSERT INTO task_messages (id, task_id, sender, message, created_at) VALUES (?, ?, 'agent', ?, ?)",
        [errMsgId, task.id, 'Sorry, I encountered an error. Please try again.', errNow]
      );
    } finally {
      setIsAiTyping(false);
    }
  };

  const agentName = task.assigned_to ? formatAgentName(task.assigned_to) : 'AI Agent';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 py-4 border-b border-neutral-700/30 bg-neutral-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-400" />
            </button>
            {task.assigned_to && (
              <Avatar className={`h-8 w-8 ${getAgentColor(task.assigned_to)}`} size="sm">
                <AvatarFallback className="bg-transparent">
                  {getAgentIcon(task.assigned_to, 'h-4 w-4')}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold truncate">
                {agentName}
              </DialogTitle>
              <p className="text-xs text-neutral-500 truncate">{task.title}</p>
            </div>
            {isAiTyping && (
              <TextShimmer className="text-xs font-medium" duration={1.5}>
                thinking...
              </TextShimmer>
            )}
          </div>
        </DialogHeader>

        <div ref={scrollRef} className="overflow-y-auto p-5 space-y-5 h-[500px] bg-neutral-950/30">
          {messages.length === 0 && !isAiTyping && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              {task.assigned_to && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Avatar className={`h-14 w-14 ${getAgentColor(task.assigned_to)}`}>
                    <AvatarFallback className="bg-transparent">
                      {getAgentIcon(task.assigned_to, 'h-7 w-7')}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              )}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="space-y-1"
              >
                <p className="text-sm font-medium text-neutral-300">
                  Chat with {agentName}
                </p>
                <p className="text-xs text-neutral-500 max-w-xs">
                  Ask for refinements, changes, or improvements to the task output.
                </p>
              </motion.div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <MessageBubble
                  id={msg.id}
                  sender={msg.sender}
                  message={msg.message}
                  timestamp={msg.created_at}
                  agentName={task.assigned_to}
                  copyContent={msg.sender === 'agent' ? msg.message : undefined}
                  onEdit={msg.sender === 'user' ? () => setEditingState({ id: msg.id, text: msg.message }) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {isAiTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Avatar className={`h-7 w-7 shrink-0 mt-0.5 ${getAgentColor(task.assigned_to ?? '')}`} size="sm">
                <AvatarFallback className="bg-transparent">
                  {getAgentIcon(task.assigned_to ?? '')}
                </AvatarFallback>
              </Avatar>
              <div className="bg-neutral-800/80 border border-neutral-700/40 rounded-2xl rounded-bl-md px-4 py-3">
                <TextShimmer className="text-sm font-medium" duration={1.5} spread={3}>
                  Generating response...
                </TextShimmer>
              </div>
            </motion.div>
          )}
        </div>

        <div className="border-t border-neutral-700/30 px-4 py-3 bg-neutral-900/50 backdrop-blur-sm">
          <PlaceholdersAndVanishInput
            key={editingState ? 'editing' : 'normal'}
            placeholders={getPlaceholders(task.assigned_to)}
            value={editingState?.text}
            onChange={(e) => {
              lastUserMsg.current = e.target.value;
              if (editingState) setEditingState(prev => prev ? { ...prev, text: e.target.value } : null);
            }}
            onSubmit={handleSend}
            disabled={isAiTyping}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MessageBubble({
  sender,
  message,
  timestamp,
  agentName,
  copyContent,
  onEdit,
}: {
  id?: string;
  sender: string;
  message: string;
  timestamp: string;
  agentName: string | null;
  copyContent?: string;
  onEdit?: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isUser = sender === 'user';

  let timeAgo: string;
  try {
    timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    timeAgo = '';
  }

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {isUser ? (
        <Avatar className="h-7 w-7 bg-blue-500/20 shrink-0 mt-0.5" size="sm">
          <AvatarFallback className="bg-transparent">
            <User className="h-3.5 w-3.5 text-blue-300" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <Avatar className={`h-7 w-7 ${getAgentColor(agentName ?? '')} shrink-0 mt-0.5`} size="sm">
          <AvatarFallback className="bg-transparent">
            {getAgentIcon(agentName ?? '')}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-neutral-800/80 text-neutral-200 border border-neutral-700/40 rounded-bl-md'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message}</p>
        </div>
        <div className="flex items-center gap-1 min-h-[24px]">
          {timeAgo && (
            <p className="text-[10px] text-neutral-600">{timeAgo}</p>
          )}
          {(showActions && (copyContent || onEdit)) && (
            <div className="flex items-center gap-0.5 ml-2">
              {copyContent && (
                <CopyButton
                  content={copyContent}
                  size="sm"
                  className="rounded-md hover:bg-neutral-700/80 text-neutral-400 hover:text-neutral-200 transition-colors"
                  iconClassName="h-3 w-3"
                />
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1.5 rounded-md hover:bg-neutral-700/80 text-neutral-400 hover:text-neutral-200 transition-colors"
                  title="Edit"
                  aria-label="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
