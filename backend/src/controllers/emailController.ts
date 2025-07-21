import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { EmailModel } from '../models/Email';
import { CategoryModel } from '../models/Category';
import { UserModel } from '../models/User';
import { GmailService } from '../services/GmailService';
import { AIService } from '../services/AIService';
import { WebAutomationService } from '../services/WebAutomationService';
import { BulkActionRequest } from '../models/types';
import pool from '../config/database';

export class EmailController {
  static async syncEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userProfile = await UserModel.findById(user.id);
      if (!userProfile || !userProfile.access_token) {
        res.status(400).json({ error: 'User not connected to Gmail' });
        return;
      }

      // Get user's categories
      const categories = await CategoryModel.findByUserId(user.id);
      if (categories.length === 0) {
        res.status(400).json({ error: 'No categories found. Please create categories first.' });
        return;
      }

      // Get query parameters for sync control
      const maxEmails = parseInt(req.query.maxEmails as string) || 50; // Default to 50 emails per sync
      const query = req.query.query as string || 'in:inbox'; // Default to all inbox emails

      console.log(`Starting email sync: max ${maxEmails} emails`);

      // Fetch all emails in batches using pagination
      let gmailMessages: any[] = [];
      let nextPageToken: string | undefined = undefined;
      let fetched = 0;
      do {
        const batch = await GmailService.listMessages(
          userProfile.access_token,
          query,
          Math.min(100, maxEmails - fetched),
          nextPageToken
        );
        gmailMessages.push(...batch.messages);
        nextPageToken = batch.nextPageToken;
        fetched = gmailMessages.length;
      } while (nextPageToken && fetched < maxEmails);

      if (gmailMessages.length === 0) {
        res.json({
          processed: 0,
          errors: 0,
          message: 'No new emails found to process.',
          errorDetails: [],
        });
        return;
      }



      const processedEmails: any[] = [];
      const errors: Array<{ gmailId: string; error: string }> = [];
      let processedCount = 0;

