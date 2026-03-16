import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { getCompanyContext } from './get-company-context';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function processWritingTasks() {
  console.log('Checking for writing tasks...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('label', 'writing')
    .eq('status', 'todo')
    .is('assigned_to', null)
    .limit(1);

  if (error) {
    console.error('❌ Error fetching tasks:', error);
    return;
  }

  if (!tasks || tasks.length === 0) {
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
      details: `Claimed writing task: ${task.title}`
    });

    console.log('🤖 Writing content with Claude AI...');

    const companyContext = await getCompanyContext();

    const contextBlock = companyContext
      ? `\n\nCOMPANY CONTEXT (use this to make the content company-specific):\n${companyContext}\n\n`
      : '';

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `You are a professional content writer.${contextBlock}Write high-quality content for: "${task.title}"

Request: ${task.description || 'No additional details provided'}

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold - use CAPITAL LETTERS for emphasis if needed
- DO NOT use # or ## for headers - use blank lines and CAPITAL LETTERS
- DO NOT use - or * for bullet points - use • symbol
- DO NOT use any markdown syntax whatsoever
${companyContext ? '- Tailor the content to the company context when relevant.' : ''}

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

Keep it professional and engaging (max 600 words). Use clear, natural language.`,
    });

    await supabase
      .from('tasks')
      .update({
        description: text,
        status: 'review',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    await supabase.from('agent_logs').insert({
      agent_name: 'writer_agent',
      action: 'completed_task',
      task_id: task.id,
      details: 'Content written and moved to review'
    });

    console.log('✅ Writing completed! Task moved to Review.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);

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

console.log('🚀 Writer Agent started');
setInterval(processWritingTasks, 30000);
processWritingTasks();
