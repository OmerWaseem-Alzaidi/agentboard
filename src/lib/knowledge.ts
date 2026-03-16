import { supabase } from './supabase';
import { db, upsertToSupabase } from './powersync';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 50_000;

export async function uploadCompanyDocument(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const isText = file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt');
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

  if (!isText && !isPdf) {
    throw new Error('Unsupported file type. Upload .txt, .md, or .pdf files.');
  }

  const fileId = crypto.randomUUID();
  let contentText = '';

  if (isText) {
    contentText = await file.text();
  } else if (isPdf) {
    contentText = '[PDF uploaded — content available for agents via storage]';
    try {
      const storagePath = `${fileId}-${file.name}`;
      await supabase.storage.from('company-docs').upload(storagePath, file);
    } catch {
      // Storage upload is best-effort; metadata still saved
    }
  }

  if (contentText.length > MAX_CONTENT_LENGTH) {
    contentText = contentText.slice(0, MAX_CONTENT_LENGTH);
  }

  const record = {
    id: fileId,
    filename: file.name,
    file_type: file.type || 'text/plain',
    storage_path: `${fileId}-${file.name}`,
    content_text: contentText,
    uploaded_by: 'user',
    created_at: new Date().toISOString(),
  };

  await db.execute(
    `INSERT INTO company_knowledge (id, filename, file_type, storage_path, content_text, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.filename, record.file_type, record.storage_path, record.content_text, record.uploaded_by, record.created_at]
  );

  await upsertToSupabase('company_knowledge', record);

  return record;
}

export async function deleteCompanyDocument(id: string, storagePath: string) {
  try {
    await supabase.storage.from('company-docs').remove([storagePath]);
  } catch {
    // best-effort storage cleanup
  }
  await db.execute('DELETE FROM company_knowledge WHERE id = ?', [id]);
  await supabase.from('company_knowledge').delete().eq('id', id);
}
