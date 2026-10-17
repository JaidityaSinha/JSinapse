
import { useState } from 'react'
import './App.css'

type Repository = {
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
  default_branch: string
}

type SourceFile = {
  path: string
  type: string
  size?: number
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [repository, setRepository] = useState<Repository | null>(null)
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [fileSearch, setFileSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [error, setError] = useState('')

  async function analyzeRepository() {
    setError('')
    setFileError('')
    setRepository(null)
    setSourceFiles([])
    setSelectedFile('')
    setFileContent('')

    const match = repoUrl.trim().match(
        /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)\/?(?:[?#].*)?$/
    )

    if (!match) {
      setError('Enter a valid public GitHub repository URL.')
      return
    }

    const owner = match[1]
    const repo = match[2].replace(/\.git$/, '')

    if (!owner || !repo) {
      setError('Enter a valid GitHub repository URL.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
          `http://localhost:8080/api/github/repository?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      )

      if (!response.ok) {
        throw new Error(
            response.status === 404
                ? 'Repository not found, or it is private.'
                : `Repository request failed (${response.status}).`
        )
      }

      const data: Repository = await response.json()
      setRepository(data)

      setFilesLoading(true)

      try {
        const filesResponse = await fetch(
            `http://localhost:8080/api/github/source-files?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        )

        if (!filesResponse.ok) {
          throw new Error(`Source file request failed (${filesResponse.status}).`)
        }

        const files: SourceFile[] = await filesResponse.json()
        setSourceFiles(files)
      } catch (err) {
        setFileError(
            err instanceof Error
                ? err.message
                : 'Could not load source files.'
        )
      } finally {
        setFilesLoading(false)
      }
    } catch (err) {
      setError(
          err instanceof Error
              ? err.message.includes('fetch')
                  ? 'Could not connect to JSinapse. Make sure the backend is running.'
                  : err.message
              : 'Something went wrong while analyzing the repository.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function openFile(path: string) {
    if (!repository) return

    const [owner, repo] = repository.full_name.split('/')
    if (!owner || !repo) return

    setSelectedFile(path)
    setFileContent('')
    setFileError('')

    try {
      const response = await fetch(
          `http://localhost:8080/api/github/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`
      )

      if (!response.ok) {
        throw new Error(`Could not load file (${response.status}).`)
      }

      const content = await response.text()
      setFileContent(content)
    } catch (err) {
      setFileError(
          err instanceof Error
              ? err.message
              : 'Could not load this file.'
      )
    }
  }

  const filteredFiles = sourceFiles.filter(file =>
      file.path.toLowerCase().includes(fileSearch.toLowerCase())
  )

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

            <h1>
              Understand the connections<br />
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
                  value={repoUrl}
                  onChange={event => setRepoUrl(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !loading) {
                      void analyzeRepository()
                    }
                  }}
              />
              <button
                  className="analyze-button"
                  onClick={() => void analyzeRepository()}
                  disabled={loading}
              >
                {loading ? 'Analyzing...' : 'Analyze repository ↗'}
              </button>
            </div>

            <div className="input-hint">
              <span>↳</span> Public GitHub repositories · More providers coming soon
            </div>

            {error && (
                <p role="alert" style={{ color: '#ff8585' }}>{error}</p>
            )}

            {repository && (
                <article
                    className="feature-card"
                    style={{ marginTop: '24px', maxWidth: '720px' }}
                >
                  <h3>{repository.full_name}</h3>
                  <p>{repository.description || 'No description provided.'}</p>

                  <div style={{
                    display: 'flex',
                    gap: '20px',
                    flexWrap: 'wrap',
                    marginTop: '16px'
                  }}>
                    <span>Language: {repository.language || 'Not specified'}</span>
                    <span>⭐ {repository.stargazers_count.toLocaleString()}</span>
                    <span>⑂ {repository.forks_count.toLocaleString()} forks</span>
                    <span>Branch: {repository.default_branch}</span>
                  </div>

                  <p style={{ marginTop: '16px' }}>
                    <a
                        href={repository.html_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#b6a0ff' }}
                    >
                      View on GitHub ↗
                    </a>
                  </p>
                </article>
            )}
          </section>

          {repository && (
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>Source Explorer</h2>
                    <p>Browse source files and inspect their contents.</p>
                  </div>
                  <span className="coming-soon">
                {sourceFiles.length} FILES
              </span>
                </div>

                {filesLoading && <p>Loading source files...</p>}

                {fileError && (
                    <p role="alert" style={{ color: '#ff8585' }}>{fileError}</p>
                )}

                {!filesLoading && !fileError && sourceFiles.length === 0 && (
                    <p>No supported source files or README files were found.</p>
                )}

                {sourceFiles.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(0, 2fr)',
                      gap: '16px',
                      alignItems: 'start'
                    }}>
                      <article className="feature-card" style={{ minWidth: 0 }}>
                        <input
                            type="text"
                            placeholder="Search files..."
                            aria-label="Search source files"
                            value={fileSearch}
                            onChange={event => setFileSearch(event.target.value)}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '10px',
                              marginBottom: '12px',
                              borderRadius: '8px',
                              border: '1px solid #303647',
                              background: '#0b0e16',
                              color: '#ffffff'
                            }}
                        />

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          maxHeight: '420px',
                          overflowY: 'auto'
                        }}>
                          {filteredFiles.map(file => (
                              <button
                                  key={file.path}
                                  onClick={() => void openFile(file.path)}
                                  style={{
                                    textAlign: 'left',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: selectedFile === file.path
                                        ? '#8b72ef'
                                        : 'transparent',
                                    background: selectedFile === file.path
                                        ? '#25203d'
                                        : 'transparent',
                                    color: '#e5e7eb',
                                    cursor: 'pointer',
                                    overflowWrap: 'anywhere'
                                  }}
                              >
                                <span style={{ marginRight: '8px' }}>📄</span>
                                {file.path}
                              </button>
                          ))}

                          {filteredFiles.length === 0 && (
                              <p>No matching files.</p>
                          )}
                        </div>
                      </article>

                      <article className="feature-card" style={{ minWidth: 0 }}>
                        <h3 style={{ overflowWrap: 'anywhere' }}>
                          {selectedFile || 'Select a file to preview'}
                        </h3>

                        {selectedFile && !fileContent && !fileError && (
                            <p>Loading file contents...</p>
                        )}

                        {fileContent && (
                            <pre style={{
                              marginTop: '16px',
                              padding: '16px',
                              borderRadius: '8px',
                              background: '#090b11',
                              color: '#d8deeb',
                              overflow: 'auto',
                              maxHeight: '520px',
                              whiteSpace: 'pre',
                              fontSize: '13px',
                              lineHeight: 1.6
                            }}>
                      <code>{fileContent}</code>
                    </pre>
                        )}

                        {!selectedFile && (
                            <p>Choose a file from the list to view its contents here.</p>
                        )}
                      </article>
                    </div>
                )}
              </section>
          )}

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
                <span className="feature-link">Understand code</span>
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
