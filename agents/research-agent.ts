import { createClient } from '@supabase/supabase-js';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getCompanyContext } from './get-company-context';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const model = anthropic('claude-haiku-4-5-20251001');

async function processResearchTasks() {
  console.log('🔍 Checking for research tasks...');

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('label', 'research')
    .eq('status', 'todo')
    .limit(1);

  if (!tasks || tasks.length === 0) {
    console.log('   No research tasks found');
    return;
  }

  const task = tasks[0];
  console.log(`📋 Found task: "${task.title}"`);

  await supabase
    .from('tasks')
    .update({
      status: 'in_progress',
      assigned_to: 'research_agent',
      updated_at: new Date().toISOString()
    })
    .eq('id', task.id);

  await supabase.from('agent_logs').insert({
    id: crypto.randomUUID(),
    agent_name: 'research_agent',
    action: 'picked_up',
    task_id: task.id,
    created_at: new Date().toISOString()
  });

  console.log('🤖 Processing with Claude AI...');

  try {
    const companyContext = await getCompanyContext();

    const contextBlock = companyContext
      ? `\n\nCOMPANY CONTEXT (use this when relevant to the research):\n${companyContext}\n\n`
      : '';

    const result = await generateText({
      model,
      prompt: `You are a research assistant.${contextBlock}Research this topic and provide comprehensive findings.

Topic: ${task.title}
Request: ${task.description || 'No additional details provided'}

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT ONLY - absolutely no markdown formatting
- DO NOT use ** for bold - use CAPITAL LETTERS for emphasis if needed
- DO NOT use # or ## for headers - use blank lines and CAPITAL LETTERS
- DO NOT use - or * for bullet points - use • symbol or just numbers
- DO NOT use any markdown syntax whatsoever
- Write in clear, readable paragraphs with natural structure
${companyContext ? '- Reference the company context when relevant to give company-specific insights.' : ''}

Structure your response as:

RESEARCH RESULTS

[Paragraph about the topic]

KEY FINDINGS

[2-3 paragraphs with findings]

IMPORTANT INSIGHTS

• First insight here
• Second insight here
• Third insight here

RELEVANT DATA

• Data point one
• Data point two

RECOMMENDATIONS

[Paragraph with recommendations]

SUMMARY

[Brief conclusion paragraph]

Keep it concise (max 600 words). Use clear, natural language.`
    });

    await supabase
      .from('tasks')
      .update({
        status: 'review',
        description: `${task.description || task.title}\n\nRESEARCH RESULTS\n\n${result.text}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    await supabase.from('agent_logs').insert({
      id: crypto.randomUUID(),
      agent_name: 'research_agent',
      action: 'completed',
      task_id: task.id,
      details: JSON.stringify({ tokens: result.usage }),
      created_at: new Date().toISOString()
    });

    console.log('✅ Research completed! Task moved to Review.');

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

async function main() {
  console.log('🚀 Research Agent started');
  while (true) {
    await processResearchTasks();
    await new Promise(r => setTimeout(r, 10_000));
  }
}

main().catch(console.error);
