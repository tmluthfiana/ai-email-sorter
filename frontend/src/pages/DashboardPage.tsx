import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';
import { Category, CategoryStats } from '../types';
import AddCategoryModal from '../components/AddCategoryModal';
import '../styles/Dashboard.css';
import { FaEnvelope, FaPlus, FaTrash, FaUserCircle } from 'react-icons/fa';

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accounts, setAccounts] = useState<{ email: string; primary: boolean }[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategoryStats();
      setCategories(response.stats);
    } catch (error) {
      setError('Failed to load categories');
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setAccountsLoading(true);
    apiService.listLinkedAccounts()
      .then((res) => setAccounts(res.accounts))
      .finally(() => setAccountsLoading(false));
  }, []);

  const handleSyncEmails = async () => {
    try {
      setError(null);
      setSyncing(true);
      
      const result = await apiService.syncEmails();
      
      alert(`Successfully processed ${result.processed} emails! ${result.errors > 0 ? `(${result.errors} errors)` : ''}`);
      
      // Reload categories to update email counts
      await loadCategories();
    } catch (error) {
      setError('Failed to sync emails');
      console.error('Error syncing emails:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAllEmails = async () => {
    if (!window.confirm('Are you sure you want to delete ALL emails? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      const result = await apiService.clearAllEmails();
      alert(`Successfully cleared ${result.deleted} emails!`);
      // Reload categories to update email counts
      await loadCategories();
    } catch (error) {
      setError('Failed to clear all emails');
      console.error('Error clearing emails:', error);
    }
  };

  const handleAddCategory = async (categoryData: { name: string; description: string; color?: string }) => {
    try {
      await apiService.createCategory(categoryData);
      setShowAddModal(false);
      await loadCategories();
    } catch (error) {
      setError('Failed to create category');
      console.error('Error creating category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!window.confirm('Are you sure you want to delete this category? This will also delete all emails in this category.')) {
      return;
    }

    try {
      await apiService.deleteCategory(categoryId);
      await loadCategories();
    } catch (error) {
      setError('Failed to delete category');
      console.error('Error deleting category:', error);
    }
  };

  const handleLinkAccount = async () => {
    await apiService.linkGmailAccount();
    alert('Link Gmail account flow not implemented (stub)');
  };

  const handleRemoveAccount = async (email: string) => {
    await apiService.removeGmailAccount(email);
    alert('Remove Gmail account flow not implemented (stub)');
  };

  const handleViewCategory = (categoryId: number) => {
    // Redirect to the category detail page
    window.location.href = `/category/${categoryId}`;
  };

  const handleClearAllUserData = async () => {
    if (window.confirm('Are you sure you want to delete ALL your emails, categories, and your account? This cannot be undone.')) {
      await apiService.clearAllUserData();
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
          <div className="text-center">
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--gray-600)', fontSize: 'var(--font-size-base)', margin: 0 }}>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding: '0 16px'}}>
      {/* Header */}
      <header className="dashboard-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="dashboard-title" style={{ fontSize: 32, fontWeight: 700 }}>AI Email Sorter</h1>
        <div className="dashboard-actions" style={{ display: 'flex', gap: 16 }}>
          <button 
            className="dashboard-btn" 
            onClick={handleSyncEmails}
            disabled={syncing}
            style={{
              opacity: syncing ? 0.7 : 1,
              cursor: syncing ? 'not-allowed' : 'pointer',
              position: 'relative'
            }}
          >
            {syncing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Syncing...
              </div>
            ) : (
              'Sync Emails'
            )}
          </button>
          <button className="dashboard-btn" onClick={handleClearAllEmails}>Clear All Emails</button>
          <button className="dashboard-btn" style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }} onClick={handleClearAllUserData}>
            Delete All My Data
          </button>
          <div className="dashboard-user" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dashboard-user-name">{user?.name || 'User'}</span>
            <button className="dashboard-btn" style={{ background: '#a78bfa', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }} onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      {/* Connected Gmail Accounts */}
      <div className="dashboard-accounts-section" style={{ marginBottom: 40, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Connected Gmail Accounts</h2>
          <button
            style={{
              padding: '12px 28px',
              borderRadius: '8px',
              background: '#10B981',
              color: 'white',
              fontWeight: 600,
              border: 'none',
              fontSize: '17px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16,185,129,0.08)',
              transition: 'background 0.2s',
            }}
            onClick={handleLinkAccount}
          >
            + Connect another Gmail account
          </button>
        </div>
        {accountsLoading ? (
          <div>Loading accounts...</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 12 }}>
            {accounts.map((acc) => (
              <li key={acc.email} style={{ marginBottom: 4 }}>
                <span>{acc.email} {acc.primary && <b>(Primary)</b>}</span>
                {!acc.primary && (
                  <button onClick={() => handleRemoveAccount(acc.email)} style={{ marginLeft: 8 }}>Remove</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Categories Section */}
      <div className="categories-section" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Categories</h2>
          <p style={{ color: '#555', marginBottom: 24 }}>Organize your emails with AI-powered categories</p>
          <div className="categories-list" style={{ display: 'flex', gap: 32 }}>
            {categories.length === 0 ? (
              <div>No categories yet.</div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="category-card" style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  minWidth: 340,
                  maxWidth: 400,
                  display: 'flex',
                  flexDirection: 'column',
                  marginBottom: 24,
                  alignItems: 'stretch',
                  padding: 0,
                }}>
                  {/* Colored header bar with centered category name */}
                  <div style={{
                    background: cat.color || 'linear-gradient(90deg, #6366f1 0%, #a78bfa 100%)',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    height: 56,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                    color: 'white',
                    letterSpacing: 1,
                    marginBottom: 0,
                  }}>
                    {cat.name}
                  </div>
                  <div style={{ padding: '24px' }}>
                    <p className="category-description" style={{ color: '#555', fontSize: 16, marginBottom: 20, wordBreak: 'break-word' }}>{cat.description}</p>
                    <div className="category-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ color: '#888', fontSize: 15 }}>{cat.email_count || 0} emails</span>
                      <button style={{
                        padding: '8px 18px',
                        borderRadius: '6px',
                        background: '#6366f1',
                        color: 'white',
                        fontWeight: 600,
                        border: 'none',
                        fontSize: 15,
                        cursor: 'pointer',
                      }} onClick={() => handleViewCategory(cat.id)}>View Emails</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <button
          style={{
            marginLeft: 32,
            padding: '12px 28px',
            borderRadius: '8px',
            background: '#10B981',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            fontSize: '17px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(16,185,129,0.08)',
            transition: 'background 0.2s',
            height: 48,
            alignSelf: 'flex-start',
          }}
          onClick={() => setShowAddModal(true)}
        >
          + Add Category
        </button>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <AddCategoryModal onClose={() => setShowAddModal(false)} onAdd={handleAddCategory} />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage; 