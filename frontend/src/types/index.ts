export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  user_id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: number;
  user_id: number;
  category_id?: number;
  gmail_id: string;
  thread_id?: string;
  subject?: string;
  sender?: string;
  recipients?: string[];
  body?: string;
  html_body?: string;
  clean_text?: string;
  summary?: string;
  is_read: boolean;
  is_archived: boolean;
  received_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSummary {
  id: number;
  subject: string;
  sender: string;
  summary: string;
  received_at: string;
  is_read: boolean;
  category_name?: string;
}

export interface CreateCategoryRequest {
  name: string;
  description: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  color?: string;
}

export interface BulkActionRequest {
  email_ids: number[];
  action: 'delete' | 'unsubscribe' | 'mark_read' | 'mark_unread';
}

export interface UnsubscribeResult {
  emailId: number;
  subject?: string;
  url?: string;
  success: boolean;
  message: string;
  steps?: string[];
  screenshots?: string[];
}

export interface BulkActionResponse {
  message: string;
  results?: UnsubscribeResult[];
  total?: number;
  successful?: number;
}

export interface CategoryStats extends Category {
  email_count: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
} 