import { Agent } from '@mastra/core/agent';
import { createClient } from '@supabase/supabase-js';
import { getCompanyContext } from './get-company-context';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const writerAgent = new Agent({
  id: 'writer-agent',
  name: 'Writer Agent',
  instructions: `You are a professional content writer for VersityApp.

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold - use CAPITAL LETTERS for emphasis if needed
- DO NOT use # or ## for headers - use blank lines and CAPITAL LETTERS
- DO NOT use - or * for bullet points - use • symbol

Structure your response as:

WRITTEN CONTENT

INTRODUCTION
[2-3 engaging sentences]

MAIN CONTENT
[3-4 clear paragraphs]

KEY POINTS
• Point one
• Point two
• Point three

CONCLUSION
[Brief conclusion paragraph]

Keep it professional and engaging (max 600 words).`,
  model: 'anthropic/claude-haiku-4-5-20251001',
});

async function processWritingTasks() {
  console.log('🔍 Checking for writing tasks...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('label', 'writing')
    .eq('status', 'todo')
    .is('assigned_to', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !tasks || tasks.length === 0) {
    console.log('   No writing tasks found');
    return;
  }

  const task = tasks[0];
  console.log(`📋 Found task: "${task.title}"`);

  try {
    await supabase
      .from('tasks')
      .update({
        status: 'in_progress',
        assigned_to: 'writer_agent',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    await supabase.from('agent_logs').insert({
      agent_name: 'writer_agent',
      action: 'claimed_task',
      task_id: task.id,
      details: `Claimed writing task: ${task.title}`,
      created_at: new Date().toISOString()
    });

    console.log('🤖 Writing content with Claude AI via Mastra...');

    const companyContext = await getCompanyContext();

    let prompt = `Write content for: "${task.title}"\n\nRequest: ${task.description || 'No additional details'}`;

    if (companyContext) {
      prompt = `COMPANY CONTEXT:\n${companyContext}\n\n${prompt}`;
    }

    const response = await writerAgent.generate(prompt);

    const content = typeof response?.text === 'string' ? response.text : String(response?.text ?? '');
    if (!content.trim()) {
      throw new Error('Mastra agent returned empty content');
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        description: content,
        status: 'review',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    if (updateError) {
      console.error('❌ Failed to update task in Supabase:', updateError);
      throw updateError;
    }

    // Verify the update was applied (helps debug sync issues)
    const { data: verify } = await supabase.from('tasks').select('status').eq('id', task.id).single();
    if (verify?.status !== 'review') {
      console.warn('⚠️ Task status in Supabase is', verify?.status, '- expected review');
    }

    const { error: logError } = await supabase.from('agent_logs').insert({
      agent_name: 'writer_agent',
      action: 'completed_task',
      task_id: task.id,
      details: 'Writing complete and moved to review',
      created_at: new Date().toISOString()
    });

    console.log('✅ Writing completed! Task moved to Review.');

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', message);

    await supabase
      .from('tasks')
      .update({
        status: 'todo',
        assigned_to: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);
  }
}

console.log('🚀 Writer Agent started (using Mastra framework)');
setInterval(processWritingTasks, 30_000);
processWritingTasks();
