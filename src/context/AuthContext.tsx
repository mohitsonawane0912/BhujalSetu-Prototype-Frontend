import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  FirebaseUser,
} from '../firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  signInAsDemoUser: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen to Firebase auth state
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'Community Member',
            photoURL: firebaseUser.photoURL,
            isDemo: false,
          });
        } else {
          // Check if local demo user is set
          const storedDemo = localStorage.getItem('bhujalsetu_demo_user');
          if (storedDemo) {
            try {
              setUser(JSON.parse(storedDemo));
            } catch {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
        setLoading(false);
      },
      (authError) => {
        console.warn('Auth state subscription warning:', authError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || 'Community Member',
        photoURL: result.user.photoURL,
        isDemo: false,
      });
      localStorage.removeItem('bhujalsetu_demo_user');
    } catch (err: unknown) {
      let msg = 'Google sign-in was interrupted or closed.';
      if (err instanceof Error) {
        if (err.message.includes('auth/unauthorized-domain')) {
          msg = "Localhost domain is not added to Firebase OAuth authorized domains. Click 'Sign In as Demo' below to enter the dashboard immediately.";
        } else if (err.message.includes('auth/popup-blocked')) {
          msg = "The sign-in popup was blocked by your browser. Please allow popups or use Demo profile.";
        } else if (err.message.includes('auth/popup-closed-by-user')) {
          msg = "Google sign-in window was closed before completing.";
        } else {
          msg = err.message;
        }
      }
      setError(msg);
      console.warn('Google sign-in attempt:', err);
    }
  };

  const signInAsDemoUser = () => {
    const demoUser: AppUser = {
      uid: 'demo-resident-42',
      email: 'demo.volunteer@bhujalsetu.org',
      displayName: 'Pooja Sharma (Ward 3 Volunteer)',
      photoURL: null,
      isDemo: true,
    };
    setUser(demoUser);
    localStorage.setItem('bhujalsetu_demo_user', JSON.stringify(demoUser));
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignored if local demo
    }
    localStorage.removeItem('bhujalsetu_demo_user');
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle,
        signOutUser,
        signInAsDemoUser,
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
