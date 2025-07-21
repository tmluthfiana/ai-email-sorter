"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const openai_1 = __importDefault(require("openai"));
// Initialize OpenAI client with fallback for missing API key
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-development',
});
// Helper function to check if OpenAI is properly configured
const isOpenAIConfigured = () => {
    return process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here' && process.env.OPENAI_API_KEY !== 'dummy-key-for-development';
};
class AIService {
    static async categorizeEmail(emailContent, categories) {
        console.log(`AIService.categorizeEmail called with ${categories.length} categories`);
        console.log(`OpenAI configured: ${isOpenAIConfigured()}`);
        // Try OpenAI first
        if (isOpenAIConfigured()) {
            try {
                const categoryDescriptions = categories.map(cat => `${cat.name}: ${cat.description}`).join('\n');
                const prompt = `You are an AI email categorizer. Analyze the following email content and categorize it into one of the available categories.

Available categories:
${categoryDescriptions}

Email content:
${emailContent}

Please respond with a JSON object in this exact format:
{
  "category_id": <number or null>,
  "confidence": <number between 0 and 1>,
  "summary": "<brief summary of the email content>"
}

If the email doesn't fit any category well, set category_id to null and confidence to 0.`;
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful AI assistant that categorizes emails and provides meaningful summaries. Always respond with valid JSON. Provide specific, informative summaries that help users understand the email content.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500,
                });
                const response = completion.choices[0]?.message?.content;
                console.log(`OpenAI response:`, response);
                if (!response) {
                    throw new Error('No response from OpenAI');
                }
                const result = JSON.parse(response);
                console.log(`Parsed result:`, result);
                return {
                    category_id: result.category_id,
                    confidence: result.confidence || 0,
                    summary: result.summary || 'No summary available'
                };
            }
            catch (error) {
                console.error('OpenAI categorization failed, using fallback:', error);
                // Fall through to rule-based categorization
            }
        }
        // Fallback rule-based categorization
        console.log('Using fallback rule-based categorization');
        return this.fallbackCategorization(emailContent, categories);
    }
    static fallbackCategorization(emailContent, categories) {
        const content = emailContent.toLowerCase();
        // Newsletter category rules
        const newsletterKeywords = [
            'newsletter', 'subscribe', 'subscription', 'unsubscribe', 'promotional',
            'marketing', 'campaign', 'special offer', 'deal', 'discount', 'sale',
            'weekly', 'monthly', 'daily digest', 'updates', 'news', 'announcement'
        ];
        for (const category of categories) {
            if (category.name.toLowerCase() === 'newsletter') {
                const matches = newsletterKeywords.filter(keyword => content.includes(keyword));
                if (matches.length > 0) {
                    return {
                        category_id: category.id,
                        confidence: Math.min(0.8, matches.length * 0.2),
                        summary: `Email appears to be a ${matches[0]} email`
                    };
                }
            }
        }
        return {
            category_id: null,
            confidence: 0,
            summary: 'Email content analyzed but no clear category match found'
        };
    }
    static async summarizeEmail(emailContent) {
        if (!isOpenAIConfigured()) {
            return 'AI summarization not available - please configure OpenAI API key';
        }
        try {
            const prompt = `Please provide a concise summary of the following email content in 1-2 sentences:

${emailContent}

Summary:`;
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant that summarizes emails concisely.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 100,
            });
            const summary = completion.choices[0]?.message?.content?.trim();
            return summary || 'No summary available';
        }
        catch (error) {
            console.error('Error summarizing email:', error);
            return 'Failed to generate summary - please try again later';
        }
    }
    static async extractUnsubscribeInfo(emailContent) {
        if (!isOpenAIConfigured()) {
            return { found: false };
        }
        try {
            // First try regex patterns
            const unsubscribePatterns = [
                /unsubscribe\s*:\s*(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi,
                /unsubscribe\s*at\s*(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi,
                /click\s*here\s*to\s*unsubscribe[^>]*href\s*=\s*["']([^"']+)["']/gi,
                /<a[^>]*unsubscribe[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi,
                /unsubscribe\s*link[^>]*href\s*=\s*["']([^"']+)["']/gi,
                /opt.?out[^>]*href\s*=\s*["']([^"']+)["']/gi,
                /remove\s*me[^>]*href\s*=\s*["']([^"']+)["']/gi,
                /cancel\s*subscription[^>]*href\s*=\s*["']([^"']+)["']/gi
            ];
            for (const pattern of unsubscribePatterns) {
                const match = pattern.exec(emailContent);
                if (match) {
                    const url = match[1] || match[0];
                    if (url && url.startsWith('http')) {
                        return { url, found: true };
                    }
                }
            }
            // Check for unsubscribe emails
            const emailPatterns = [
                /unsubscribe\s*@\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
                /remove\s*@\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
                /optout\s*@\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
            ];
            for (const pattern of emailPatterns) {
                const match = pattern.exec(emailContent);
                if (match) {
                    const email = match[1];
                    return { email: `unsubscribe@${email}`, found: true };
                }
            }
            // Fallback to AI extraction
            const prompt = `Extract unsubscribe information from this email. Look for:
1. Unsubscribe URLs
2. Unsubscribe email addresses
3. Any other unsubscribe mechanisms

Email content:
${emailContent}

Respond with JSON only:
{
  "url": "unsubscribe_url_if_found",
  "email": "unsubscribe_email_if_found", 
  "found": true/false
}`;
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert at extracting unsubscribe information from emails. Return only valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 500
            });
            const result = JSON.parse(response.choices[0]?.message?.content || '{}');
            return {
                url: result.url,
                email: result.email,
                found: result.found || false
            };
        }
        catch (error) {
            console.error('Error extracting unsubscribe info:', error);
            return { found: false };
        }
    }
    static async automateUnsubscribe(url) {
        if (!isOpenAIConfigured()) {
            return {
                success: false,
                message: 'AI automation not available - please configure OpenAI API key',
                steps: []
            };
        }
        try {
            const prompt = `Analyze this unsubscribe URL and provide step-by-step instructions for automating the unsubscribe process:

URL: ${url}

Provide instructions for:
1. Navigating to the page
2. Finding unsubscribe buttons/links
3. Filling out forms if needed
4. Confirming the unsubscribe action

Respond with JSON only:
{
  "success": true/false,
  "message": "description of what to do",
  "steps": ["step1", "step2", "step3"]
}`;
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI agent that can automate unsubscribe processes. Provide clear, actionable steps."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 1000
            });
            const result = JSON.parse(response.choices[0]?.message?.content || '{}');
            return {
                success: result.success || false,
                message: result.message || 'No automation instructions available',
                steps: result.steps || []
            };
        }
        catch (error) {
            console.error('Error automating unsubscribe:', error);
            return {
                success: false,
                message: 'Failed to generate automation instructions',
                steps: []
            };
        }
    }
    static async processUnsubscribeForm(formHtml, formData) {
        const prompt = `
Analyze this HTML form and determine how to fill it out to unsubscribe. The form data should include:
${JSON.stringify(formData, null, 2)}

Form HTML:
${formHtml}

Please respond with a JSON object containing:
- action: The form action URL
- method: The HTTP method (GET, POST, etc.)
- fields: The field names and values to submit

Focus on fields that might be related to unsubscribing, email addresses, or confirmation.
`;
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant that analyzes HTML forms for unsubscribe functionality. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 500,
            });
            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from OpenAI');
            }
            return JSON.parse(response);
        }
        catch (error) {
            console.error('Error processing unsubscribe form:', error);
            throw new Error('Unable to process unsubscribe form');
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=AIService.js.map