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

    const companyContext = await getCompanyContext();

    const contextBlock = companyContext
      ? `\n\nCOMPANY CONTEXT (use this data for company-specific analysis):\n${companyContext}\n\n`
      : '';

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `You are a data analyst.${contextBlock}

YOUR TASK: Answer the analysis request directly. Do NOT respond with introductions, "I'm ready to assist", readiness confirmations, or asking for clarification. Perform the analysis NOW using the company context when provided, and return your findings.

Topic to analyze: ${task.title}
Request/Context: ${task.description || task.title || 'No additional details provided'}

If company context is provided, extract and analyze the requested data (metrics, revenue, growth, positioning, etc.) from it. If the request cannot be fully answered from context, say so and provide what you can.

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold - use CAPITAL LETTERS for emphasis if needed
- DO NOT use # or ## for headers - use blank lines and CAPITAL LETTERS
- DO NOT use - or * for bullet points - use • symbol
- DO NOT use any markdown syntax whatsoever
${companyContext ? '- Ground your analysis in the company context when relevant.' : ''}

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

Be data-driven and objective (max 600 words). Use clear, natural language.`,
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
      agent_name: 'analyst_agent',
      action: 'completed_task',
      task_id: task.id,
      details: 'Analysis complete and moved to review'
    });

    console.log('✅ Analysis completed! Task moved to Review.');

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

console.log('🚀 Analyst Agent started');
setInterval(processAnalysisTasks, 30000);
processAnalysisTasks();
