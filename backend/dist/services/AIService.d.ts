export declare class AIService {
    static categorizeEmail(emailContent: string, categories: any[]): Promise<{
        category_id: number | null;
        confidence: number;
        summary: string;
    }>;
    private static fallbackCategorization;
    static summarizeEmail(emailContent: string): Promise<string>;
    static extractUnsubscribeInfo(emailContent: string): Promise<{
        url?: string;
        email?: string;
        found: boolean;
    }>;
    static automateUnsubscribe(url: string): Promise<{
        success: boolean;
        message: string;
        steps: string[];
        screenshots?: string[];
    }>;
    static processUnsubscribeForm(formHtml: string, formData: Record<string, any>): Promise<{
        action: string;
        method: string;
        fields: Record<string, any>;
    }>;
}
//# sourceMappingURL=AIService.d.ts.map