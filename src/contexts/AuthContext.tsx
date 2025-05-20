
"use client";

import type { User } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { nanoid } from 'nanoid';
import { toast } from "@/hooks/use-toast";

const LOCAL_STORAGE_USERS_KEY = 'inventory_users_auth_prototype';
// LOCAL_STORAGE_CURRENT_USER_KEY 用于在浏览器会话之间记住当前登录的用户。
const LOCAL_STORAGE_CURRENT_USER_KEY = 'inventory_current_user_prototype'; 
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
        password: SUPERADMIN_PASSWORD, 
        isSuperAdmin: true,
      };
      initialUsers = [superAdmin, ...initialUsers.filter(u => u.username !== SUPERADMIN_USERNAME)];
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(initialUsers));
    }
    setUsers(initialUsers);

    // 检查持久化的登录状态 (记住登录的关键部分)
    // 应用加载时，会尝试从 localStorage 读取之前保存的用户会话信息。
    const persistedUserMeta = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_KEY);
    if (persistedUserMeta) {
      try {
        const userMeta = JSON.parse(persistedUserMeta) as Pick<User, 'id' | 'username' | 'isSuperAdmin'>;
        // 为了安全，重新从当前用户列表中验证持久化的用户信息
        const validUser = initialUsers.find(u => u.id === userMeta.id && u.username === userMeta.username);
        if (validUser) {
          setCurrentUser(validUser); // 设置完整的用户信息
          setIsAuthenticated(true); // 标记为已认证
        } else {
          // 如果持久化的用户不再有效 (例如，用户被删除)，则清除该信息
          localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
        }
      } catch (e) {
          // 如果解析 localStorage 数据出错，也清除该信息
          localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
      }
    }
    setIsLoading(false); // 完成加载过程
  }, []); // 空依赖数组确保此 effect仅在组件挂载时运行一次

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  }, [users]);


  const login = useCallback(async (usernameInput: string, passwordInput: string): Promise<void> => {
    const userToLogin = users.find(u => u.username === usernameInput);
    if (userToLogin && userToLogin.password === passwordInput) { 
      setCurrentUser(userToLogin);
      setIsAuthenticated(true);
      
      // 记住登录状态的关键部分:
      // 登录成功后，将当前用户的元数据 (不包括密码) 保存到 localStorage。
      // 这样即使用户关闭浏览器再打开，也能保持登录状态。
      const { password, ...userMetaToStore } = userToLogin;
      localStorage.setItem(LOCAL_STORAGE_CURRENT_USER_KEY, JSON.stringify(userMetaToStore));
      
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
    // 登出时，清除 localStorage 中保存的当前用户信息，实现“忘记”登录状态。
    localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
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
      password: passwordInput, 
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
    <AuthContext.Provider value={{ isAuthenticated, currentUser, users, isLoading, login, logout, addUser, deleteUser, toast }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 中使用');
  }
  return { ...context, toast };
};

