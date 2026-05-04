import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  balance?: number;
  google_id?: string;
  tron_wallet_address?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  signOut: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Storage keys
const TOKEN_KEY = 'skycrash_token';
const USER_KEY = 'skycrash_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token and user session on mount
    const token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    
    if (token && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        // Use the balance from the saved user object (don't force to 0)
        // Balance will be refreshed from server when needed
        setUser(userObj);
        // Verify token is still valid
        verifyToken(token).catch(() => {
          // Token invalid, clear storage
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        });
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const verifyToken = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Token verification failed');
    }

    return response.json();
  };

  const login = async (email: string, password: string) => {
    // Basic validation
    if (!email.trim()) {
      throw new Error('Please enter your email or Gmail address');
    }
    if (!password.trim()) {
      throw new Error('Please enter your password');
    }
    if (!email.includes('@') || !email.includes('.')) {
      throw new Error('Please enter a valid email address (e.g., user@gmail.com)');
    }

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Save token and user with actual balance from server
    const userWithServerBalance = { ...data.user };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userWithServerBalance));
    setUser(userWithServerBalance);
  };

  const loginWithToken = async (token: string) => {
    // Verify token and get user data
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Token verification failed');
    }

    const data = await response.json();

    // Save token and user with actual balance from server
    const userWithServerBalance = { ...data.user };
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userWithServerBalance));
    setUser(userWithServerBalance);
  };

  const register = async (email: string, password: string) => {
    // Basic validation
    if (!email.trim()) {
      throw new Error('Please enter your email or Gmail address');
    }
    if (!password.trim()) {
      throw new Error('Please enter your password');
    }
    if (!email.includes('@') || !email.includes('.')) {
      throw new Error('Please enter a valid email address (e.g., user@gmail.com)');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Save token and user with actual balance from server
    const userWithServerBalance = { ...data.user };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userWithServerBalance));
    setUser(userWithServerBalance);
  };

  const googleLogin = async () => {
    // For demo purposes, simulate Google login
    // In production, this would use actual Google OAuth
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        googleId: 'google-demo-user-id',
        email: 'demo@gmail.com'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Google login failed');
    }

    // Save token and user with actual balance from server
    const userWithServerBalance = { ...data.user };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userWithServerBalance));
    setUser(userWithServerBalance);
  };

  const signOut = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (token) {
      try {
        // Call logout endpoint to invalidate session
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        // Continue with local logout even if server logout fails
        console.error('Server logout failed:', error);
      }
    }

    // Clear local storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithToken, register, googleLogin, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
