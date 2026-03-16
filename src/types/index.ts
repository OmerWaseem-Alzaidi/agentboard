export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    label: string | null;
    assigned_to: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  }
  
  export interface TaskUpdate {
    id: string;
    task_id: string;
    message: string;
    created_by: string;
    created_at: string;
  }
  
  export interface AgentLog {
    id: string;
    agent_name: string;
    action: string;
    task_id: string | null;
    details: string | null;
    created_at: string;
  }

  export interface TaskMessage {
    id: string;
    task_id: string;
    sender: 'user' | 'agent';
    message: string;
    created_at: string;
  }

  export interface CompanyKnowledge {
    id: string;
    filename: string;
    file_type: string;
    storage_path: string;
    content_text: string | null;
    uploaded_by: string;
    created_at: string;
  }