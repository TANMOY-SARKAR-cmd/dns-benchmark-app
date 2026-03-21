import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-900">
          <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-8 h-8" />
              <h1 className="text-xl font-bold">Something went wrong</h1>
            </div>
            <p className="text-slate-600 mb-4 text-sm">
              The application encountered an unexpected error.
            </p>
            {this.state.error && (
              <pre className="bg-slate-100 p-3 rounded text-xs text-slate-800 overflow-auto mb-4 border border-slate-200 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
