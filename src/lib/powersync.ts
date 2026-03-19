import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';
import { supabase } from './supabase';
import { wasUserDeletedTask } from './deleted-tasks';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'agentboard.db',
  },
  flags: {
    enableMultiTabs: true
  }
});

/**
 * Get PowerSync JWT from Supabase session.
 * Uses Supabase Anonymous Auth - tokens refresh automatically, no expiration issues.
 *
 * MANUAL CONFIG REQUIRED:
 * 1. Supabase: Authentication → Providers → enable "Anonymous sign-ins"
 * 2. PowerSync: Client Auth → check "Use Supabase Auth" → Save and Deploy
 */
async function getPowerSyncToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    console.log('✅ Using existing Supabase session');
    return session.access_token;
  }

  console.log('📝 Creating anonymous session...');
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.session) {
    throw new Error(`Failed to create anonymous session: ${error?.message}`);
  }

  console.log('✅ Anonymous session created');
  return data.session.access_token;
}

export async function initPowerSync() {
  const powerSyncUrl = import.meta.env.VITE_POWERSYNC_URL;

  if (!powerSyncUrl) {
    throw new Error('Missing VITE_POWERSYNC_URL in environment variables');
  }

  console.log('🔌 Connecting to PowerSync with Supabase Auth...');

  try {
    await db.connect({
      fetchCredentials: async () => {
        const token = await getPowerSyncToken();
        console.log('📡 PowerSync credentials fetched (Supabase JWT)');
        return {
          endpoint: powerSyncUrl,
          token,
        };
      },
    uploadData: async (database) => {
      const debug = import.meta.env.DEV;
      if (debug) console.log('🔄 Upload function called!');

      const transaction = await database.getNextCrudTransaction();
      if (!transaction) return;

      if (debug) console.log('📤 Uploading', transaction.crud.length, 'operations');

      try {
        for (const op of transaction.crud) {
          const table = op.table;
          const record = { ...op.opData, id: op.id };

          // Skip task_messages for deleted tasks (FK: task_id must exist in tasks)
          if (table === 'task_messages' && (op.op === 'PUT' || op.op === 'PATCH')) {
            const taskId = ((op.opData as Record<string, unknown>)?.task_id ?? (record as Record<string, unknown>).task_id) as string | undefined;
            if (taskId) {
              // Use .limit(1) (array response), not .maybeSingle()/.single(): those use
              // Accept: application/vnd.pgrst.object+json → 406 PGRST116 when the row is gone (e.g. after delete).
              const { data: taskRows, error: taskLookupErr } = await supabase
                .from('tasks')
                .select('id')
                .eq('id', taskId)
                .limit(1);
              if (taskLookupErr) throw taskLookupErr;
              if (!taskRows?.length) {
                if (debug) console.log('⏭️ Skipping task_messages for deleted task:', taskId);
                continue;
              }
            }
          }

          if (op.op === 'PUT') {
            // Never resurrect tasks the user deleted: stale PUTs in the queue after DELETE would
            // otherwise upsert() the row back (406 from .single() on missing row was a clue).
            if (table === 'tasks' && wasUserDeletedTask(String(op.id))) {
              await supabase.from('tasks').delete().eq('id', op.id);
              if (debug) console.log('⏭️ Skipping PUT for user-deleted task (prevent resurrection):', op.id);
              continue;
            }
            // For tasks: avoid overwriting newer agent updates with stale local data.
            const updatedAt = (record as Record<string, unknown>).updated_at;
            if (table === 'tasks' && updatedAt) {
              const { data: existingRows, error: existingErr } = await supabase
                .from(table)
                .select('updated_at')
                .eq('id', op.id)
                .limit(1);
              if (existingErr) throw existingErr;
              const existing = existingRows?.[0];
              if (existing?.updated_at && String(existing.updated_at) > String(updatedAt)) {
                if (debug) console.log('⏭️ Skipping stale task upload (remote is newer)');
                continue;
              }
            }
            const { error } = await supabase.from(table).upsert(record);
            if (error) throw error;
          } else if (op.op === 'PATCH') {
            if (table === 'tasks' && wasUserDeletedTask(String(op.id))) {
              await supabase.from('tasks').delete().eq('id', op.id);
              continue;
            }
            // For tasks: only update status/updated_at to avoid overwriting agent description.
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
        if (debug) console.log('✅ Upload complete!');
      } catch (error) {
        console.error('❌ Upload failed:', error);
        throw error; // Rethrow so PowerSync retries
      }
    }
  });

  console.log('✅ PowerSync connected with Supabase Auth!');
  console.log('📊 Database status:', db.connected ? 'CONNECTED' : 'DISCONNECTED');
  } catch (error) {
    console.error('❌ PowerSync connection failed:', error);
    throw error;
  }
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
