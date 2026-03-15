import { createClient } from '@supabase/supabase-js';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Anthropic model
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const model = anthropic('claude-sonnet-4-20250514');

// Process research tasks
async function processResearchTasks() {
  console.log('🔍 Checking for research tasks...');
  
  // Find research tasks in 'todo' status
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
  
  // Mark as in progress
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
    // Use AI SDK to generate research
    const result = await generateText({
      model,
      prompt: `You are a research assistant. Research this topic and provide comprehensive findings.

Topic: ${task.title}
Details: ${task.description || 'No additional details provided'}

FORMATTING RULES (strict):
- Output PLAIN TEXT only. No markdown whatsoever.
- Do NOT use #, ##, **, *, ---, \`\`\`, or any markdown syntax.
- Use ALL-CAPS for section headings on their own line (e.g. KEY FINDINGS).
- Use "• " (bullet character) for list items, not dashes or asterisks.
- Separate sections with a single blank line.
- Keep it concise but thorough (300-500 words).

Structure your response as:

KEY FINDINGS
• finding one
• finding two

IMPORTANT INSIGHTS
• insight one

RELEVANT DATA
• data point one

RECOMMENDATIONS
• recommendation one`
    });
    
    // Update with results
    await supabase
      .from('tasks')
      .update({
        status: 'review',
        description: `${task.description || task.title}\n\n🔍 RESEARCH RESULTS\n\n${result.text}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);
    
    await supabase.from('agent_logs').insert({
      id: crypto.randomUUID(),
      agent_name: 'research_agent',
      action: 'completed',
      task_id: task.id,
      details: { tokens: result.usage },
      created_at: new Date().toISOString()
    });
    
    console.log('✅ Research completed! Task moved to Review.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    // Reset task to todo
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

// Run on a loop
async function main() {
  console.log('🚀 Research Agent started');
  while (true) {
    await processResearchTasks();
    await new Promise(r => setTimeout(r, 10_000));
  }
}

main().catch(console.error);