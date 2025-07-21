import { 
  User, 
  Category, 
  Email, 
  EmailSummary, 
  CreateCategoryRequest, 
  UpdateCategoryRequest, 
  BulkActionRequest,
  CategoryStats,
  AuthResponse,
  ApiResponse,
  BulkActionResponse 
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async getAuthUrl(): Promise<{ authUrl: string }> {
    return this.request<{ authUrl: string }>('/auth/google/url');
  }

  async getProfile(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/profile');
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async logout(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  }

  async listLinkedAccounts(): Promise<{ accounts: { email: string; primary: boolean }[] }> {
    return this.request<{ accounts: { email: string; primary: boolean }[] }>('/auth/accounts');
  }

  async linkGmailAccount(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/accounts/link', { method: 'POST' });
  }

  async removeGmailAccount(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/accounts/${encodeURIComponent(email)}`, { method: 'DELETE' });
  }

  async clearAllUserData(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/clear-all', { method: 'DELETE' });
  }

  // Category endpoints
  async getCategories(): Promise<{ categories: Category[] }> {
    return this.request<{ categories: Category[] }>('/categories');
  }

  async getCategoryStats(): Promise<{ stats: CategoryStats[] }> {
    return this.request<{ stats: CategoryStats[] }>('/categories/stats');
  }

  async createCategory(data: CreateCategoryRequest): Promise<{ category: Category }> {
    return this.request<{ category: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: number, data: UpdateCategoryRequest): Promise<{ category: Category }> {
    return this.request<{ category: Category }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  async getCategory(id: number): Promise<Category> {
    const response = await this.request<Category>(`/categories/${id}`);
    return response;
  }

  async getEmailsByCategory(categoryId: number): Promise<Email[]> {
    const response = await this.request<{ emails: Email[] }>(`/emails?categoryId=${categoryId}`);
    return response.emails;
  }

  async bulkUnsubscribe(emailIds: number[]): Promise<void> {
    await this.request<void>('/emails/bulk-unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ email_ids: emailIds }),
    });
  }

  // Email endpoints
  async syncEmails(query?: string, maxEmails?: number): Promise<{ processed: number; errors: number; errorDetails: any[]; message?: string; totalFound?: number; maxProcessed?: number }> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (maxEmails) params.append('maxEmails', maxEmails.toString());
    
    return this.request<{ processed: number; errors: number; errorDetails: any[]; message?: string; totalFound?: number; maxProcessed?: number }>(`/emails/sync?${params}`, {
      method: 'POST',
    });
  }

  async getEmails(categoryId?: number, limit = 50, offset = 0): Promise<{ emails: EmailSummary[] }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    if (categoryId) {
      params.append('categoryId', categoryId.toString());
    }

    return this.request<{ emails: EmailSummary[] }>(`/emails?${params}`);
  }

  async getEmail(id: number): Promise<{ email: Email; category?: Category }> {
    return this.request<{ email: Email; category?: Category }>(`/emails/${id}`);
  }

  async markAsRead(id: number): Promise<{ email: Email }> {
    return this.request<{ email: Email }>(`/emails/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAsUnread(id: number): Promise<{ email: Email }> {
    return this.request<{ email: Email }>(`/emails/${id}/unread`, {
      method: 'PATCH',
    });
  }

  async deleteEmail(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/emails/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkAction(request: BulkActionRequest): Promise<BulkActionResponse> {
    const response = await this.request<BulkActionResponse>('/emails/bulk-action', {
      method: 'POST',
      body: JSON.stringify(request)
    });
    return response;
  }

  async testGmailConnection(): Promise<{ message: string; results: any[]; userEmail: string }> {
    return this.request<{ message: string; results: any[]; userEmail: string }>('/emails/test-connection');
  }

  async cleanExistingEmails(): Promise<{ message: string; processed: number }> {
    const response = await this.request<{ message: string; processed: number }>('/emails/clean', {
      method: 'POST'
    });
    return response;
  }

  async clearAllEmails(): Promise<{ message: string; deleted: number }> {
    const response = await this.request<{ message: string; deleted: number }>('/emails/clear-all', {
      method: 'DELETE'
    });
    return response;
  }
}

export const apiService = new ApiService(); 