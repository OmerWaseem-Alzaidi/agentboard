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

async function processAnalysisTasks() {
  console.log('Checking for analysis tasks...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('label', 'analysis')
    .eq('status', 'todo')
    .is('assigned_to', null)
    .limit(1);

  if (error) {
    console.error('❌ Error fetching tasks:', error);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log('   No analysis tasks found');
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
        assigned_to: 'analyst_agent',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    await supabase.from('agent_logs').insert({
      agent_name: 'analyst_agent',
      action: 'claimed_task',
      task_id: task.id,
      details: `Claimed analysis task: ${task.title}`
    });

    console.log('🤖 Analyzing with Claude AI...');

    // Call Claude API
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: `You are a data analyst. Analyze: "${task.title}"

Context: ${task.description || 'No additional details provided'}

Provide thorough analysis in PLAIN TEXT format (no markdown). Structure your response as:

- Start with "ANALYSIS RESULTS" as the header
- Include EXECUTIVE SUMMARY (2-3 sentences)
- Include DETAILED ANALYSIS section with 3-4 paragraphs examining the topic
- Include KEY METRICS & INSIGHTS section with bullet points (use • symbol)
- Include RECOMMENDATIONS section with actionable insights
- End with CONCLUSION paragraph

Be data-driven and objective (max 600 words). Use clear language. No hashtags, asterisks, or markdown formatting.`,
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
      agent_name: 'analyst_agent',
      action: 'completed_task',
      task_id: task.id,
      details: 'Analysis complete and moved to review'
    });

    console.log('✅ Analysis completed! Task moved to Review.');

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
console.log('🚀 Analyst Agent started');
setInterval(processAnalysisTasks, 30000);
processAnalysisTasks();