import pool from './src/config/database.ts';

async function fixExistingEmails() {
  try {
    console.log('Fixing existing emails in database...\n');
    
    // Get all emails that have HTML content
    const result = await pool.query(`
      SELECT id, subject, html_body, clean_text 
      FROM emails 
      WHERE html_body IS NOT NULL AND html_body != ''
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} emails to fix`);
    
    let fixedCount = 0;
    
    for (const email of result.rows) {
      try {
        console.log(`\nProcessing email ${email.id}: ${email.subject}`);
        
        // Check if this email already has clean_text
        if (email.clean_text && email.clean_text.length > 10) {
          console.log('  ✅ Already has clean_text, skipping');
          continue;
        }
        
        // If html_body contains raw HTML (starts with <), clean it
        if (email.html_body && email.html_body.trim().startsWith('<')) {
          console.log('  🔧 Cleaning raw HTML...');
          
          // Use the same cleaning function as the service
          const cleanText = cleanHtmlContent(email.html_body);
          
          if (cleanText && cleanText.length > 10) {
            // Update the email with clean text
            await pool.query(`
              UPDATE emails 
              SET clean_text = $1 
              WHERE id = $2
            `, [cleanText, email.id]);
            
            console.log(`  ✅ Updated with clean text (${cleanText.length} chars)`);
            console.log(`  Preview: ${cleanText.substring(0, 100)}...`);
            fixedCount++;
          } else {
            console.log('  ⚠️  Cleaned text too short, skipping');
          }
        } else {
          console.log('  ⚠️  html_body doesn\'t look like raw HTML, skipping');
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing email ${email.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} emails out of ${result.rows.length} total`);
    
  } catch (error) {
    console.error('Error fixing emails:', error);
  } finally {
    await pool.end();
  }
}

function cleanHtmlContent(htmlContent) {
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

    return textContent;
  } catch (error) {
    console.error('Error cleaning HTML content:', error);
    return htmlContent.replace(/<[^>]*>/g, ' ').trim();
  }
}

fixExistingEmails(); 