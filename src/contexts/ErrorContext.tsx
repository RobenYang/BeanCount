
"use client";

import type { ClientErrorLog } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { formatISO } from 'date-fns';

const LOCAL_STORAGE_ERROR_LOGS_KEY = 'inventory_error_logs_v1';
const MAX_ERROR_LOGS = 100; // Limit the number of logs stored in localStorage

interface ErrorContextType {
  errorLogs: ClientErrorLog[];
  addErrorLog: (
    error: Error | string,
    errorInfo?: React.ErrorInfo | { componentStack?: string }, // Allow passing componentStack directly for API errors
    type?: 'React ErrorBoundary' | 'Global onerror' | 'Unhandled Promise Rejection' | 'Manual Log' | 'API Call Error' | 'Client Validation Error'
  ) => void;
  clearErrorLogs: () => void;
  exportErrorLogs: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);
export { ErrorContext }; // Explicitly export ErrorContext

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [errorLogs, setErrorLogs] = useState<ClientErrorLog[]>([]);

  useEffect(() => {
    try {
      const storedLogs = localStorage.getItem(LOCAL_STORAGE_ERROR_LOGS_KEY);
      if (storedLogs) {
        setErrorLogs(JSON.parse(storedLogs));
      }
    } catch (e) {
      console.error("Failed to load error logs from localStorage", e);
    }
  }, []);

  const saveErrorLogs = useCallback((logs: ClientErrorLog[]) => {
    try {
      // Keep only the latest MAX_ERROR_LOGS
      const logsToStore = logs.slice(-MAX_ERROR_LOGS);
      localStorage.setItem(LOCAL_STORAGE_ERROR_LOGS_KEY, JSON.stringify(logsToStore));
      setErrorLogs(logsToStore);
    } catch (e) {
      console.error("Failed to save error logs to localStorage", e);
    }
  }, []);

  const addErrorLog = useCallback((
    error: Error | string,
    errorInfo?: React.ErrorInfo | { componentStack?: string }, // Updated type
    type: 'React ErrorBoundary' | 'Global onerror' | 'Unhandled Promise Rejection' | 'Manual Log' | 'API Call Error' | 'Client Validation Error' = 'Manual Log'
  ) => {
    console.error(`[${type}]`, error, errorInfo); // Also log to console for immediate visibility

    let componentStackMessage: string | undefined = undefined;
    if (errorInfo) {
        if ('componentStack' in errorInfo && typeof errorInfo.componentStack === 'string') {
            componentStackMessage = errorInfo.componentStack;
        }
    }


    const newLogEntry: ClientErrorLog = {
      id: nanoid(),
      timestamp: formatISO(new Date()),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      errorType: type,
      componentStack: componentStackMessage,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    setErrorLogs(prevLogs => {
      const updatedLogs = [...prevLogs, newLogEntry];
      saveErrorLogs(updatedLogs); // Save immediately, saveErrorLogs handles slicing
      return updatedLogs.slice(-MAX_ERROR_LOGS); // also update state correctly
    });
  }, [saveErrorLogs]);

  useEffect(() => {
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;

    window.onerror = (message, source, lineno, colno, error) => {
      addErrorLog(error || new Error(message as string), undefined, 'Global onerror');
      if (originalOnError) {
        return originalOnError.apply(window, [message, source, lineno, colno, error]);
      }
      return false;
    };

    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      addErrorLog(event.reason || new Error('Unhandled promise rejection'), undefined, 'Unhandled Promise Rejection');
      if (originalOnUnhandledRejection) {
        return originalOnUnhandledRejection.apply(window, [event]);
      }
    };

    return () => {
      window.onerror = originalOnError;
      window.onunhandledrejection = originalOnUnhandledRejection;
    };
  }, [addErrorLog]);


  const clearErrorLogs = useCallback(() => {
    saveErrorLogs([]);
  }, [saveErrorLogs]);

  const exportErrorLogs = useCallback(() => {
    if (errorLogs.length === 0) {
      // Using globalToast from InventoryContext is not ideal here,
      // but for simplicity let's assume it's available or use alert.
      // In a larger app, toast might come from a more global UI context.
      alert("没有可导出的错误日志。");
      return;
    }
    const jsonString = JSON.stringify(errorLogs, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `inventory_error_logs_${formatISO(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }, [errorLogs]);

  return (
    <ErrorContext.Provider value={{ errorLogs, addErrorLog, clearErrorLogs, exportErrorLogs }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useErrorLogger = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useErrorLogger must be used within an ErrorProvider');
  }
  return context;
};

    