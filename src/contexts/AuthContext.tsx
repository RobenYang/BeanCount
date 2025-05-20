
"use client";

import type { User } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { nanoid } from 'nanoid';
import { toast } from "@/hooks/use-toast";

const LOCAL_STORAGE_USERS_KEY = 'inventory_users_auth_prototype';
const SUPERADMIN_USERNAME = 'aomanyupianjian';
const SUPERADMIN_PASSWORD = 'amypj2025'; // Plain text for prototype

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  login: (usernameInput: string, passwordInput: string) => Promise<void>;
  logout: () => void;
  addUser: (usernameInput: string, passwordInput: string) => void;
  deleteUser: (usernameToDelete: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedUsers = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    let initialUsers: User[] = [];
    if (storedUsers) {
      try {
        initialUsers = JSON.parse(storedUsers);
      } catch (e) {
        console.error("Failed to parse users from localStorage", e);
        initialUsers = [];
      }
    }

    // Ensure superadmin exists
    const superAdminExists = initialUsers.some(u => u.username === SUPERADMIN_USERNAME && u.isSuperAdmin);
    if (!superAdminExists) {
      const superAdmin: User = {
        id: nanoid(),
        username: SUPERADMIN_USERNAME,
        password: SUPERADMIN_PASSWORD, // Storing plain password for prototype
        isSuperAdmin: true,
      };
      initialUsers = [superAdmin, ...initialUsers.filter(u => u.username !== SUPERADMIN_USERNAME)];
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(initialUsers));
    }
    setUsers(initialUsers);

    // Check for persisted login (very basic, not secure for production)
    const persistedUser = localStorage.getItem('currentUser');
    if (persistedUser) {
      try {
        const user = JSON.parse(persistedUser) as User;
        // Re-validate against current user list for safety, though passwords aren't rechecked here
        const validUser = initialUsers.find(u => u.id === user.id && u.username === user.username);
        if (validUser) {
          setCurrentUser(validUser);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('currentUser');
        }
      } catch (e) {
          localStorage.removeItem('currentUser');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  }, [users]);


  const login = useCallback(async (usernameInput: string, passwordInput: string): Promise<void> => {
    const userToLogin = users.find(u => u.username === usernameInput);
    if (userToLogin && userToLogin.password === passwordInput) { // Plain text password check
      setCurrentUser(userToLogin);
      setIsAuthenticated(true);
      localStorage.setItem('currentUser', JSON.stringify(userToLogin)); // Persist for session
      toast({ title: "登录成功", description: `欢迎回来, ${userToLogin.username}!` });
      router.push('/');
    } else {
      toast({ title: "登录失败", description: "用户名或密码错误。", variant: "destructive" });
      throw new Error("Invalid credentials");
    }
  }, [users, router]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentUser');
    toast({ title: "已登出", description: "您已成功登出。" });
    router.push('/login');
  }, [router]);

  const addUser = useCallback((usernameInput: string, passwordInput: string) => {
    if (users.some(u => u.username === usernameInput)) {
      toast({ title: "错误", description: `用户 "${usernameInput}" 已存在。`, variant: "destructive" });
      return;
    }
    const newUser: User = {
      id: nanoid(),
      username: usernameInput,
      password: passwordInput, // Storing plain password
      isSuperAdmin: false,
    };
    setUsers(prevUsers => [...prevUsers, newUser]);
    toast({ title: "成功", description: `用户 "${usernameInput}" 已添加。` });
  }, [users]);

  const deleteUser = useCallback((usernameToDelete: string) => {
    const userExists = users.some(u => u.username === usernameToDelete);
    if (!userExists) {
        toast({ title: "错误", description: `用户 "${usernameToDelete}" 不存在。`, variant: "destructive" });
        return;
    }
    if (usernameToDelete === SUPERADMIN_USERNAME) {
      toast({ title: "操作无效", description: "不能删除超级管理员账户。", variant: "destructive" });
      return;
    }
    setUsers(prevUsers => prevUsers.filter(u => u.username !== usernameToDelete));
    toast({ title: "成功", description: `用户 "${usernameToDelete}" 已删除。` });
  }, [users]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, users, isLoading, login, logout, addUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 中使用');
  }
  return context;
};
