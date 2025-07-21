import puppeteer, { Browser, Page } from 'puppeteer';

export class WebAutomationService {
  private static browser: Browser | null = null;

  static async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  static async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  static async executeUnsubscribe(url: string, emailContent: string): Promise<{
    success: boolean;
    message: string;
    steps: string[];
    screenshots?: string[];
  }> {
    let page: Page | null = null;
    const steps: string[] = [];
    const screenshots: string[] = [];

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      steps.push(`Navigating to unsubscribe URL: ${url}`);

      // Navigate to the unsubscribe page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Take screenshot of initial page
      const screenshot1 = await page.screenshot({ encoding: 'base64' });
      screenshots.push(screenshot1);
      steps.push('Loaded unsubscribe page');

      // Analyze the page content to understand what needs to be done
      const pageContent = await page.content();
      const pageText = await page.evaluate(() => document.body.innerText);

      // Use AI to determine what actions to take
      const actions = await this.analyzePageForUnsubscribeActions(page, pageContent, pageText, emailContent);
      
      steps.push(`AI identified ${actions.length} actions to perform`);

      // Execute each action
      for (const action of actions) {
        try {
          await this.executeAction(page, action);
          steps.push(`✅ ${action.description}`);
        } catch (error) {
          steps.push(`❌ Failed to ${action.description}: ${error}`);
        }
      }

      // Wait a moment for any final processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take final screenshot
      const screenshot2 = await page.screenshot({ encoding: 'base64' });
      screenshots.push(screenshot2);

      // Check if unsubscribe was successful
      const finalContent = await page.content();
      const success = await this.checkUnsubscribeSuccess(finalContent);

      return {
        success,
        message: success ? 'Unsubscribe completed successfully' : 'Unsubscribe may not have completed successfully',
        steps,
        screenshots
      };

    } catch (error) {
      steps.push(`❌ Error during automation: ${error}`);
      return {
        success: false,
        message: `Automation failed: ${error}`,
        steps
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // Stub for headless browser unsubscribe agent
  static async unsubscribeFromLink(url: string): Promise<{ success: boolean; message: string }> {
    // TODO: Implement with Puppeteer or Playwright
    // Example steps:
    // 1. Launch browser
    // 2. Go to URL
    // 3. Find and click unsubscribe button or fill form
    // 4. Handle confirmation
    // 5. Close browser
    return { success: false, message: 'Headless unsubscribe not implemented (stub)' };
  }

  private static async analyzePageForUnsubscribeActions(
    page: Page,
    pageContent: string, 
    pageText: string, 
    emailContent: string
  ): Promise<Array<{
    type: 'click' | 'fill' | 'select' | 'wait';
    selector?: string;
    value?: string;
    description: string;
  }>> {
    const actions: Array<{
      type: 'click' | 'fill' | 'select' | 'wait';
      selector?: string;
      value?: string;
      description: string;
    }> = [];

    // Look for common unsubscribe patterns
    const unsubscribeSelectors = [
      'a[href*="unsubscribe"]',
      'button[onclick*="unsubscribe"]',
      'input[value*="unsubscribe"]',
      '.unsubscribe',
      '#unsubscribe',
      '[data-action="unsubscribe"]'
    ];

    for (const selector of unsubscribeSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          actions.push({
            type: 'click',
            selector,
            description: `Click unsubscribe button/link`
          });
        }
      } catch (error) {
        // Selector not found, continue
      }
    }

    // Look for email input fields
    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[placeholder*="email"]'
    ];

    for (const selector of emailSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          // Extract email from email content
          const emailMatch = emailContent.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            actions.push({
              type: 'fill',
              selector,
              value: emailMatch[0],
              description: `Fill email address: ${emailMatch[0]}`
            });
          }
        }
      } catch (error) {
        // Selector not found, continue
      }
    }

    // Look for confirmation buttons
    const confirmSelectors = [
      'input[type="submit"]',
      'button[type="submit"]',
      'button:contains("Submit")',
      'button:contains("Confirm")'
    ];

    for (const selector of confirmSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          actions.push({
            type: 'click',
            selector,
            description: `Click confirm/submit button`
          });
        }
      } catch (error) {
        // Selector not found, continue
      }
    }

    return actions;
  }

  private static async executeAction(
    page: Page, 
    action: {
      type: 'click' | 'fill' | 'select' | 'wait';
      selector?: string;
      value?: string;
      description: string;
    }
  ): Promise<void> {
    switch (action.type) {
      case 'click':
        if (action.selector) {
          await page.click(action.selector);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        break;
      
      case 'fill':
        if (action.selector && action.value) {
          await page.type(action.selector, action.value);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        break;
      
      case 'select':
        if (action.selector && action.value) {
          await page.select(action.selector, action.value);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        break;
      
      case 'wait':
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
    }
  }

  private static async checkUnsubscribeSuccess(pageContent: string): Promise<boolean> {
    // Look for success indicators
    const successIndicators = [
      'unsubscribed',
      'successfully',
      'confirmed',
      'removed',
      'cancelled',
      'thank you'
    ];

    const lowerContent = pageContent.toLowerCase();
    return successIndicators.some(indicator => lowerContent.includes(indicator));
  }
} 