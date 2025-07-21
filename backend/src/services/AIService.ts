import OpenAI from 'openai';
import { Category, AIAnalysisResult } from '../models/types';

// Initialize OpenAI client with environment variable only
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



export class AIService {
  static async categorizeEmail(emailContent: string, categories: any[]): Promise<{ category_id: number | null; confidence: number; summary: string }> {
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
    } catch (error: any) {
      console.error('OpenAI categorization failed:', error);
      
      // If it's a quota error, use a simple fallback instead of failing completely
      if (error.code === 'insufficient_quota' || error.status === 429) {
        return this.simpleFallbackCategorization(emailContent, categories);
      }
      
      throw error; // Re-throw other errors
    }
  }

  private static simpleFallbackCategorization(emailContent: string, categories: any[]): { category_id: number | null; confidence: number; summary: string } {
    const content = emailContent.toLowerCase();
    
    // Simple keyword matching for the "Promotion" category
    const promotionKeywords = [
      'promotion', 'promotional', 'sale', 'discount', 'offer', 'deal', 'special',
      'limited time', 'buy now', 'shop', 'store', 'product', 'service',
      'newsletter', 'marketing', 'campaign', 'advertisement', 'sponsored'
    ];
    
    for (const category of categories) {
      if (category.name.toLowerCase() === 'promotion') {
        const matches = promotionKeywords.filter(keyword => content.includes(keyword));
        if (matches.length > 0) {
          return {
            category_id: category.id,
            confidence: Math.min(0.7, matches.length * 0.1),
            summary: `Email appears to be promotional content (${matches[0]})`
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

  static async summarizeEmail(emailContent: string): Promise<string> {
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
    } catch (error) {
      console.error('Error summarizing email:', error);
      return 'Failed to generate summary - please try again later';
    }
  }

  static async extractUnsubscribeInfo(emailContent: string): Promise<{ url?: string; email?: string; found: boolean }> {
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
    } catch (error) {
      console.error('Error extracting unsubscribe info:', error);
      return { found: false };
    }
  }

  static async automateUnsubscribe(url: string): Promise<{ success: boolean; message: string; steps: string[]; screenshots?: string[] }> {
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
    } catch (error) {
      console.error('Error automating unsubscribe:', error);
      return {
        success: false,
        message: 'Failed to generate automation instructions',
        steps: []
      };
    }
  }

  static async processUnsubscribeForm(
    formHtml: string,
    formData: Record<string, any>
  ): Promise<{
    action: string;
    method: string;
    fields: Record<string, any>;
  }> {
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
    } catch (error) {
      console.error('Error processing unsubscribe form:', error);
      throw new Error('Unable to process unsubscribe form');
    }
  }
} 
