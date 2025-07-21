"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailController = void 0;
const Email_1 = require("../models/Email");
const Category_1 = require("../models/Category");
const User_1 = require("../models/User");
const GmailService_1 = require("../services/GmailService");
const AIService_1 = require("../services/AIService");
const WebAutomationService_1 = require("../services/WebAutomationService");
const database_1 = __importDefault(require("../config/database"));
class EmailController {
    static async syncEmails(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const userProfile = await User_1.UserModel.findById(user.id);
            if (!userProfile || !userProfile.access_token) {
                res.status(400).json({ error: 'User not connected to Gmail' });
                return;
            }
            // Get user's categories
            const categories = await Category_1.CategoryModel.findByUserId(user.id);
            if (categories.length === 0) {
                res.status(400).json({ error: 'No categories found. Please create categories first.' });
                return;
            }
            // Get query parameters for sync control
            const maxEmails = parseInt(req.query.maxEmails) || 20; // Default to 20 emails per sync
            const query = req.query.query || 'is:unread'; // Default to unread emails
            console.log(`Starting email sync for user ${user.id}: max ${maxEmails} emails, query: "${query}"`);
            // Get emails from Gmail (limited to prevent overwhelming the system)
            const gmailMessages = await GmailService_1.GmailService.listMessages(userProfile.access_token, query, maxEmails);
            if (gmailMessages.length === 0) {
                res.json({
                    processed: 0,
                    errors: 0,
                    message: 'No new emails found to process.',
                    errorDetails: [],
                });
                return;
            }
            console.log(`Found ${gmailMessages.length} emails to process`);
            const processedEmails = [];
            const errors = [];
            let processedCount = 0;
            // Process emails in smaller batches to avoid timeouts
            const batchSize = 5;
            for (let i = 0; i < gmailMessages.length; i += batchSize) {
                const batch = gmailMessages.slice(i, i + batchSize);
                // Process batch in parallel
                const batchPromises = batch.map(async (gmailMessage) => {
                    try {
                        // Check if email already exists
                        const existingEmail = await Email_1.EmailModel.findByGmailId(user.id, gmailMessage.id);
                        if (existingEmail) {
                            console.log(`Email ${gmailMessage.id} already exists, skipping`);
                            return null; // Skip already processed emails
                        }
                        console.log(`Processing email ${gmailMessage.id}...`);
                        // Extract email content
                        const emailContent = GmailService_1.GmailService.extractEmailContent(gmailMessage);
                        if (!emailContent.subject) {
                            console.warn(`Email ${gmailMessage.id} has no subject, skipping`);
                            return null;
                        }
                        console.log(`Email subject: ${emailContent.subject}`);
                        // Prepare clean content for AI analysis
                        let cleanContentForAI = emailContent.subject;
                        let cleanText = emailContent.subject;
                        if (emailContent.body && emailContent.body.trim().length > 10) {
                            cleanContentForAI += '\n\n' + emailContent.body;
                            cleanText += '\n\n' + emailContent.body;
                        }
                        else if (emailContent.htmlBody) {
                            // Extract clean text from HTML for AI and storage
                            const extractedText = GmailService_1.GmailService.cleanHtmlContent(emailContent.htmlBody);
                            if (extractedText.length > 10) {
                                cleanContentForAI += '\n\n' + extractedText;
                                cleanText = extractedText;
                            }
                        }
                        console.log(`Calling AI categorization...`);
                        console.log(`Categories available:`, categories.map(c => ({ id: c.id, name: c.name, description: c.description })));
                        console.log(`Content for AI (first 200 chars):`, cleanContentForAI.substring(0, 200));
                        // Use AI to categorize and summarize
                        const aiResult = await AIService_1.AIService.categorizeEmail(cleanContentForAI, categories);
                        console.log(`AI result: category_id=${aiResult.category_id}, confidence=${aiResult.confidence}, summary=${aiResult.summary}`);
                        // Create email record
                        const email = await Email_1.EmailModel.create({
                            user_id: user.id,
                            category_id: aiResult.category_id || undefined,
                            gmail_id: gmailMessage.id,
                            thread_id: gmailMessage.threadId,
                            subject: emailContent.subject,
                            sender: emailContent.sender,
                            recipients: emailContent.recipients,
                            body: emailContent.body,
                            html_body: emailContent.htmlBody,
                            clean_text: cleanText,
                            summary: aiResult.summary,
                            is_read: false,
                            is_archived: false,
                            received_at: new Date(parseInt(gmailMessage.internalDate)),
                        });
                        console.log(`Email saved to database with ID: ${email.id}`);
                        // Archive the email in Gmail
                        if (userProfile.access_token) {
                            await GmailService_1.GmailService.archiveMessage(userProfile.access_token, gmailMessage.id);
                            console.log(`Email archived in Gmail`);
                        }
                        processedCount++;
                        console.log(`Processed email ${processedCount}/${gmailMessages.length}: ${emailContent.subject}`);
                        return email;
                    }
                    catch (error) {
                        console.error(`Error processing email ${gmailMessage.id}:`, error);
                        errors.push({ gmailId: gmailMessage.id, error: error.message });
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
        }
        catch (error) {
            console.error('Error syncing emails:', error);
            res.status(500).json({ error: 'Failed to sync emails' });
        }
    }
    static async getEmails(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            let emails;
            if (categoryId) {
                emails = await Email_1.EmailModel.findByCategory(categoryId, limit, offset);
            }
            else {
                emails = await Email_1.EmailModel.findByUserId(user.id, limit, offset);
            }
            res.json({ emails });
        }
        catch (error) {
            console.error('Error fetching emails:', error);
            res.status(500).json({ error: 'Failed to fetch emails' });
        }
    }
    static async getEmail(req, res) {
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
            const email = await Email_1.EmailModel.findById(emailId);
            if (!email) {
                res.status(404).json({ error: 'Email not found' });
                return;
            }
            // Ensure user owns this email
            if (email.user_id !== user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            // Process the HTML content to clean it up
            let cleanTextContent = '';
            if (email.html_body) {
                // Clean the HTML and extract readable text
                cleanTextContent = GmailService_1.GmailService.cleanHtmlContent(email.html_body);
            }
            // Create response with processed content
            const emailResponse = {
                ...email,
                clean_text: cleanTextContent // Add clean text field
            };
            res.json({ email: emailResponse });
        }
        catch (error) {
            console.error('Error fetching email:', error);
            res.status(500).json({ error: 'Failed to fetch email' });
        }
    }
    static async markAsRead(req, res) {
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
            const email = await Email_1.EmailModel.findById(emailId);
            if (!email || email.user_id !== user.id) {
                res.status(404).json({ error: 'Email not found' });
                return;
            }
            const updatedEmail = await Email_1.EmailModel.markAsRead(emailId);
            res.json({ email: updatedEmail });
        }
        catch (error) {
            console.error('Error marking email as read:', error);
            res.status(500).json({ error: 'Failed to mark email as read' });
        }
    }
    static async markAsUnread(req, res) {
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
            const email = await Email_1.EmailModel.findById(emailId);
            if (!email || email.user_id !== user.id) {
                res.status(404).json({ error: 'Email not found' });
                return;
            }
            const updatedEmail = await Email_1.EmailModel.markAsUnread(emailId);
            res.json({ email: updatedEmail });
        }
        catch (error) {
            console.error('Error marking email as unread:', error);
            res.status(500).json({ error: 'Failed to mark email as unread' });
        }
    }
    static async bulkAction(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const { email_ids, action } = req.body;
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
                const email = await Email_1.EmailModel.findById(emailId);
                if (!email || email.user_id !== user.id) {
                    res.status(403).json({ error: `Access denied to email ${emailId}` });
                    return;
                }
            }
            switch (action) {
                case 'delete':
                    await Email_1.EmailModel.bulkDelete(email_ids);
                    break;
                case 'mark_read':
                    await Email_1.EmailModel.bulkMarkAsRead(email_ids);
                    break;
                case 'mark_unread':
                    await Email_1.EmailModel.bulkMarkAsUnread(email_ids);
                    break;
                case 'unsubscribe':
                    // Handle unsubscribe for each email using AI agent
                    const unsubscribeResults = [];
                    for (const emailId of email_ids) {
                        try {
                            const email = await Email_1.EmailModel.findById(emailId);
                            if (email && email.html_body) {
                                // Extract unsubscribe information from email content
                                const unsubscribeInfo = await AIService_1.AIService.extractUnsubscribeInfo(email.html_body);
                                if (unsubscribeInfo.url) {
                                    // Use AI agent to automate unsubscribe process
                                    const automationResult = await WebAutomationService_1.WebAutomationService.executeUnsubscribe(unsubscribeInfo.url, email.html_body || email.body || '');
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
                                }
                                else {
                                    unsubscribeResults.push({
                                        emailId,
                                        subject: email.subject,
                                        success: false,
                                        message: 'No unsubscribe link found in email'
                                    });
                                }
                            }
                        }
                        catch (error) {
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
        }
        catch (error) {
            console.error('Error performing bulk action:', error);
            res.status(500).json({ error: 'Failed to perform bulk action' });
        }
    }
    static async deleteEmail(req, res) {
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
            const email = await Email_1.EmailModel.findById(emailId);
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
            const userProfile = await User_1.UserModel.findById(user.id);
            if (userProfile?.access_token && email.gmail_id) {
                try {
                    await GmailService_1.GmailService.deleteMessage(userProfile.access_token, email.gmail_id);
                }
                catch (gmailError) {
                    console.warn('Failed to delete from Gmail:', gmailError);
                }
            }
            // Delete from database
            await Email_1.EmailModel.delete(emailId);
            res.json({ message: 'Email deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting email:', error);
            res.status(500).json({ error: 'Failed to delete email' });
        }
    }
    static async cleanExistingEmails(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            // Get all emails for this user
            const emails = await Email_1.EmailModel.findByUserId(user.id, 1000, 0);
            let processedCount = 0;
            for (const email of emails) {
                try {
                    // Get full email data
                    const fullEmail = await Email_1.EmailModel.findById(email.id);
                    if (fullEmail && fullEmail.html_body) {
                        // Clean the HTML content
                        const cleanedHtml = GmailService_1.GmailService.cleanHtmlContent(fullEmail.html_body);
                        // Update the email with cleaned content
                        await database_1.default.query('UPDATE emails SET html_body = $1 WHERE id = $2', [cleanedHtml, email.id]);
                        processedCount++;
                    }
                }
                catch (error) {
                    console.error(`Error processing email ${email.id}:`, error);
                }
            }
            res.json({
                message: `Successfully cleaned ${processedCount} emails`,
                processed: processedCount
            });
        }
        catch (error) {
            console.error('Error cleaning existing emails:', error);
            res.status(500).json({ error: 'Failed to clean existing emails' });
        }
    }
    static async testGmailConnection(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const userProfile = await User_1.UserModel.findById(user.id);
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
                    const gmailMessages = await GmailService_1.GmailService.listMessages(userProfile.access_token, testQuery.query, 20 // Get 20 emails for testing
                    );
                    results.push({
                        query: testQuery.name,
                        queryString: testQuery.query,
                        found: gmailMessages.length,
                        sampleSubjects: gmailMessages.slice(0, 3).map(msg => {
                            const content = GmailService_1.GmailService.extractEmailContent(msg);
                            return content.subject || 'No subject';
                        })
                    });
                }
                catch (error) {
                    results.push({
                        query: testQuery.name,
                        queryString: testQuery.query,
                        found: 0,
                        error: error.message
                    });
                }
            }
            res.json({
                message: 'Gmail connection test completed',
                results,
                userEmail: userProfile.email
            });
        }
        catch (error) {
            console.error('Error testing Gmail connection:', error);
            res.status(500).json({ error: 'Failed to test Gmail connection' });
        }
    }
    static async clearAllEmails(req, res) {
        try {
            const { user } = req;
            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            // Delete all emails for this user
            const result = await database_1.default.query('DELETE FROM emails WHERE user_id = $1 RETURNING id', [user.id]);
            const deletedCount = result.rowCount || 0;
            res.json({
                message: `Successfully cleared ${deletedCount} emails`,
                deleted: deletedCount
            });
        }
        catch (error) {
            console.error('Error clearing emails:', error);
            res.status(500).json({ error: 'Failed to clear emails' });
        }
    }
}
exports.EmailController = EmailController;
//# sourceMappingURL=emailController.js.map