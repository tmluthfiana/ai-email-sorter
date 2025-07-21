import { google } from 'googleapis';
import { User, GmailMessage } from '../models/types';

export class GmailService {
  private static getGmailClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  static async getProfile(accessToken: string) {
    const gmail = this.getGmailClient(accessToken);
    const response = await gmail.users.getProfile({ userId: 'me' });
    return response.data;
  }

  static async listMessages(
    accessToken: string,
    query: string = 'is:unread',
    maxResults: number = 50,
    pageToken?: string
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    const gmail = this.getGmailClient(accessToken);
    
    const listParams: any = {
      userId: 'me',
      q: query,
      maxResults,
    };
    if (typeof pageToken === 'string') {
      listParams.pageToken = pageToken;
    }
    const response = await gmail.users.messages.list(listParams);

    const messages = response.data.messages || [];
    const detailedMessages: GmailMessage[] = [];

    // Get detailed information for each message
    for (const message of messages) {
      if (message.id) {
        const detailedMessage = await this.getMessage(accessToken, message.id);
        if (detailedMessage) {
          detailedMessages.push(detailedMessage);
        }
      }
    }

    return { messages: detailedMessages, nextPageToken: response.data.nextPageToken ?? undefined };
  }

  static async getMessage(accessToken: string, messageId: string): Promise<GmailMessage | null> {
    try {
      const gmail = this.getGmailClient(accessToken);
      
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data as GmailMessage;
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      return null;
    }
  }

  static async archiveMessage(accessToken: string, messageId: string): Promise<void> {
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

  static async deleteMessage(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getGmailClient(accessToken);
    
    await gmail.users.messages.delete({
      userId: 'me',
      id: messageId,
    });
  }

  static async markAsRead(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getGmailClient(accessToken);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  static async markAsUnread(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getGmailClient(accessToken);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  static extractEmailContent(message: GmailMessage): {
    subject: string;
    sender: string;
    recipients: string[];
    body: string;
    htmlBody: string;
    cleanText: string;
  } {
    const headers = message.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const to = headers.find(h => h.name === 'To')?.value || '';
    const cc = headers.find(h => h.name === 'Cc')?.value || '';

    const recipients = [to, cc].filter(Boolean).flatMap(addr => 
      addr.split(',').map(a => a.trim())
    );

    let body = '';
    let htmlBody = '';
    let cleanText = '';

    if (message.payload?.body?.data) {
      const content = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      body = content;
    } else if (message.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    // Generate clean text from HTML if available
    if (htmlBody) {
      cleanText = this.cleanHtmlContent(htmlBody);
    } else if (body) {
      cleanText = body;
    }

    return {
      subject,
      sender: from,
      recipients,
      body,
      htmlBody,
      cleanText,
    };
  }

  static cleanHtmlContent(htmlContent: string): string {
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
    } catch (error) {
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

  static async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
  }> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      return {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || undefined,
        expiry_date: credentials.expiry_date!,
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  static async getLabels(accessToken: string) {
    const gmail = this.getGmailClient(accessToken);
    
    const response = await gmail.users.labels.list({
      userId: 'me',
    });

    return response.data.labels || [];
  }

  static async createLabel(accessToken: string, name: string, color?: string) {
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

  static async addLabelToMessage(accessToken: string, messageId: string, labelId: string): Promise<void> {
    const gmail = this.getGmailClient(accessToken);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }

  static async removeLabelFromMessage(accessToken: string, messageId: string, labelId: string): Promise<void> {
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