import { Email, EmailSummary } from './types';
export declare class EmailModel {
    static create(emailData: Omit<Email, 'id' | 'created_at' | 'updated_at'>): Promise<Email>;
    static findById(id: number): Promise<Email | null>;
    static findByGmailId(userId: number, gmailId: string): Promise<Email | null>;
    static findByCategory(categoryId: number, limit?: number, offset?: number): Promise<EmailSummary[]>;
    static findByUserId(userId: number, limit?: number, offset?: number): Promise<EmailSummary[]>;
    static updateCategory(emailId: number, categoryId: number | null): Promise<Email>;
    static markAsRead(emailId: number): Promise<Email>;
    static markAsUnread(emailId: number): Promise<Email>;
    static delete(emailId: number): Promise<void>;
    static bulkDelete(emailIds: number[]): Promise<void>;
    static bulkMarkAsRead(emailIds: number[]): Promise<void>;
    static bulkMarkAsUnread(emailIds: number[]): Promise<void>;
    static getUncategorizedEmails(userId: number, limit?: number, offset?: number): Promise<EmailSummary[]>;
}
//# sourceMappingURL=Email.d.ts.map