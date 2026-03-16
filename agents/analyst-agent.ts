import { Agent } from '@mastra/core/agent';
import { createClient } from '@supabase/supabase-js';
import { getCompanyContext } from './get-company-context';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const analystAgent = new Agent({
  id: 'analyst-agent',
  name: 'Analyst Agent',
  instructions: `You are a data analyst for VersityApp.

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold - use CAPITAL LETTERS for emphasis if needed
- DO NOT use # or ## for headers - use blank lines and CAPITAL LETTERS
- DO NOT use - or * for bullet points - use • symbol

Structure your response as:

ANALYSIS RESULTS

EXECUTIVE SUMMARY
[2-3 sentences]

DETAILED ANALYSIS
[3-4 paragraphs examining the topic]

KEY METRICS AND INSIGHTS
• Metric or insight one
• Metric or insight two
• Metric or insight three

RECOMMENDATIONS
[Actionable insights paragraph]

CONCLUSION
[Conclusion paragraph]

Be data-driven and objective (max 600 words).`,
  model: 'anthropic/claude-haiku-4-5-20251001',
});

async function processAnalysisTasks() {
  console.log('🔍 Checking for analysis tasks...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('label', 'analysis')
    .eq('status', 'todo')
    .is('assigned_to', null)
    .limit(1);

  if (error || !tasks || tasks.length === 0) {
    console.log('   No analysis tasks found');
    return;
  }

  const task = tasks[0];
  console.log(`📋 Found task: "${task.title}"`);

  try {
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
      details: `Claimed analysis task: ${task.title}`,
      created_at: new Date().toISOString()
    });

    console.log('🤖 Analyzing with Claude AI via Mastra...');

    const companyContext = await getCompanyContext();

    let prompt = `Analyze: "${task.title}"\n\nContext: ${task.description || 'No additional details'}`;

    if (companyContext) {
      prompt = `COMPANY CONTEXT:\n${companyContext}\n\n${prompt}`;
    }

    const response = await analystAgent.generate(prompt);

    await supabase
      .from('tasks')
      .update({
        description: response.text,
        status: 'review',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    await supabase.from('agent_logs').insert({
      agent_name: 'analyst_agent',
      action: 'completed_task',
      task_id: task.id,
      details: 'Analysis complete and moved to review',
      created_at: new Date().toISOString()
    });

    console.log('✅ Analysis completed! Task moved to Review.');

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

console.log('🚀 Analyst Agent started (using Mastra framework)');
setInterval(processAnalysisTasks, 30_000);
processAnalysisTasks();
