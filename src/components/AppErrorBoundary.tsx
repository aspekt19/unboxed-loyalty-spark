import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback so we know which layer crashed. */
  scope?: string;
}

interface State {
  error: Error | null;
}

/**
 * Any uncaught render error used to unmount the whole React tree, which inside
 * Base App / Farcaster webviews looks like a permanent white screen (there is
 * no visible browser UI to reload with). This boundary keeps something on
 * screen and gives the user a one-tap recovery path.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', this.props.scope ?? 'app', error, info.componentStack);
    // Make sure the host client hides its splash screen even when we crashed.
    void import('@farcaster/miniapp-sdk')
      .then(({ sdk }) => sdk.actions.ready())
      .catch(() => {});
  }

  private handleReload = () => {
    this.setState({ error: null });
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <img
            src="/new-favicon.png"
            alt="Loyal Spark"
            className="mx-auto mb-4 h-10 w-10 rounded-lg"
          />
          <h1 className="text-base font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The screen failed to load. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
