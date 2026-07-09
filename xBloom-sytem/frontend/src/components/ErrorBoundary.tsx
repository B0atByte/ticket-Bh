import { Component, type ReactNode } from "react";

/** Catches render-time crashes so a single bad screen doesn't blank the app. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("UI error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-screen max-w-portal flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-serif text-3xl font-light text-ink">Something went wrong.</h1>
          <p className="text-sm text-muted">Please reload the page. If the problem persists, contact support.</p>
          <button onClick={() => location.reload()} className="rounded-xl2 bg-ink px-4 py-3 text-sm text-white">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
