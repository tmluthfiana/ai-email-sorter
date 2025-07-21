import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';
import { Email, Category } from '../types';
import '../styles/CategoryPage.css';

const CategoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadCategoryAndEmails(parseInt(id));
    }
  }, [id]);

  const loadCategoryAndEmails = async (categoryId: number) => {
    try {
      setLoading(true);
      setError(null);
      
      // Load category first
      const categoryData = await apiService.getCategory(categoryId);
      setCategory(categoryData);
      
      // Then load emails (this might return empty array, which is fine)
      try {
        const emailsData = await apiService.getEmailsByCategory(categoryId);
        setEmails(emailsData);
      } catch (emailErr) {
        console.warn('Failed to load emails for category:', emailErr);
        // If emails fail to load, just set empty array instead of showing error
        setEmails([]);
      }
    } catch (err) {
      setError('Failed to load category');
      console.error('Error loading category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSelection = (emailId: number, checked: boolean) => {
    const newSelected = new Set(selectedEmails);
    if (checked) {
      newSelected.add(emailId);
    } else {
      newSelected.delete(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmails(new Set(emails.map(email => email.id)));
    } else {
      setSelectedEmails(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmails.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedEmails.size} email(s)?`)) {
      return;
    }

    try {
      setBulkActionLoading(true);
      const emailIds = Array.from(selectedEmails);
      
      // Delete emails from our database
      await Promise.all(emailIds.map(id => apiService.deleteEmail(id)));
      
      // Remove deleted emails from state
      setEmails(emails.filter(email => !selectedEmails.has(email.id)));
      setSelectedEmails(new Set());
      
    } catch (err) {
      setError('Failed to delete emails');
      console.error('Error deleting emails:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (selectedEmails.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to unsubscribe from ${selectedEmails.size} email(s)? This will attempt to find and click unsubscribe links automatically.`)) {
      return;
    }

    try {
      setBulkActionLoading(true);
      const emailIds = Array.from(selectedEmails);
      
      // Call bulk unsubscribe endpoint
      await apiService.bulkUnsubscribe(emailIds);
      
      // Remove unsubscribed emails from state
      setEmails(emails.filter(email => !selectedEmails.has(email.id)));
      setSelectedEmails(new Set());
      
    } catch (err) {
      setError('Failed to unsubscribe from emails');
      console.error('Error unsubscribing from emails:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="category-loading-container">
        <div className="category-loading-content">
          <div className="category-spinner"></div>
          <p className="category-loading-text">Loading category...</p>
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="category-error-container">
        <div className="category-error-content">
          <h2 className="category-error-title">Error</h2>
          <p className="category-error-text">{error || 'Category not found'}</p>
          <Link to="/" className="category-back-to-dashboard">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="category-container">
      {/* Header */}
      <header className="category-header">
        <div className="category-header-content">
          <div className="category-header-flex">
            {/* Back Button */}
            <div>
              <Link to="/" className="category-back-button">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </div>

            {/* Category Info */}
            <div className="category-info-container">
              <h1 className="category-title">{category.name}</h1>
              <p className="category-description">{category.description}</p>
              <div className="category-stats">
                <span className="category-email-count">{emails.length} emails</span>
                {selectedEmails.size > 0 && (
                  <span className="category-selected-count">{selectedEmails.size} selected</span>
                )}
              </div>
            </div>

            {/* User Section */}
            <div className="category-user-section">
              <div className="category-user-info">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="category-user-avatar"
                  />
                ) : (
                  <div className="category-user-avatar-placeholder">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="category-user-name">{user?.name}</span>
              </div>
              <button onClick={logout} className="category-logout-button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="category-main">
        {error && (
          <div className="category-error-message">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Bulk Actions */}
        {selectedEmails.size > 0 && (
          <div className="category-bulk-actions">
            <div className="category-bulk-actions-content">
              <span className="category-bulk-actions-text">
                {selectedEmails.size} email(s) selected
              </span>
              <div className="category-bulk-actions-buttons">
                <button
                  onClick={handleBulkUnsubscribe}
                  disabled={bulkActionLoading}
                  className="category-bulk-unsubscribe-button"
                >
                  {bulkActionLoading ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="category-bulk-delete-button"
                >
                  {bulkActionLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emails List */}
        <div className="category-emails-container">
          {emails.length === 0 ? (
            <div className="category-no-emails">
              <div className="category-no-emails-content">
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h3 className="category-no-emails-title">No emails in this category</h3>
                <p className="category-no-emails-text">
                  Emails will appear here once they're imported and categorized.
                </p>
              </div>
            </div>
          ) : (
            <div className="category-emails-list">
              {/* Select All Header */}
              <div className="category-emails-header">
                <div className="category-select-all">
                  <input
                    type="checkbox"
                    checked={selectedEmails.size === emails.length && emails.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="category-checkbox"
                  />
                  <span className="category-select-all-text">Select All</span>
                </div>
              </div>

              {/* Email Items */}
              {emails.map((email) => (
                <div key={email.id} className="category-email-item">
                  <div className="category-email-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(email.id)}
                      onChange={(e) => handleEmailSelection(email.id, e.target.checked)}
                      className="category-checkbox"
                    />
                  </div>
                  
                  <div className="category-email-content">
                    <div className="category-email-header">
                      <h3 className="category-email-subject">
                        <Link to={`/email/${email.id}`} className="category-email-link">
                          {email.subject || 'No Subject'}
                        </Link>
                      </h3>
                                             <span className="category-email-date">
                         {email.received_at ? formatDate(email.received_at) : 'Unknown'}
                       </span>
                    </div>
                    
                    <div className="category-email-sender">
                      From: {email.sender}
                    </div>
                    
                    {email.summary && (
                      <div className="category-email-summary">
                        <p className="category-email-summary-text">{email.summary}</p>
                      </div>
                    )}
                    
                    <div className="category-email-status">
                      <span className={`category-email-read-status ${email.is_read ? 'read' : 'unread'}`}>
                        {email.is_read ? 'Read' : 'Unread'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CategoryPage; 