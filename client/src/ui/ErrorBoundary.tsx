import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? "UI"}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="chibi-card chibi-card--danger"
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            maxWidth: 420,
            padding: 14,
            pointerEvents: "auto",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {this.props.label ?? "Panel"} crashed
          </div>
          <div style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
            {this.state.error.message || "Something went wrong. Close and reopen the panel."}
          </div>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            style={{ marginTop: 10, padding: "8px 12px", fontSize: "0.8rem" }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}