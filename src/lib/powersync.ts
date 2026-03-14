import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'agentboard.db',
  },
  flags: {
    enableMultiTabs: true
  }
});

// Initialize PowerSync connection
export async function initPowerSync() {
  const powerSyncUrl = import.meta.env.VITE_POWERSYNC_URL;
  const token = import.meta.env.VITE_POWERSYNC_TOKEN;

  if (!powerSyncUrl || !token) {
    throw new Error('Missing PowerSync credentials');
  }

  await db.connect({
    fetchCredentials: async () => {
      return {
        endpoint: powerSyncUrl,
        token: token
      };
    },
    uploadData: async () => {
      // We'll implement this later for uploading changes
      console.log('Upload not implemented yet');
    }
  });

  console.log('✅ PowerSync connected!');
}