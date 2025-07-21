import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';
import { Email, Category } from '../types';
import '../styles/EmailDetail.css';
import DOMPurify from 'dompurify';

const EmailDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState<Email | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadEmail(parseInt(id));
    }
  }, [id]);

  const loadEmail = async (emailId: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiService.getEmail(emailId);
      
      // Debug logging
      console.log('=== Frontend Email Debug ===');
      console.log('Email ID:', result.email.id);
      console.log('Subject:', result.email.subject);
      console.log('Body length:', result.email.body?.length || 0);
      console.log('HTML body length:', result.email.html_body?.length || 0);
      console.log('Clean text length:', result.email.clean_text?.length || 0);
      console.log('Clean text preview:', result.email.clean_text?.substring(0, 100));
      console.log('HTML body preview:', result.email.html_body?.substring(0, 100));
      console.log('Category:', result.category);
      console.log('===========================');
      
      setEmail(result.email);
      setCategory(result.category || null);
      
      // Automatically mark as read if it's unread
      if (!result.email.is_read) {
        try {
          await apiService.markAsRead(emailId);
          setEmail(prev => prev ? { ...prev, is_read: true } : null);
        } catch (error) {
          console.warn('Failed to auto-mark email as read:', error);
        }
      }
    } catch (error) {
      setError('Failed to load email');
      console.error('Error loading email:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!email) return;
    
    try {
      if (email.is_read) {
        // Mark as unread
        await apiService.markAsUnread(email.id);
        setEmail(prev => prev ? { ...prev, is_read: false } : null);
      } else {
        // Mark as read
        await apiService.markAsRead(email.id);
        setEmail(prev => prev ? { ...prev, is_read: true } : null);
      }
    } catch (error) {
      setError('Failed to update email status');
      console.error('Error updating email status:', error);
    }
  };

  const handleDelete = async () => {
    if (!email) return;
    
    if (window.confirm('Are you sure you want to delete this email?')) {
      try {
        await apiService.deleteEmail(email.id);
        navigate('/');
      } catch (error) {
        setError('Failed to delete email');
        console.error('Error deleting email:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Utility to convert URLs in text to clickable links
  function linkify(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      ) : (
        part
      )
    );
  }

  // Function to safely render email content
  const renderEmailContent = (htmlBody: string, plainBody: string, cleanText: string) => {
    console.log('=== renderEmailContent Debug ===');
    console.log('cleanText length:', cleanText?.length || 0);
    console.log('cleanText preview:', cleanText?.substring(0, 100));
    console.log('plainBody length:', plainBody?.length || 0);
    console.log('htmlBody length:', htmlBody?.length || 0);

    // Prefer rendering HTML if available
    if (htmlBody && htmlBody.trim().length > 0) {
      const sanitizedHtml = DOMPurify.sanitize(htmlBody);
      return (
        <div className="email-detail-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      );
    }
    // If htmlBody is empty, but plainBody looks like HTML, render it as HTML
    if (plainBody && plainBody.trim().startsWith('<')) {
      const sanitizedHtml = DOMPurify.sanitize(plainBody);
      return (
        <div className="email-detail-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      );
    }
    // Fallback to cleanText as plain text
    if (cleanText && cleanText.trim().length > 10) {
      return (
        <div className="email-detail-content" style={{ whiteSpace: 'pre-line' }}>
          {cleanText}
        </div>
      );
    }
    // Fallback to plainBody as plain text
    if (plainBody && plainBody.trim().length > 10) {
      return (
        <div className="email-detail-content" style={{ whiteSpace: 'pre-line' }}>
          {plainBody}
        </div>
      );
    }
    // Fallback
    return (
      <div className="email-detail-no-content">
        No content available
      </div>
    );
  };  

  if (loading) {
    return (
      <div className="email-detail-loading-container">
        <div className="email-detail-loading-content">
          <div className="email-detail-spinner"></div>
          <p className="email-detail-loading-text">Loading email...</p>
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="email-detail-error-container">
        <div className="email-detail-error-content">
          <h2 className="email-detail-error-title">
            Error
          </h2>
          <p className="email-detail-error-text">
            {error || 'Email not found'}
          </p>
          <Link
            to="/"
            className="email-detail-back-to-dashboard"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="email-detail-container">
      {/* Modern Header */}
      <header className="email-detail-header">
        <div className="email-detail-header-content">
          <div className="email-detail-header-flex">
            {/* Back Button */}
            <div>
              <Link
                to={category ? `/category/${category.id}` : '/'}
                className="email-detail-back-button"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
            </div>

            {/* Centered Email Subject */}
            <div className="email-detail-subject-container">
              <h1 className="email-detail-subject">
                {email.subject || 'No Subject'}
              </h1>
            </div>

            {/* User Section */}
            <div className="email-detail-user-section">
              <div className="email-detail-user-info">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="email-detail-user-avatar"
                  />
                ) : (
                  <div className="email-detail-user-avatar-placeholder">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="email-detail-user-name">{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="email-detail-logout-button"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="email-detail-main">
        {error && (
          <div className="email-detail-error-message">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Email Card */}
        <div className="email-detail-card">
          {/* Email Header */}
          <div className="email-detail-header-section">
            <div className="email-detail-header-content">
              <div className="email-detail-info">
                <h2 className="email-detail-title">
                  {email.subject || 'No Subject'}
                </h2>
                
                <div className="email-detail-details">
                  <div className="email-detail-row">
                    <span className="email-detail-label">From:</span>
                    <span className="email-detail-value">{email.sender}</span>
                  </div>
                  
                  {email.recipients && email.recipients.length > 0 && (
                    <div className="email-detail-row">
                      <span className="email-detail-label">To:</span>
                      <span className="email-detail-value">{email.recipients.join(', ')}</span>
                    </div>
                  )}
                  
                  <div className="email-detail-row">
                    <span className="email-detail-label">Date:</span>
                    <span className="email-detail-value">
                      {email.received_at ? formatDate(email.received_at) : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="email-detail-badges">
                {category && (
                  <span 
                    className="email-detail-category-badge"
                    style={{
                      backgroundColor: `${category.color}20`,
                      color: category.color
                    }}
                  >
                    {category.name}
                  </span>
                )}
                
                <span className={`email-detail-read-status-badge ${email.is_read ? 'email-detail-read-status-read' : 'email-detail-read-status-unread'}`}>
                  {email.is_read ? 'Read' : 'Unread'}
                </span>
              </div>
            </div>
          </div>

          {/* Email Actions */}
          <div className="email-detail-actions">
            {/* Action Buttons */}
            <div className="email-detail-action-buttons">
              <button
                onClick={handleMarkAsRead}
                className={`email-detail-mark-read-button ${email.is_read ? 'read' : ''}`}
              >
                {email.is_read ? 'Mark as Unread' : 'Mark as Read'}
              </button>
              
              <button
                onClick={handleDelete}
                className="email-detail-delete-button"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Email Summary */}
          {email.summary && (
            <div className="email-detail-summary">
              <h4 className="email-detail-summary-title">
                AI Summary
              </h4>
              <p className="email-detail-summary-text">
                {email.summary}
              </p>
            </div>
          )}

          {/* Email Body */}
          <div className="email-detail-body">
            <h4 className="email-detail-body-title">
              Email Content
            </h4>
            <div className="email-detail-body-content">
              {renderEmailContent(email.html_body || '', email.body || '', email.clean_text || '')}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmailDetailPage; 