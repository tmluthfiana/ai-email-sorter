// Mock API service for testing
export const apiService = {
  // Auth endpoints
  getGoogleAuthUrl: jest.fn().mockResolvedValue({ authUrl: 'https://accounts.google.com/oauth2/auth' }),
  handleGoogleCallback: jest.fn().mockResolvedValue({ token: 'mock_token' }),
  refreshToken: jest.fn().mockResolvedValue({ token: 'new_mock_token' }),
  getProfile: jest.fn().mockResolvedValue({ user: { id: 1, email: 'test@example.com' } }),

  // Category endpoints
  getCategories: jest.fn().mockResolvedValue({ categories: [] }),
  createCategory: jest.fn().mockResolvedValue({ category: { id: 1, name: 'Test Category' } }),
  updateCategory: jest.fn().mockResolvedValue({ category: { id: 1, name: 'Updated Category' } }),
  deleteCategory: jest.fn().mockResolvedValue({ message: 'Category deleted' }),

  // Email endpoints
  syncEmails: jest.fn().mockResolvedValue({ processed: 5, errors: 0, message: 'Successfully processed 5 emails!' }),
  getEmails: jest.fn().mockResolvedValue({ emails: [] }),
  getEmail: jest.fn().mockResolvedValue({ email: { id: 1, subject: 'Test Email' } }),
  markAsRead: jest.fn().mockResolvedValue({ email: { id: 1, read: true } }),
  markAsUnread: jest.fn().mockResolvedValue({ email: { id: 1, read: false } }),
  deleteEmail: jest.fn().mockResolvedValue({ message: 'Email deleted' }),
  bulkAction: jest.fn().mockResolvedValue({ message: 'Bulk action completed' }),
}; 