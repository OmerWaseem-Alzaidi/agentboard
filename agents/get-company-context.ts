import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Strips testing instructions and metadata from company context.
 * Filters out SUCCESS CRITERIA, NEXT STEPS, test scenarios, etc.
 * Returns empty string if result has less than 100 chars (not meaningful).
 */
export function cleanCompanyContext(raw: string): string {
  const cleaned = raw
    .split('\n')
    .filter(line => {
      const lowerLine = line.toLowerCase().trim();
      return (
        !lowerLine.startsWith('✅') &&
        !lowerLine.startsWith('🎯') &&
        !lowerLine.includes('success criteria') &&
        !lowerLine.includes('next steps') &&
        !lowerLine.includes('test scenarios') &&
        !lowerLine.includes('reach out to') &&
        !lowerLine.includes('questions?') &&
        !line.match(/^[\d]+\./) && // Remove numbered lists like "1. Upload..."
        !line.includes('[Should reference')
      );
    })
    .join('\n')
    .trim();
  return cleaned.length > 100 ? cleaned : '';
}

export async function getCompanyContext(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('company_knowledge')
      .select('filename, content_text')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('⚠️  Company context query error:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('📚 No company knowledge documents found');
      return null;
    }

    const context = data
      .filter(doc => doc.content_text && doc.content_text.length > 10)
      .map(doc => `=== ${doc.filename} ===\n${doc.content_text}`)
      .join('\n\n');

    if (!context) {
      console.log('📚 Company documents found but no usable text content');
      return null;
    }

    console.log(`📚 Company context loaded: ${data.length} doc(s), ${context.length} chars`);
    return context;
  } catch (err) {
    console.log('⚠️  Failed to fetch company context:', err);
    return null;
  }
}
