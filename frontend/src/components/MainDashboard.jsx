import { useState } from "react";
import FinanceRevenue from "./FinanceRevenue";
import FootfallReport from "./FootfallReport";

function MainDashboard() {
  const [activeTab, setActiveTab] = useState("home");

  const tabs = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "finance", label: "Finance Revenue", icon: "💰" },
    { id: "footfall", label: "Customer Footfall", icon: "👥" },
    { id: "stock", label: "Stock Prediction", icon: "📊" },
  ];

  return (
    <div className="dashboard-container">
      {/* Header with Logo */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-circle">
              <span className="logo-text">K</span>
            </div>
            <h1 className="company-name">Karma Primary Healthcare Dashboard</h1>
          </div>
          <nav className="nav-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {activeTab === "home" && (
          <div className="home-view">
            <div className="welcome-card">
              <h2>Welcome to Karma Primary Healthcare Dashboard</h2>
              <p className="welcome-subtitle">
                Your one-stop solution for comprehensive healthcare analytics and insights
              </p>
            </div>

            <div className="feature-cards">
              <div 
                className="feature-card" 
                onClick={() => setActiveTab("finance")}
              >
                <div className="feature-icon">💰</div>
                <h3>Finance Revenue</h3>
                <p>View revenue analytics, track financial performance, and analyze revenue trends with detailed reports and Excel exports.</p>
                <div className="feature-arrow">→</div>
              </div>

              <div 
                className="feature-card" 
                onClick={() => setActiveTab("footfall")}
              >
                <div className="feature-icon">👥</div>
                <h3>Customer Footfall</h3>
                <p>Monitor customer visits, analyze footfall patterns, peak hours, and customer engagement metrics across locations.</p>
                <div className="feature-arrow">→</div>
              </div>

              <div 
                className="feature-card coming-soon"
                onClick={() => setActiveTab("stock")}
              >
                <div className="feature-icon">📊</div>
                <h3>Stock Prediction</h3>
                <p>Predictive analytics for inventory management, stock forecasting, and demand analysis with AI-powered insights.</p>
                <div className="coming-soon-badge">Coming Soon</div>
                <div className="feature-arrow">→</div>
              </div>
            </div>

            <div className="quick-stats">
              <div className="stat-card">
                <div className="stat-value">3</div>
                <div className="stat-label">Active Dashboards</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">24/7</div>
                <div className="stat-label">Available Access</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">Real-time</div>
                <div className="stat-label">Data Updates</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "finance" && <FinanceRevenue />}
        {activeTab === "footfall" && <FootfallReport />}
        
        {activeTab === "stock" && (
          <div className="app">
            <h1>Stock Prediction Dashboard</h1>
            <div style={{ 
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.15)",
              borderRadius: "12px",
              padding: "40px",
              textAlign: "center",
              marginTop: "40px"
            }}>
              <h2 style={{ marginBottom: "20px", color: "#94a3b8" }}>
                Stock Prediction Dashboard
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "16px" }}>
                This dashboard is under development. It will provide AI-powered stock predictions,
                inventory forecasting, and demand analysis.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MainDashboard;

