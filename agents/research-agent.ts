import { Agent } from '@mastra/core/agent';
import { createClient } from '@supabase/supabase-js';
import { getCompanyContext, cleanCompanyContext } from './get-company-context';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  instructions: `You are a research assistant for VersityApp.

CRITICAL - CONTEXT USAGE:
- Company context documents may contain BOTH factual data AND instruction/template text (e.g. "Expected Behavior", "Success Criteria", "Pro Tips", "Next Steps")
- You must EXTRACT and USE only the factual company data: numbers, metrics, features, team names, products, competitors
- NEVER copy, quote, or include instruction text, templates, "Expected Behavior", "Success Criteria", "Pro Tips", "Next Steps", or similar meta-content in your output
- Your output must contain ONLY your researched findings - never echo document instructions back
- If you see "[Should cite specific numbers...]" or similar - that is an instruction TO you, not content to include. Use the numbers from the document instead.

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold - use CAPITAL LETTERS for emphasis if needed
- DO NOT use # or ## for headers - use blank lines and CAPITAL LETTERS
- DO NOT use - or * for bullet points - use • symbol
- Write in clear, readable paragraphs with natural structure

Structure your response as (output ONLY this structure, nothing before it):

RESEARCH RESULTS

KEY FINDINGS
[2-3 paragraphs with findings - cite specific numbers from context when available]

IMPORTANT INSIGHTS
• Insight one
• Insight two
• Insight three

RECOMMENDATIONS
[Paragraph with recommendations]

SUMMARY
[Brief conclusion paragraph]

Keep it concise (max 600 words). Use clear language. Start directly with RESEARCH RESULTS - no preamble.`,
  model: 'anthropic/claude-haiku-4-5-20251001',
});

async function processResearchTasks() {
  console.log('🔍 Checking for research tasks...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('label', 'research')
    .eq('status', 'todo')
    .is('assigned_to', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !tasks || tasks.length === 0) {
    console.log('   No research tasks found');
    return;
  }

  const task = tasks[0];
  console.log(`📋 Found task: "${task.title}"`);

  try {
    await supabase
      .from('tasks')
      .update({
        status: 'in_progress',
        assigned_to: 'research_agent',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    await supabase.from('agent_logs').insert({
      agent_name: 'research_agent',
      action: 'claimed_task',
      task_id: task.id,
      details: `Claimed research task: ${task.title}`,
      created_at: new Date().toISOString()
    });

    console.log('🤖 Researching with Claude AI via Mastra...');

    const rawContext = await getCompanyContext();

    let prompt = `Research this topic: "${task.title}"\n\nRequest: ${task.description || 'No additional details'}`;

    if (rawContext) {
      const cleanedContext = cleanCompanyContext(rawContext);
      if (cleanedContext) {
        prompt = `COMPANY CONTEXT (use this information to inform your research, but don't output it directly):\n\n${cleanedContext}\n\n---\n\nNow, ${prompt}`;
      }
    }

    const response = await researchAgent.generate(prompt);

    const content = typeof response?.text === 'string' ? response.text : String(response?.text ?? '');
    if (!content.trim()) {
      throw new Error('Mastra agent returned empty content');
    }

    // Strip any instruction/template leakage before "RESEARCH RESULTS"
    let output = content;
    const marker = 'RESEARCH RESULTS';
    const idx = output.indexOf(marker);
    if (idx >= 0) {
      output = output.slice(idx).trim();
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        description: output,
        status: 'review',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    if (updateError) {
      console.error('❌ Failed to update task in Supabase:', updateError);
      throw updateError;
    }

    await supabase.from('agent_logs').insert({
      agent_name: 'research_agent',
      action: 'completed_task',
      task_id: task.id,
      details: 'Research complete and moved to review',
      created_at: new Date().toISOString()
    });

    console.log('✅ Research completed! Task moved to Review.');

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

console.log('🚀 Research Agent started (using Mastra framework)');
setInterval(processResearchTasks, 30_000);
processResearchTasks();
