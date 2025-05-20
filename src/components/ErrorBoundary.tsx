
"use client";

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorProvider, useErrorLogger, ErrorContext } from '@/contexts/ErrorContext'; // Correctly import ErrorContext
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Fallback component that uses the hook
const ErrorFallbackContent = ({ error, resetErrorBoundary }: { error?: Error, resetErrorBoundary: () => void }) => {
  const { addErrorLog } = useErrorLogger(); // Hook can be used here

  // This effect will log the error if it hasn't been logged by componentDidCatch
  // It's a bit redundant if componentDidCatch always logs, but can be a safeguard
  // Or, could be removed if componentDidCatch is reliable for logging via context.
  // For now, let's rely on componentDidCatch to log.

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
      <div className="max-w-md p-6 border rounded-lg shadow-xl bg-card text-card-foreground">
        <h2 className="mb-4 text-2xl font-semibold text-destructive">应用发生错误</h2>
        <p className="mb-2 text-muted-foreground">抱歉，应用遇到了一些问题，此部分无法正常显示。</p>
        {error && (
          <details className="p-2 mb-4 text-xs text-left border rounded bg-muted text-muted-foreground max-h-32 overflow-y-auto">
            <summary className="cursor-pointer">错误详情</summary>
            <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
            {error.stack && <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>}
          </details>
        )}
        <p className="mb-4 text-sm text-muted-foreground">
          您可以尝试刷新页面或点击下方按钮重置此部分。如果问题持续存在，请联系技术支持并提供错误日志。
        </p>
        <Button onClick={resetErrorBoundary} variant="outline">
          尝试重置
        </Button>
        <Button onClick={() => window.location.reload()} className="ml-2">
          刷新页面
        </Button>
      </div>
    </div>
  );
};


class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
  };

  // Making context available to class component
  static contextType = ErrorContext;
  declare context: React.ContextType<typeof ErrorContext>;


  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our ErrorContext
    // The context might not be available during the initial render if ErrorBoundary is outside ErrorProvider
    // So we ensure context exists.
    if (this.context && this.context.addErrorLog) {
      this.context.addErrorLog(error, errorInfo, 'React ErrorBoundary');
    } else {
      // Fallback console log if context is not available (shouldn't happen with proper setup)
      console.error("ErrorBoundary caught an error (context unavailable):", error, errorInfo);
    }
  }
  
  private resetState = () => {
    this.setState({ hasError: false, error: undefined });
  }


  public render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallbackContent error={this.state.error} resetErrorBoundary={this.resetState} />;
    }

    return this.props.children;
  }
}

// A wrapper to ensure ErrorFallbackContent can use the hook
const ErrorBoundaryWithContextAwareFallback: React.FC<Props> = ({ children, fallback }) => {
  // This component doesn't need to consume the context directly if ErrorBoundary does.
  // The purpose is to ensure the fallback (if it's ErrorFallbackContent) is within ErrorProvider.
  return (
     <ErrorBoundary fallback={fallback}>
        {children}
     </ErrorBoundary>
  )
}


export default ErrorBoundaryWithContextAwareFallback;
// Export the base ErrorBoundary if direct usage is needed without the wrapper, though the wrapper is safer.
export { ErrorBoundary as BaseErrorBoundary };
