import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the AuthProvider and useAuth hook to avoid authentication issues in tests
jest.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    isAuthenticated: false,
    loading: false,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // The app should render without throwing any errors
    expect(document.body).toBeInTheDocument();
  });
}); 