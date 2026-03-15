import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';

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
    // Claim the task
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

    // Call Claude API
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: `You are a professional content writer. Write high-quality content for: "${task.title}"

Original request: ${task.description || 'No additional details provided'}

Provide well-structured, engaging content in PLAIN TEXT format (no markdown). Structure your response as:

- Start with "WRITTEN CONTENT" as the header
- Include an engaging INTRODUCTION (2-3 sentences)
- Include MAIN CONTENT section with 3-4 clear paragraphs
- Include KEY POINTS section with bullet points (use • symbol)
- End with a brief CONCLUSION paragraph

Keep it professional and engaging (max 600 words). Use clear language. No hashtags, asterisks, or markdown formatting.`,
    });

    // Update task with results
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
    
    // Reset task on failure
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

// Run every 30 seconds
console.log('🚀 Writer Agent started');
setInterval(processWritingTasks, 30000);
processWritingTasks();