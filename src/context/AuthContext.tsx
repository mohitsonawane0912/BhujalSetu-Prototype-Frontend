import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: string;
  communityId?: string;
}

export interface CommunityInfo {
  id: string;
  name: string;
  district?: string;
  state?: string;
}

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  membershipStatus: 'active' | 'pending' | 'none';
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ membershipStatus: 'active' | 'pending' | 'none' }>;
  signUp: (email: string, password: string, displayName: string, villageId?: string) => Promise<void>;
  registerCommunity: (params: {
    communityName: string;
    villageId?: string;
    district?: string;
    state?: string;
    latitude?: number | null;
    longitude?: number | null;
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  verifyHardwareNodes: () => Promise<{ bothNodesVerified: boolean; activated: boolean; membershipStatus: 'active' | 'pending' | 'none' }>;
  refreshAuth: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'bhujalsetu_auth_token';

async function parseResponseJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) {
    if (!res.ok) {
      if (res.status === 502 || res.status === 503) {
        throw new Error('Backend server is not running on port 5001. Please start the backend.');
      }
      throw new Error(`Server returned empty response (${res.status}).`);
    }
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      if (res.status === 502 || res.status === 503) {
        throw new Error('Backend server is not running on port 5001. Please run "npm run server" or "npm run dev:all".');
      }
      throw new Error(`Server returned non-JSON response (${res.status}).`);
    }
    throw new Error('Unexpected non-JSON response from server.');
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [membershipStatus, setMembershipStatus] = useState<'active' | 'pending' | 'none'>('none');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = async (storedToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });
      if (res.ok) {
        const data = await parseResponseJson(res);
        if (data && data.success && data.user) {
          setUser({
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.displayName,
            photoURL: null,
            role: data.user.role,
            communityId: data.user.communityId,
          });
          setMembershipStatus(data.membershipStatus || 'pending');
          setToken(storedToken);
          return;
        }
      }
      // If token rejected, clean up
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
      setMembershipStatus('none');
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
      setMembershipStatus('none');
    }
  };

  // Validate existing stored token on mount
  useEffect(() => {
    let isMounted = true;
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    fetchCurrentUser(storedToken).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ membershipStatus: 'active' | 'pending' | 'none' }> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Invalid email or password.');
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser({
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: null,
        role: data.user.role,
        communityId: data.user.communityId,
      });
      const status = data.membershipStatus || 'pending';
      setMembershipStatus(status);
      return { membershipStatus: status };
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName: string, villageId?: string) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, villageId }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Registration failed');
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser({
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: null,
        role: data.user.role,
        communityId: data.user.communityId,
      });
      setMembershipStatus(data.membershipStatus || 'pending');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const registerCommunity = async (params: {
    communityName: string;
    villageId?: string;
    district?: string;
    state?: string;
    latitude?: number | null;
    longitude?: number | null;
    email: string;
    password: string;
    displayName: string;
  }) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/register-community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await parseResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Community registration failed');
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser({
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: null,
        role: data.user.role,
        communityId: data.user.communityId,
      });
      setMembershipStatus(data.membershipStatus || 'pending');
    } catch (err: any) {
      setError(err.message || 'Community registration failed');
      throw err;
    }
  };

  const verifyHardwareNodes = async (): Promise<{
    bothNodesVerified: boolean;
    activated: boolean;
    membershipStatus: 'active' | 'pending' | 'none';
  }> => {
    try {
      const res = await fetch('/api/auth/verify-nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ villageId: user?.communityId }),
      });
      const data = await parseResponseJson(res);
      if (data?.bothNodesVerified) {
        setMembershipStatus('active');
        return { bothNodesVerified: true, activated: true, membershipStatus: 'active' };
      }
      return { bothNodesVerified: false, activated: false, membershipStatus: membershipStatus };
    } catch {
      return { bothNodesVerified: false, activated: false, membershipStatus: membershipStatus };
    }
  };

  const refreshAuth = async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      await fetchCurrentUser(storedToken);
    }
  };

  const signOutUser = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setMembershipStatus('none');
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        membershipStatus,
        loading,
        error,
        signIn,
        signUp,
        registerCommunity,
        verifyHardwareNodes,
        refreshAuth,
        signOutUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