      // Process emails in smaller batches to avoid timeouts
      const batchSize = 5;
      for (let i = 0; i < gmailMessages.length; i += batchSize) {
        const batch = gmailMessages.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (gmailMessage) => {
          try {
            // Check if email already exists
            const existingEmail = await EmailModel.findByGmailId(user.id, gmailMessage.id);
            if (existingEmail) {
              return null; // Skip already processed emails
            }

            // Extract email content
            const emailContent = GmailService.extractEmailContent(gmailMessage);
            if (!emailContent.subject) {
              return null;
            }
            
            // Prepare clean content for AI analysis
            let cleanContentForAI = emailContent.subject;
            
            if (emailContent.cleanText && emailContent.cleanText.trim().length > 10) {
              cleanContentForAI += '\n\n' + emailContent.cleanText;
            } else if (emailContent.body && emailContent.body.trim().length > 10) {
              cleanContentForAI += '\n\n' + emailContent.body;
            }
            
            // Use AI to categorize and summarize
            const aiResult = await AIService.categorizeEmail(
              cleanContentForAI,
              categories
            );

            // Create email record
            const email = await EmailModel.create({
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
            if (userProfile.access_token) {
              await GmailService.archiveMessage(userProfile.access_token, gmailMessage.id);
            }

            processedCount++;

            return email;
          } catch (error) {
            console.error(`Error processing email ${gmailMessage.id}:`, error);
            errors.push({ gmailId: gmailMessage.id, error: (error as Error).message });
            return null;
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        processedEmails.push(...batchResults.filter(Boolean));

        // Small delay between batches to be respectful to APIs
        if (i + batchSize < gmailMessages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successMessage = processedEmails.length > 0 
        ? `Successfully processed ${processedEmails.length} emails! ${errors.length > 0 ? `(${errors.length} errors)` : ''}`
        : 'No new emails were processed.';

      res.json({
        processed: processedEmails.length,
        errors: errors.length,
        message: successMessage,
        errorDetails: errors,
        totalFound: gmailMessages.length,
        maxProcessed: maxEmails,
      });
    } catch (error) {
      console.error('Error syncing emails:', error);
      res.status(500).json({ error: 'Failed to sync emails' });
    }
  }

  static async getEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : null;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      let emails;
      if (categoryId) {
        emails = await EmailModel.findByCategory(categoryId, limit, offset);
      } else {
        emails = await EmailModel.findByUserId(user.id, limit, offset);
      }

      res.json({ emails });
    } catch (error) {
      console.error('Error fetching emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  }

  static async getEmailsByCategory(req: Request, res: Response) {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const userId = (req as any).user.id;

      const emails = await pool.query(`
        SELECT e.*, c.name as category_name, c.color as category_color
        FROM emails e
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE e.user_id = $1 AND e.category_id = $2
        ORDER BY e.received_at DESC
      `, [userId, categoryId]);

      res.json(emails.rows);
    } catch (error) {
      console.error('Error getting emails by category:', error);
      res.status(500).json({ error: 'Failed to get emails by category' });
    }
  }

  static async getEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const emailId = parseInt(req.params.id);
      if (isNaN(emailId)) {
        res.status(400).json({ error: 'Invalid email ID' });
        return;
      }

      const email = await EmailModel.findById(emailId);
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      // Ensure user owns this email
      if (email.user_id !== user.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Debug logging
      console.log('=== Email Debug Info ===');
      console.log('Email ID:', email.id);
      console.log('Subject:', email.subject);
      console.log('Body length:', email.body?.length || 0);
      console.log('HTML body length:', email.html_body?.length || 0);
      console.log('Clean text length:', email.clean_text?.length || 0);
      console.log('Clean text preview:', email.clean_text?.substring(0, 100));
      console.log('HTML body preview:', email.html_body?.substring(0, 100));
      console.log('========================');

      // Process the HTML content to clean it up if clean_text is empty
      let cleanTextContent = email.clean_text || '';
      
      if (!cleanTextContent && email.html_body) {
        // Clean the HTML and extract readable text
        cleanTextContent = GmailService.cleanHtmlContent(email.html_body);
      }

      // Get category information
      let category = null;
      if (email.category_id) {
        category = await CategoryModel.findById(email.category_id);
      }

      // Create response with processed content
      const emailResponse = {
        ...email,
        clean_text: cleanTextContent // Add clean text field
      };

      res.json({ email: emailResponse, category });
    } catch (error) {
      console.error('Error fetching email:', error);
      res.status(500).json({ error: 'Failed to fetch email' });
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const emailId = parseInt(req.params.id);
      if (isNaN(emailId)) {
        res.status(400).json({ error: 'Invalid email ID' });
        return;
      }

      const email = await EmailModel.findById(emailId);
      if (!email || email.user_id !== user.id) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      const updatedEmail = await EmailModel.markAsRead(emailId);
      res.json({ email: updatedEmail });
    } catch (error) {
      console.error('Error marking email as read:', error);
      res.status(500).json({ error: 'Failed to mark email as read' });
    }
  }

  static async markAsUnread(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const emailId = parseInt(req.params.id);
      if (isNaN(emailId)) {
        res.status(400).json({ error: 'Invalid email ID' });
        return;
      }

      const email = await EmailModel.findById(emailId);
      if (!email || email.user_id !== user.id) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      const updatedEmail = await EmailModel.markAsUnread(emailId);
      res.json({ email: updatedEmail });
    } catch (error) {
      console.error('Error marking email as unread:', error);
      res.status(500).json({ error: 'Failed to mark email as unread' });
    }
  }

  static async bulkAction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { email_ids, action }: BulkActionRequest = req.body;

      if (!email_ids || !Array.isArray(email_ids) || email_ids.length === 0) {
        res.status(400).json({ error: 'Email IDs array is required' });
        return;
      }

      if (!['delete', 'unsubscribe', 'mark_read', 'mark_unread'].includes(action)) {
        res.status(400).json({ error: 'Invalid action' });
        return;
      }

      // Verify all emails belong to the user
      for (const emailId of email_ids) {
        const email = await EmailModel.findById(emailId);
        if (!email || email.user_id !== user.id) {
          res.status(403).json({ error: `Access denied to email ${emailId}` });
          return;
        }
      }

      switch (action) {
        case 'delete':
          await EmailModel.bulkDelete(email_ids);
          break;
        case 'mark_read':
          await EmailModel.bulkMarkAsRead(email_ids);
          break;
        case 'mark_unread':
          await EmailModel.bulkMarkAsUnread(email_ids);
          break;
        case 'unsubscribe':
          // Handle unsubscribe for each email using AI agent
          const unsubscribeResults = [];
          for (const emailId of email_ids) {
            try {
              const email = await EmailModel.findById(emailId);
              if (email && email.html_body) {
                // Extract unsubscribe information from email content
                const unsubscribeInfo = await AIService.extractUnsubscribeInfo(email.html_body);
                
                if (unsubscribeInfo.url) {
                  // Use AI agent to automate unsubscribe process
                  const automationResult = await WebAutomationService.executeUnsubscribe(
                    unsubscribeInfo.url, 
                    email.html_body || email.body || ''
                  );
                  
                  unsubscribeResults.push({
                    emailId,
                    subject: email.subject,
                    url: unsubscribeInfo.url,
                    success: automationResult.success,
                    message: automationResult.message,
                    steps: automationResult.steps,
                    screenshots: automationResult.screenshots
                  });
                  
                  console.log(`AI Unsubscribe for email ${emailId}:`, {
                    url: unsubscribeInfo.url,
                    success: automationResult.success,
                    message: automationResult.message
                  });
                } else {
                  unsubscribeResults.push({
                    emailId,
                    subject: email.subject,
                    success: false,
                    message: 'No unsubscribe link found in email'
                  });
                }
              }
            } catch (error) {
              console.error(`Error processing unsubscribe for email ${emailId}:`, error);
              unsubscribeResults.push({
                emailId,
                success: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              });
            }
          }
          
          // Return detailed results
          res.json({ 
            message: 'Unsubscribe processing completed',
            results: unsubscribeResults,
            total: unsubscribeResults.length,
            successful: unsubscribeResults.filter(r => r.success).length
          });
          return;
      }

      res.json({ message: `Bulk action '${action}' completed successfully` });
    } catch (error) {
      console.error('Error performing bulk action:', error);
      res.status(500).json({ error: 'Failed to perform bulk action' });
    }
  }

