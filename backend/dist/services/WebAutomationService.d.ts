import { Browser } from 'puppeteer';
export declare class WebAutomationService {
    private static browser;
    static getBrowser(): Promise<Browser>;
    static closeBrowser(): Promise<void>;
    static executeUnsubscribe(url: string, emailContent: string): Promise<{
        success: boolean;
        message: string;
        steps: string[];
        screenshots?: string[];
    }>;
    private static analyzePageForUnsubscribeActions;
    private static executeAction;
    private static checkUnsubscribeSuccess;
}
//# sourceMappingURL=WebAutomationService.d.ts.map