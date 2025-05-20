
"use client";

import type { User } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Removed usePathname as it's not used
import { nanoid } from 'nanoid';
import { toast } from "@/hooks/use-toast";

// LOCAL_STORAGE_USERS_KEY is removed as users are now hardcoded (single superadmin)
// LOCAL_STORAGE_CURRENT_USER_KEY 用于在浏览器会话之间记住当前登录的用户。
const LOCAL_STORAGE_CURRENT_USER_KEY = 'inventory_current_user_prototype_v2'; // Versioning key in case of structure changes
const SUPERADMIN_USERNAME = 'aomanyupianjian';
const SUPERADMIN_PASSWORD = 'amypj2025'; // Plain text for prototype

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  // users: User[]; // Removed, as we only have one hardcoded superadmin
  isLoading: boolean;
  login: (usernameInput: string, passwordInput: string) => Promise<void>;
  logout: () => void;
  // addUser: (usernameInput: string, passwordInput: string) => void; // Removed
  // deleteUser: (usernameToDelete: string) => void; // Removed
  toast: typeof toast; // Added toast to context type
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const hardcodedSuperAdmin: User = {
  id: 'superadmin_001', // Fixed ID for the superadmin
  username: SUPERADMIN_USERNAME,
  password: SUPERADMIN_PASSWORD,
  isSuperAdmin: true,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // const [users, setUsers] = useState<User[]>([hardcodedSuperAdmin]); // Simplified: users array not needed if only one admin
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    // 检查持久化的登录状态 (记住登录的关键部分)
    const persistedUserMeta = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_KEY);
    if (persistedUserMeta) {
      try {
        const userMeta = JSON.parse(persistedUserMeta) as Pick<User, 'id' | 'username' | 'isSuperAdmin'>;
        // 验证持久化的用户信息是否与硬编码的超级管理员匹配
        if (userMeta.id === hardcodedSuperAdmin.id && userMeta.username === hardcodedSuperAdmin.username) {
          setCurrentUser({ ...hardcodedSuperAdmin, password: "" }); // Set current user without password
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
        }
      } catch (e) {
          localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (usernameInput: string, passwordInput: string): Promise<void> => {
    if (usernameInput === hardcodedSuperAdmin.username && passwordInput === hardcodedSuperAdmin.password) {
      const { password, ...userMetaToStore } = hardcodedSuperAdmin;
      setCurrentUser({ ...userMetaToStore, password: "" }); // Store current user without password in state
      setIsAuthenticated(true);
      localStorage.setItem(LOCAL_STORAGE_CURRENT_USER_KEY, JSON.stringify(userMetaToStore));
      toast({ title: "登录成功", description: `欢迎回来, ${hardcodedSuperAdmin.username}!` });
      router.push('/');
    } else {
      toast({ title: "登录失败", description: "用户名或密码错误。", variant: "destructive" });
      throw new Error("Invalid credentials");
    }
  }, [router]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
    toast({ title: "已登出", description: "您已成功登出。" });
    router.push('/login');
  }, [router]);

  // addUser and deleteUser functions are removed as they are no longer needed.

  return (
    <AuthContext.Provider value={{ 
        isAuthenticated, 
        currentUser, 
        // users, // Removed from context value
        isLoading, 
        login, 
        logout, 
        // addUser, // Removed
        // deleteUser, // Removed
        toast 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 中使用');
  }
  return context; // Directly return context, toast is part of it
};
