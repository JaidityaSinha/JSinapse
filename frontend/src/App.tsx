
import './App.css'

function App() {
  return (
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">J</div>
            <span>JSinapse</span>
          </div>

          <div className="sidebar-label">WORKSPACE</div>
          <button className="nav-item active">⌘ Overview</button>
          <button className="nav-item">◈ Code Galaxy</button>
          <button className="nav-item">⌁ Dependencies</button>
          <button className="nav-item">⌕ Code Search</button>

          <div className="sidebar-bottom">
            <div className="status-dot" />
            <span>System operational</span>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div>
              <span className="breadcrumb">Workspace / </span>
              <span>Overview</span>
            </div>
            <div className="avatar">JS</div>
          </header>

          <section className="welcome">
            <div className="eyebrow">
              <span className="status-dot" />
              CODEBASE INTELLIGENCE PLATFORM
            </div>

            <h1>Understand the connections<br />
              <span>behind your code.</span>
            </h1>

            <p>
              Explore architecture, trace execution, and discover how
              every part of your codebase works together.
            </p>

            <div className="repo-input">
              <span className="github-mark">⌘</span>
              <input
                  type="text"
                  placeholder="Paste a GitHub repository URL..."
                  aria-label="GitHub repository URL"
              />
              <button className="analyze-button">Analyze repository ↗</button>
            </div>

            <div className="input-hint">
              <span>↳</span> Public GitHub repositories · More providers coming soon
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Your codebase, visualized</h2>
                <p>Tools to understand software beyond individual files.</p>
              </div>
              <span className="coming-soon">YOUR WORKSPACE</span>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <div className="feature-icon purple">✳</div>
                <h3>Code Galaxy</h3>
                <p>Explore files and modules as an interactive network of connected nodes.</p>
                <span className="feature-link">Explore architecture <span>↗</span></span>
              </article>

              <article className="feature-card">
                <div className="feature-icon cyan">⌁</div>
                <h3>Dependency Explorer</h3>
                <p>See what depends on what, and understand the impact of changes.</p>
                <span className="feature-link">Map dependencies <span>↗</span></span>
              </article>

              <article className="feature-card">
                <div className="feature-icon orange">⌘</div>
                <h3>Execution Traces</h3>
                <p>Follow the path from an entry point through the code it invokes.</p>
                <span className="feature-link">Trace execution <span>↗</span></span>
              </article>

              <article className="feature-card">
                <div className="feature-icon green">✧</div>
                <h3>AI Code Assistant</h3>
                <p>Ask questions about your repository and get context-aware explanations.</p>
                <span className="feature-link">Understand code <span>↗</span></span>
              </article>
            </div>
          </section>

          <footer className="footer">
            <span>JSinapse <span className="footer-muted">· Codebase Intelligence</span></span>
            <span>Built to make complex code understandable.</span>
          </footer>
        </main>
      </div>
  )
}

export default App
