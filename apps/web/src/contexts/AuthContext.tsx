import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@gestao-leitos/types';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // No longer using localStorage - session is managed via JWT cookie
  // The App component will check auth status using trpc.auth.me

  const logout = () => {
    setCurrentUser(null);
    // Cookie will be cleared by calling trpc.auth.logout
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
