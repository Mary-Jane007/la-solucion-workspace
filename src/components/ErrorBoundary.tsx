import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-root">
          <div className="card page-card" style={{ maxWidth: 560, margin: "40px auto" }}>
            <h2>Er ging iets mis</h2>
            <p className="muted page-error">{this.state.error.message}</p>
            <p className="muted">
              Probeer de pagina te vernieuwen. Blijft dit gebeuren, wis dan je cache of open{" "}
              <a href="http://localhost:5173/" className="link-btn-inline">
                http://localhost:5173/
              </a>
              .
            </p>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Pagina herladen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