  static async bulkUnsubscribe(req: Request, res: Response) {
    try {
      const { email_ids } = req.body;
      const userId = (req as any).user.id;

      if (!email_ids || !Array.isArray(email_ids)) {
        return res.status(400).json({ error: 'email_ids array is required' });
      }

      // Get the emails that belong to the user
      const emails = await pool.query(`
        SELECT id, subject, body, html_body, clean_text
        FROM emails 
        WHERE id = ANY($1) AND user_id = $2
      `, [email_ids, userId]);

      const results = [];

      for (const email of emails.rows) {
        try {
          // Extract unsubscribe links from email content
          const unsubscribeLinks = this.extractUnsubscribeLinks(email);
          
          if (unsubscribeLinks.length > 0) {
            // For now, just log the unsubscribe links
            // In a real implementation, you'd use a headless browser to automate the unsubscribe process
            console.log(`Found unsubscribe links for email ${email.id}:`, unsubscribeLinks);
            
            results.push({
              email_id: email.id,
              subject: email.subject,
              success: true,
              message: `Found ${unsubscribeLinks.length} unsubscribe link(s)`,
              links: unsubscribeLinks
            });
          } else {
            results.push({
              email_id: email.id,
              subject: email.subject,
              success: false,
              message: 'No unsubscribe links found'
            });
          }
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          results.push({
            email_id: email.id,
            subject: email.subject,
            success: false,
            message: 'Error processing email'
          });
        }
      }

      // Delete the emails from our database after processing
      await pool.query(`
        DELETE FROM emails 
        WHERE id = ANY($1) AND user_id = $2
      `, [email_ids, userId]);

      res.json({ 
        message: 'Bulk unsubscribe completed',
        results 
      });
    } catch (error) {
      console.error('Error in bulk unsubscribe:', error);
      res.status(500).json({ error: 'Failed to process bulk unsubscribe' });
    }
  }

  private static extractUnsubscribeLinks(email: any): string[] {
    const links: string[] = [];
    const content = email.clean_text || email.body || email.html_body || '';
    
    // Common unsubscribe link patterns
    const patterns = [
      /https?:\/\/[^\s]*unsubscribe[^\s]*/gi,
      /https?:\/\/[^\s]*opt.?out[^\s]*/gi,
      /https?:\/\/[^\s]*remove[^\s]*/gi,
      /https?:\/\/[^\s]*cancel[^\s]*/gi,
      /https?:\/\/[^\s]*manage[^\s]*preferences[^\s]*/gi,
      /https?:\/\/[^\s]*email[^\s]*preferences[^\s]*/gi,
      /https?:\/\/[^\s]*subscription[^\s]*/gi
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        links.push(...matches);
      }
    }

