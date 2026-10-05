import { Component, type ErrorInfo, type ReactNode } from "react";
import { ActionButton } from "@/components/shared/controls";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Called before a retry re-renders children (e.g. to clear promise caches). */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

interface DefaultFallbackProps {
  error: Error;
  retry: () => void;
}

function DefaultFallback({ error, retry }: DefaultFallbackProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-600">
        {error.message || "An unexpected error occurred."}
      </p>
      <ActionButton variant="primary" onClick={retry}>
        Try again
      </ActionButton>
    </div>
  );
}

/**
 * Catches errors thrown while rendering children — including rejected promises
 * surfaced through React's `use()` hook — and shows a recoverable fallback.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  private handleRetry = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;

    if (error) {
      return this.props.fallback ? (
        this.props.fallback(error, this.handleRetry)
      ) : (
        <DefaultFallback error={error} retry={this.handleRetry} />
      );
    }

    return this.props.children;
  }
}
