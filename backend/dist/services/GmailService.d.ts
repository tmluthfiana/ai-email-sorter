import { GmailMessage } from '../models/types';
export declare class GmailService {
    private static getGmailClient;
    static getProfile(accessToken: string): Promise<import("googleapis").gmail_v1.Schema$Profile>;
    static listMessages(accessToken: string, query?: string, maxResults?: number): Promise<GmailMessage[]>;
    static getMessage(accessToken: string, messageId: string): Promise<GmailMessage | null>;
    static archiveMessage(accessToken: string, messageId: string): Promise<void>;
    static deleteMessage(accessToken: string, messageId: string): Promise<void>;
    static markAsRead(accessToken: string, messageId: string): Promise<void>;
    static markAsUnread(accessToken: string, messageId: string): Promise<void>;
    static extractEmailContent(message: GmailMessage): {
        subject: string;
        sender: string;
        recipients: string[];
        body: string;
        htmlBody: string;
    };
    static cleanHtmlContent(htmlContent: string): string;
    static refreshAccessToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expiry_date: number;
    }>;
    static getLabels(accessToken: string): Promise<import("googleapis").gmail_v1.Schema$Label[]>;
    static createLabel(accessToken: string, name: string, color?: string): Promise<import("googleapis").gmail_v1.Schema$Label>;
    static addLabelToMessage(accessToken: string, messageId: string, labelId: string): Promise<void>;
    static removeLabelFromMessage(accessToken: string, messageId: string, labelId: string): Promise<void>;
}
//# sourceMappingURL=GmailService.d.ts.map