    // Remove duplicates and clean up
    return [...new Set(links)].map(link => 
      link.replace(/[^\w\-._~:/?#[\]@!$&'()*+,;=%]/g, '')
    );
  }

  static async deleteEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const emailId = parseInt(req.params.id);
      if (isNaN(emailId)) {
        res.status(400).json({ error: 'Invalid email ID' });
        return;
      }

      const email = await EmailModel.findById(emailId);
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      // Ensure user owns this email
      if (email.user_id !== user.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Delete from Gmail if connected
      const userProfile = await UserModel.findById(user.id);
      if (userProfile?.access_token && email.gmail_id) {
        try {
          await GmailService.deleteMessage(userProfile.access_token, email.gmail_id);
        } catch (gmailError) {
          console.warn('Failed to delete from Gmail:', gmailError);
        }
      }

      // Delete from database
      await EmailModel.delete(emailId);

      res.json({ message: 'Email deleted successfully' });
    } catch (error) {
      console.error('Error deleting email:', error);
      res.status(500).json({ error: 'Failed to delete email' });
    }
  }

  static async cleanExistingEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get all emails for this user
      const emails = await EmailModel.findByUserId(user.id, 1000, 0);
      let processedCount = 0;

      for (const email of emails) {
        try {
          // Get full email data
          const fullEmail = await EmailModel.findById(email.id);
          if (fullEmail && fullEmail.html_body) {
            // Clean the HTML content
            const cleanedHtml = GmailService.cleanHtmlContent(fullEmail.html_body);
            
            // Update the email with cleaned content
            await pool.query(
              'UPDATE emails SET html_body = $1 WHERE id = $2',
              [cleanedHtml, email.id]
            );
            
            processedCount++;
          }
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
        }
      }

      res.json({ 
        message: `Successfully cleaned ${processedCount} emails`,
        processed: processedCount
      });
    } catch (error) {
      console.error('Error cleaning existing emails:', error);
      res.status(500).json({ error: 'Failed to clean existing emails' });
    }
  }

  static async testGmailConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userProfile = await UserModel.findById(user.id);
      if (!userProfile || !userProfile.access_token) {
        res.status(400).json({ error: 'User not connected to Gmail' });
        return;
      }

      // Test different queries to see what emails are available
      const testQueries = [
        { name: 'Unread emails', query: 'is:unread' },
        { name: 'Inbox emails', query: 'in:inbox' },
        { name: 'Primary category', query: 'category:primary' },
        { name: 'Promotions category', query: 'category:promotions' },
        { name: 'Social category', query: 'category:social' },
        { name: 'Updates category', query: 'category:updates' },
        { name: 'Forums category', query: 'category:forums' },
        { name: 'Important emails', query: 'is:important' },
        { name: 'Last 30 days', query: 'newer_than:30d' },
        { name: 'Unread inbox', query: 'in:inbox is:unread' },
        { name: 'Unread promotions', query: 'category:promotions is:unread' },
        { name: 'Unread social', query: 'category:social is:unread' },
        { name: 'Unread updates', query: 'category:updates is:unread' },
        { name: 'All emails', query: '' }
      ];

      const results = [];

      for (const testQuery of testQueries) {
        try {
          const gmailMessages = await GmailService.listMessages(
            userProfile.access_token,
            testQuery.query,
            20 // Get 20 emails for testing
          );

          results.push({
            query: testQuery.name,
            queryString: testQuery.query,
            found: gmailMessages.messages.length,
            sampleSubjects: gmailMessages.messages.slice(0, 3).map((msg: any) => {
              const content = GmailService.extractEmailContent(msg);
              return content.subject || 'No subject';
            })
          });
        } catch (error) {
          results.push({
            query: testQuery.name,
            queryString: testQuery.query,
            found: 0,
            error: (error as Error).message
          });
        }
      }

      res.json({
        message: 'Gmail connection test completed',
        results,
        userEmail: userProfile.email
      });
    } catch (error) {
      console.error('Error testing Gmail connection:', error);
      res.status(500).json({ error: 'Failed to test Gmail connection' });
    }
  }

  static async clearAllEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Delete all emails for this user
      const result = await pool.query(
        'DELETE FROM emails WHERE user_id = $1 RETURNING id',
        [user.id]
      );

      const deletedCount = result.rowCount || 0;

      res.json({ 
        message: `Successfully cleared ${deletedCount} emails`,
        deleted: deletedCount
      });
    } catch (error) {
      console.error('Error clearing emails:', error);
      res.status(500).json({ error: 'Failed to clear emails' });
    }
  }

  static async advancedUnsubscribe(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }
    const result = await WebAutomationService.unsubscribeFromLink(url);
    res.json(result);
  }
} 