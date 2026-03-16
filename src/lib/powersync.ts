import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';
import { supabase } from './supabase';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'agentboard.db',
  },
  flags: {
    enableMultiTabs: true
  }
});

export async function initPowerSync() {
  const powerSyncUrl = import.meta.env.VITE_POWERSYNC_URL;
  const token = import.meta.env.VITE_POWERSYNC_TOKEN;

  if (!powerSyncUrl || !token) {
    throw new Error('Missing PowerSync credentials');
  }

  await db.connect({
    fetchCredentials: async () => ({
      endpoint: powerSyncUrl,
      token: token
    }),
    uploadData: async (database) => {
      console.log('🔄 Upload function called!');

      const transaction = await database.getNextCrudTransaction();
      if (!transaction) return;

      console.log('📤 Uploading', transaction.crud.length, 'operations');

      try {
        for (const op of transaction.crud) {
          const table = op.table;
          const record = { ...op.opData, id: op.id };

          if (op.op === 'PUT') {
            // For tasks: avoid overwriting newer agent updates with stale local data.
            // Delayed PowerSync upload (e.g. after create) can overwrite in_progress/review with todo.
            if (table === 'tasks' && record.updated_at) {
              const { data: existing } = await supabase.from(table).select('updated_at').eq('id', op.id).single();
              if (existing?.updated_at && String(existing.updated_at) > String(record.updated_at)) {
                console.log('⏭️ Skipping stale task upload (remote is newer)');
                continue; // skip this op, don't overwrite
              }
            }
            const { error } = await supabase.from(table).upsert(record);
            if (error) throw error;
          } else if (op.op === 'PATCH') {
            // For tasks: only update status/updated_at to avoid overwriting agent description.
            // PowerSync PATCH may include full row; local can have stale null description.
            const patchData = table === 'tasks'
              ? { status: op.opData?.status, updated_at: op.opData?.updated_at }
              : op.opData!;
            const { error } = await supabase.from(table).update(patchData).eq('id', op.id);
            if (error) throw error;
          } else if (op.op === 'DELETE') {
            const { error } = await supabase.from(table).delete().eq('id', op.id);
            if (error) throw error;
          }
        }
        await transaction.complete();
        console.log('✅ Upload complete!');
      } catch (error) {
        console.error('❌ Upload failed:', error);
        throw error; // Rethrow so PowerSync retries
      }
    }
  });

  console.log('✅ PowerSync connected!');
}

/**
 * Write-through helper: writes to both local PowerSync DB and Supabase.
 * This ensures data reaches Supabase immediately even if the sync
 * engine hasn't established a connection (e.g. expired token).
 */
export async function upsertToSupabase(table: string, record: Record<string, unknown>) {
  try {
    const { error } = await supabase.from(table).upsert(record);
    if (error) {
      console.error(`❌ Supabase upsert to ${table} failed:`, error);
    } else {
      console.log(`✅ Written to Supabase ${table}:`, record.id);
    }
  } catch (err) {
    console.error(`❌ Supabase upsert threw:`, err);
  }
}

export async function updateInSupabase(table: string, id: string, data: Record<string, unknown>) {
  try {
    const { error } = await supabase.from(table).update(data).eq('id', id);
    if (error) {
      console.error(`❌ Supabase update on ${table} failed:`, error);
    }
  } catch (err) {
    console.error(`❌ Supabase update threw:`, err);
  }
}
