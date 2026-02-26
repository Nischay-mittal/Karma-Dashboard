import React from "react";
import MainDashboard from "./components/MainDashboard";

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("App error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a, #020617)",
          color: "#e5e7eb",
          padding: "40px",
          fontFamily: "system-ui, sans-serif",
        }}>
          <h1 style={{ color: "#f87171", marginBottom: "16px" }}>Something went wrong</h1>
          <pre style={{
            background: "rgba(0,0,0,0.3)",
            padding: "20px",
            borderRadius: "8px",
            overflow: "auto",
            fontSize: "13px",
            color: "#94a3b8",
          }}>
            {this.state.error?.toString()}
          </pre>
          <p style={{ marginTop: "16px", color: "#94a3b8" }}>
            Check the browser console for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <MainDashboard />
    </ErrorBoundary>
  );
}

export default App;
