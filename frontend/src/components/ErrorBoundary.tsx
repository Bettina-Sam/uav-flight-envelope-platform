import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error);
  }

  handleRetry = () => {
    // A fresh render() attempt is often enough (the lazyRetry wrapper has
    // usually already resolved the underlying import by now); if the
    // module graph is still stale, fall back to a full reload.
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[200px] flex flex-col items-center justify-center gap-3 text-muted text-sm border border-dashed border-border rounded-lg p-6">
          <AlertTriangle className="w-5 h-5 text-amber" />
          <p>{this.props.fallbackTitle || 'This section failed to load.'}</p>
          <p className="text-xs">The rest of the page is unaffected.</p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-md border border-border text-xs font-mono uppercase tracking-wider text-text hover:border-cyan/50 hover:text-cyan transition"
          >
            <RotateCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
