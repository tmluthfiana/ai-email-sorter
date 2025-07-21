export interface User {
    id: number;
    google_id: string;
    email: string;
    name: string;
    picture?: string;
    access_token?: string;
    refresh_token?: string;
    token_expiry?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface Category {
    id: number;
    user_id: number;
    name: string;
    description: string;
    color: string;
    created_at: Date;
    updated_at: Date;
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
    received_at?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface EmailLabel {
    id: number;
    email_id: number;
    label_id: string;
    label_name: string;
    created_at: Date;
}
export interface UnsubscribeLink {
    id: number;
    email_id: number;
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: Record<string, any>;
    is_processed: boolean;
    processed_at?: Date;
    created_at: Date;
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
export interface EmailSummary {
    id: number;
    subject: string;
    sender: string;
    summary: string;
    received_at: Date;
    is_read: boolean;
    category_name?: string;
}
export interface BulkActionRequest {
    email_ids: number[];
    action: 'delete' | 'unsubscribe' | 'mark_read' | 'mark_unread';
}
export interface GmailMessage {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    payload: {
        headers: Array<{
            name: string;
            value: string;
        }>;
        body?: {
            data?: string;
        };
        parts?: Array<{
            mimeType: string;
            body: {
                data?: string;
            };
        }>;
    };
    internalDate: string;
}
export interface AIAnalysisResult {
    category_id: number;
    summary: string;
    confidence: number;
}
//# sourceMappingURL=types.d.ts.map