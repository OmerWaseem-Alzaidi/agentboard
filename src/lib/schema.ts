import { column, Schema, Table } from '@powersync/web';

const tasks = new Table({
  title: column.text,
  description: column.text,
  status: column.text,
  label: column.text,
  assigned_to: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text
});

const task_updates = new Table({
  task_id: column.text,
  message: column.text,
  created_by: column.text,
  created_at: column.text
});

const agent_logs = new Table({
  agent_name: column.text,
  action: column.text,
  task_id: column.text,
  details: column.text,
  created_at: column.text
});

const task_messages = new Table({
  task_id: column.text,
  sender: column.text,
  message: column.text,
  created_at: column.text
});

const company_knowledge = new Table({
  id: column.text,
  filename: column.text,
  file_type: column.text,
  storage_path: column.text,
  content_text: column.text,
  uploaded_by: column.text,
  created_at: column.text
});

export const AppSchema = new Schema({
  tasks,
  task_updates,
  agent_logs,
  task_messages,
  company_knowledge
});

export type Database = (typeof AppSchema)['types'];