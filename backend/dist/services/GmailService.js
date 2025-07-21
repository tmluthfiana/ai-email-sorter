"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailService = void 0;
const googleapis_1 = require("googleapis");
class GmailService {
    static getGmailClient(accessToken) {
        const oauth2Client = new googleapis_1.google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
    }
    static async getProfile(accessToken) {
        const gmail = this.getGmailClient(accessToken);
        const response = await gmail.users.getProfile({ userId: 'me' });
        return response.data;
    }
    static async listMessages(accessToken, query = 'is:unread', maxResults = 50) {
        const gmail = this.getGmailClient(accessToken);
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults,
        });
        const messages = response.data.messages || [];
        const detailedMessages = [];
        // Get detailed information for each message
        for (const message of messages) {
            if (message.id) {
                const detailedMessage = await this.getMessage(accessToken, message.id);
                if (detailedMessage) {
                    detailedMessages.push(detailedMessage);
                }
            }
        }
        return detailedMessages;
    }
    static async getMessage(accessToken, messageId) {
        try {
            const gmail = this.getGmailClient(accessToken);
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full',
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching message ${messageId}:`, error);
            return null;
        }
    }
    static async archiveMessage(accessToken, messageId) {
        const gmail = this.getGmailClient(accessToken);
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: ['INBOX'],
                // Note: Gmail automatically archives messages when INBOX label is removed
                // No need to add ARCHIVE label as it's not a valid label ID
            },
        });
    }
    static async deleteMessage(accessToken, messageId) {
        const gmail = this.getGmailClient(accessToken);
        await gmail.users.messages.delete({
            userId: 'me',
            id: messageId,
        });
    }
    static async markAsRead(accessToken, messageId) {
        const gmail = this.getGmailClient(accessToken);
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: ['UNREAD'],
            },
        });
    }
    static async markAsUnread(accessToken, messageId) {
        const gmail = this.getGmailClient(accessToken);
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                addLabelIds: ['UNREAD'],
            },
        });
    }
    static extractEmailContent(message) {
        const headers = message.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name === 'Cc')?.value || '';
        const recipients = [to, cc].filter(Boolean).flatMap(addr => addr.split(',').map(a => a.trim()));
        let body = '';
        let htmlBody = '';
        if (message.payload?.body?.data) {
            const content = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
            body = content;
        }
        else if (message.payload?.parts) {
            for (const part of message.payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
                else if (part.mimeType === 'text/html' && part.body?.data) {
                    htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
            }
        }
        // Clean up HTML body if it exists
        if (htmlBody) {
            htmlBody = this.cleanHtmlContent(htmlBody);
        }
        return {
            subject,
            sender: from,
            recipients,
            body,
            htmlBody,
        };
    }
    static cleanHtmlContent(htmlContent) {
        try {
            // Aggressively clean the HTML first
            let cleaned = htmlContent
                // Remove DOCTYPE and HTML structure
                .replace(/<!DOCTYPE[^>]*>/gi, '')
                .replace(/<html[^>]*>/gi, '')
                .replace(/<\/html>/gi, '')
                .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
                .replace(/<body[^>]*>/gi, '')
                .replace(/<\/body>/gi, '')
                // Remove all comments including Microsoft Office conditional comments
                .replace(/<!--[\s\S]*?-->/gi, '')
                // Remove XML and Office-specific tags
                .replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '')
                .replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '')
                .replace(/<o:[^>]*\/>/gi, '')
                // Remove scripts and styles
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                // Remove meta, link, title tags
                .replace(/<meta[^>]*>/gi, '')
                .replace(/<link[^>]*>/gi, '')
                .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
                // Clean up whitespace
                .replace(/\s+/g, ' ')
                .trim();
            // Extract plain text from cleaned HTML
            let textContent = cleaned
                // Convert links to readable format
                .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
                // Remove remaining HTML tags
                .replace(/<[^>]*>/g, ' ')
                // Clean up whitespace again
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .replace(/^\s+|\s+$/g, '')
                // Replace HTML entities
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#8202;/g, ' ')
                .trim();
            // If we have meaningful text content, return it
            if (textContent && textContent.length > 20) {
                return textContent;
            }
            // If still no good content, try more aggressive approach
            const strippedText = htmlContent
                .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#8202;/g, ' ')
                .trim();
            return strippedText;
        }
        catch (error) {
            console.error('Error cleaning HTML content:', error);
            // Final fallback: strip all HTML tags and entities
            return htmlContent
                .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#8202;/g, ' ')
                .trim();
        }
    }
    static async refreshAccessToken(refreshToken) {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            return {
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token || undefined,
                expiry_date: credentials.expiry_date,
            };
        }
        catch (error) {
            console.error('Error refreshing access token:', error);
            throw new Error('Failed to refresh access token');
        }
    }
    static async getLabels(accessToken) {
        const gmail = this.getGmailClient(accessToken);
        const response = await gmail.users.labels.list({
            userId: 'me',
        });
        return response.data.labels || [];
    }
    static async createLabel(accessToken, name, color) {
        const gmail = this.getGmailClient(accessToken);
        const response = await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
                name,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show',
            },
        });
        return response.data;
    }
    static async addLabelToMessage(accessToken, messageId, labelId) {
        const gmail = this.getGmailClient(accessToken);
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                addLabelIds: [labelId],
            },
        });
    }
    static async removeLabelFromMessage(accessToken, messageId, labelId) {
        const gmail = this.getGmailClient(accessToken);
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: [labelId],
            },
        });
    }
}
exports.GmailService = GmailService;
//# sourceMappingURL=GmailService.js.map