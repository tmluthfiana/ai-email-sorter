import { UserModel } from '../models/User';
import { EmailController } from '../controllers/emailController';
import { GmailService } from './GmailService';

export class EmailSyncService {
  private static isRunning = false;
  private static syncInterval: NodeJS.Timeout | null = null;

  static startAutoSync(intervalMinutes: number = 15) {
    if (this.isRunning) {
      console.log('Email sync service is already running');
      return;
    }

    console.log(`Starting automatic email sync every ${intervalMinutes} minutes`);
    this.isRunning = true;

    // Run initial sync
    this.performSync();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, intervalMinutes * 60 * 1000);
  }

  static stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('Stopped automatic email sync');
  }

  private static async performSync() {
    if (this.isRunning) {
      console.log('Starting automatic email sync...');
      
      try {
        // Get all users with valid Gmail tokens
        const users = await UserModel.findAllWithValidTokens();
        
        console.log(`Found ${users.length} users with valid tokens`);
        
        for (const user of users) {
          try {
            console.log(`Syncing emails for user ${user.email}...`);
            
            // Check if token needs refresh
            if (user.token_expiry && new Date() > new Date(user.token_expiry)) {
              console.log(`Refreshing token for user ${user.email}...`);
              if (!user.refresh_token) {
                console.log(`No refresh token for user ${user.email}, skipping sync`);
                continue;
              }
              const refreshed = await GmailService.refreshAccessToken(user.refresh_token!);
              if (refreshed) {
                await UserModel.updateTokens(user.id, refreshed.access_token, refreshed.refresh_token || user.refresh_token!, refreshed.expiry_date);
                user.access_token = refreshed.access_token;
              } else {
                console.log(`Failed to refresh token for user ${user.email}, skipping sync`);
                continue;
              }
            }
            
            // Perform sync for this user
            await this.syncEmailsForUser(user);
            
          } catch (error) {
            console.error(`Error syncing emails for user ${user.email}:`, error);
          }
        }
        
        console.log('Automatic email sync completed');
        
      } catch (error) {
        console.error('Error in automatic email sync:', error);
      }
    }
  }

  private static async syncEmailsForUser(user: any) {
    try {
      // Get user's categories
      const categories = await user.getCategories();
      
      if (categories.length === 0) {
        console.log(`No categories found for user ${user.email}, skipping sync`);
        return;
      }

      // Get recent unread emails from Gmail
      const gmailMessages = await GmailService.listMessages(
        user.access_token,
        'is:unread',
        20 // Limit to 20 emails per sync to avoid overwhelming
      );

      if (gmailMessages.messages.length === 0) {
        console.log(`No new emails found for user ${user.email}`);
        return;
      }

      console.log(`Found ${gmailMessages.messages.length} new emails for user ${user.email}`);

      // Process each email
      let processedCount = 0;
      for (const gmailMessage of gmailMessages.messages) {
        try {
          // Check if email already exists in our database
          const existingEmail = await user.getEmails({
            where: { gmail_id: gmailMessage.id }
          });

          if (existingEmail.length > 0) {
            console.log(`Email ${gmailMessage.id} already exists, skipping`);
            continue;
          }

          // Extract email content
          const emailContent = GmailService.extractEmailContent(gmailMessage);
          if (!emailContent.subject) {
            console.log(`Email ${gmailMessage.id} has no subject, skipping`);
            continue;
          }

          // Prepare content for AI analysis
          let cleanContentForAI = emailContent.subject;
          if (emailContent.cleanText && emailContent.cleanText.trim().length > 10) {
            cleanContentForAI += '\n\n' + emailContent.cleanText;
          } else if (emailContent.body && emailContent.body.trim().length > 10) {
            cleanContentForAI += '\n\n' + emailContent.body;
          }

          // Use AI to categorize and summarize
          const { AIService } = await import('./AIService');
          const aiResult = await AIService.categorizeEmail(cleanContentForAI, categories);

          // Create email record
          const { EmailModel } = await import('../models/Email');
          await EmailModel.create({
            user_id: user.id,
            category_id: aiResult.category_id || undefined,
            gmail_id: gmailMessage.id,
            thread_id: gmailMessage.threadId,
            subject: emailContent.subject,
            sender: emailContent.sender,
            recipients: emailContent.recipients,
            body: emailContent.body,
            html_body: emailContent.htmlBody,
            clean_text: emailContent.cleanText,
            summary: aiResult.summary,
            is_read: false,
            is_archived: false,
            received_at: new Date(parseInt(gmailMessage.internalDate)),
          });

          // Archive the email in Gmail
          await GmailService.archiveMessage(user.access_token, gmailMessage.id);
          
          processedCount++;
          console.log(`Processed email ${processedCount}/${gmailMessages.messages.length}: ${emailContent.subject}`);

        } catch (error) {
          console.error(`Error processing email ${gmailMessage.id}:`, error);
        }
      }

      console.log(`Completed sync for user ${user.email}: ${processedCount} emails processed`);

    } catch (error) {
      console.error(`Error syncing emails for user ${user.email}:`, error);
    }
  }

  static getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.syncInterval !== null
    };
  }
} 