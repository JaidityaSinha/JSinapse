
import { useEffect, useRef, useState } from 'react'
import './App.css'
import CodeGalaxy, { type CodeGraph, type GraphNode } from './CodeGalaxy'

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

type CallChainData = {
  method: GraphNode
  calls: GraphNode[]
  calledBy: GraphNode[]
}

type View = 'overview' | 'galaxy' | 'dependencies'

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [repository, setRepository] = useState<Repository | null>(null)
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [fileContentLoading, setFileContentLoading] = useState(false)
  const fileRequestId = useRef(0)
  const graphRequestId = useRef(0)
  const [fileSearch, setFileSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [error, setError] = useState('')

  const [view, setView] = useState<View>('overview')
  const [graph, setGraph] = useState<CodeGraph | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState('')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dependencyFile, setDependencyFile] = useState('')
  const [dependencySearch, setDependencySearch] = useState('')
  const [dependencyFileSearch, setDependencyFileSearch] = useState('')
  const [dependencyPickerOpen, setDependencyPickerOpen] = useState(false)
  const [dependencyPreviewPath, setDependencyPreviewPath] = useState('')
  const [dependencyDirection, setDependencyDirection] = useState<'both' | 'outgoing' | 'incoming'>('both')
  const [callChain, setCallChain] = useState<CallChainData | null>(null)
  const [callChainLoading, setCallChainLoading] = useState(false)
  const [callChainError, setCallChainError] = useState('')

  const connectedComponents =
      graph && selectedNode
          ? graph.relationships
              .filter(
                  relationship =>
                      relationship.sourceId === selectedNode.id ||
                      relationship.targetId === selectedNode.id
              )
              .flatMap(relationship => {
                const isOutgoing =
                    relationship.sourceId === selectedNode.id

                const connectedId = isOutgoing
                    ? relationship.targetId
                    : relationship.sourceId

                const connectedNode = graph.nodes.find(
                    node => node.id === connectedId
                )

                if (!connectedNode) return []

                return [{
                  node: connectedNode,
                  relationship: relationship.type,
                  direction: isOutgoing ? 'OUTGOING' as const : 'INCOMING' as const,
                }]
              })
          : []

  useEffect(() => {
    if (
        !repository ||
        !selectedNode ||
        !['METHOD', 'FUNCTION'].includes(selectedNode.type)
    ) {
      setCallChain(null)
      setCallChainError('')
      setCallChainLoading(false)
      return
    }

    const selectedMethod = selectedNode
    const [owner, repo] = repository.full_name.split('/')

    if (!owner || !repo) return

    const methodId = selectedMethod.id
    let cancelled = false

    async function loadCallChain() {
      setCallChainLoading(true)
      setCallChainError('')
      setCallChain(null)

      try {
        const params = new URLSearchParams({
          owner,
          repo,
          methodId,
        })

        const response = await fetch(
            `http://localhost:8080/api/analysis/call-chain?${params}`
        )

        if (!response.ok) {
          throw new Error(
              `Call-chain request failed (${response.status}).`
          )
        }

        const data: CallChainData = await response.json()

        if (!cancelled) {
          setCallChain(data)
        }
      } catch (err) {
        if (!cancelled) {
          setCallChainError(
              err instanceof Error
                  ? err.message
                  : 'Could not load call chain.'
          )
        }
      } finally {
        if (!cancelled) {
          setCallChainLoading(false)
        }
      }
    }

    void loadCallChain()

    return () => {
      cancelled = true
    }
  }, [repository, selectedNode])

  async function analyzeRepository() {
    setError('')
    setFileError('')
    setGraphError('')
    setRepository(null)
    setSourceFiles([])
    setSelectedFile('')
    setFileContent('')
    setFileContentLoading(false)
    fileRequestId.current += 1
    graphRequestId.current += 1
    setGraphLoading(false)
    setGraph(null)
    setSelectedNode(null)
    setDependencyFile('')
    setDependencySearch('')
    setDependencyFileSearch('')
    setDependencyPickerOpen(false)
    setDependencyPreviewPath('')
    setDependencyDirection('both')
    setCallChain(null)
    setCallChainError('')
    setView('overview')

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
      setError('Enter a valid public GitHub repository URL.')
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
          throw new Error(
              `Source file request failed (${filesResponse.status}).`
          )
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

    const requestId = ++fileRequestId.current
    setSelectedFile(path)
    setFileContent('')
    setFileError('')
    setFileContentLoading(true)

    try {
      const response = await fetch(
          `http://localhost:8080/api/github/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`
      )

      if (!response.ok) {
        throw new Error(`Could not load file (${response.status}).`)
      }

      const content = await response.text()
      if (requestId === fileRequestId.current) {
        setFileContent(content)
      }
    } catch (err) {
      if (requestId === fileRequestId.current) {
        setFileError(
            err instanceof Error ? err.message : 'Could not load this file.'
        )
      }
    } finally {
      if (requestId === fileRequestId.current) {
        setFileContentLoading(false)
      }
    }
  }

  async function loadGraph(force = false) {
    setGraphError('')
    if (!repository || (!force && (graph || graphLoading))) return

    const [owner, repo] = repository.full_name.split('/')
    if (!owner || !repo) return

    const requestId = ++graphRequestId.current
    setGraphLoading(true)

    try {
      const response = await fetch(
          `http://localhost:8080/api/analysis/graph?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      )

      if (!response.ok) {
        throw new Error(
            response.status === 403
                ? 'GitHub rate limit exceeded. Check that the backend is using your GitHub token.'
                : `Code analysis failed (${response.status}).`
        )
      }

      const data: CodeGraph = await response.json()
      if (requestId === graphRequestId.current) {
        setGraph(data)
      }
    } catch (err) {
      if (requestId === graphRequestId.current) {
        setGraphError(
            err instanceof Error
                ? err.message
                : 'Could not generate the code graph.'
        )
      }
    } finally {
      if (requestId === graphRequestId.current) {
        setGraphLoading(false)
      }
    }
  }

  async function openGalaxy() {
    setView('galaxy')
    setSelectedNode(null)
    await loadGraph()
  }

  async function openDependencies() {
    setView('dependencies')
    setSelectedNode(null)
    await loadGraph()
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

          <button
              className={`nav-item ${view === 'overview' ? 'active' : ''}`}
              onClick={() => setView('overview')}
          >
            ⌘ Overview
          </button>

          <button
              className={`nav-item ${view === 'galaxy' ? 'active' : ''}`}
              onClick={() => void openGalaxy()}
          >
            ◈ Code Galaxy
          </button>

          <button
              className={`nav-item ${view === 'dependencies' ? 'active' : ''}`}
              onClick={() => void openDependencies()}
          >
            ⌁ Dependencies
          </button>

          <button
              className="nav-item"
              onClick={() => {
                setView('overview')
                document.querySelector<HTMLInputElement>(
                    'input[aria-label="Search source files"]'
                )?.focus()
              }}
          >
            ⌕ Code Search
          </button>

          <div className="sidebar-bottom">
            <div className="status-dot" />
            <span>System operational</span>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div>
              <span className="breadcrumb">Workspace / </span>
              <span>{view === 'galaxy' ? 'Code Galaxy' : view === 'dependencies' ? 'Dependencies' : 'Overview'}</span>
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
                <p role="alert" style={{ color: '#ff8585' }}>
                  {error}
                </p>
            )}

            {repository && (
                <article
                    className="feature-card"
                    style={{ marginTop: '24px', maxWidth: '720px' }}
                >
                  <h3>{repository.full_name}</h3>
                  <p>{repository.description || 'No description provided.'}</p>

                  <div
                      style={{
                        display: 'flex',
                        gap: '20px',
                        flexWrap: 'wrap',
                        marginTop: '16px',
                      }}
                  >
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

          {view === 'galaxy' ? (
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>Code Galaxy</h2>
                    <p>
                      Explore the structure and connections inside your repository.
                    </p>
                  </div>
                  <span className="coming-soon">
                {graph ? `${graph.nodes.length} NODES` : 'INTERACTIVE GRAPH'}
              </span>
                </div>

                {!repository && (
                    <article className="feature-card">
                      <h3>Choose a repository first</h3>
                      <p>
                        Paste a GitHub repository URL above and select Analyze
                        repository to get started.
                      </p>
                    </article>
                )}

                {graphLoading && (
                    <article className="feature-card">
                      <h3>Building your galaxy...</h3>
                      <p>
                        Fetching source code and analyzing relationships. Larger
                        repositories may take a little longer.
                      </p>
                    </article>
                )}

                {graphError && (
                    <article className="feature-card" role="alert">
                      <h3>Could not load the code graph</h3>
                      <p style={{ color: '#ff8585' }}>{graphError}</p>
                      <button
                          className="analyze-button"
                          onClick={() => {
                            setGraph(null)
                            void openGalaxy()
                          }}
                      >
                        Retry analysis
                      </button>
                    </article>
                )}

                {graph && !graphLoading && (
                    <>
                      {graph.nodes.length === 0 ? (
                          <article className="feature-card">
                            <h3>No supported code found</h3>
                            <p>
                              The current parser supports Java source files. Try a
                              repository containing Java classes and methods.
                            </p>
                          </article>
                      ) : (
                          <>
                            <CodeGalaxy
                                graph={graph}
                                onSelectNode={setSelectedNode}
                                focusNodeId={selectedNode?.id ?? null}
                            />

                            {selectedNode && (
                                <article
                                    className="feature-card"
                                    style={{ marginTop: '16px' }}
                                >
                                  <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        alignItems: 'start',
                                      }}
                                  >
                                    <div>
                                      <div className="eyebrow">
                                        {selectedNode.type}
                                      </div>
                                      <h3 style={{ overflowWrap: 'anywhere' }}>
                                        {selectedNode.name}
                                      </h3>
                                    </div>
                                    <button
                                        className="nav-item"
                                        onClick={() => setSelectedNode(null)}
                                    >
                                      Close ✕
                                    </button>
                                  </div>

                                  <p style={{ overflowWrap: 'anywhere' }}>
                                    {selectedNode.filePath}
                                  </p>

                                  {selectedNode.startLine != null && (
                                      <p>
                                        Lines {selectedNode.startLine}
                                        {selectedNode.endLine != null &&
                                            `–${selectedNode.endLine}`}
                                      </p>
                                  )}

                                  <div style={{ marginTop: '20px' }}>
                                    {['METHOD', 'FUNCTION'].includes(selectedNode.type) && (
                                        <div style={{ marginBottom: '24px' }}>
                                          <h4
                                              style={{
                                                color: '#cbd5e1',
                                                marginBottom: '10px',
                                              }}
                                          >
                                            Call Chain
                                          </h4>

                                          {callChainLoading && (
                                              <p>Tracing method calls...</p>
                                          )}

                                          {callChainError && (
                                              <p
                                                  role="alert"
                                                  style={{ color: '#ff8585' }}
                                              >
                                                {callChainError}
                                              </p>
                                          )}

                                          {!callChainLoading &&
                                              !callChainError &&
                                              callChain && (
                                                  <>
                                                    {([
                                                      {
                                                        title: 'Calls',
                                                        nodes: callChain.calls,
                                                      },
                                                      {
                                                        title: 'Called by',
                                                        nodes: callChain.calledBy,
                                                      },
                                                    ]).map(group => (
                                                        <div
                                                            key={group.title}
                                                            style={{ marginBottom: '16px' }}
                                                        >
                                                          <h5
                                                              style={{
                                                                color: '#94a3b8',
                                                                marginBottom: '8px',
                                                              }}
                                                          >
                                                            {group.title} ({group.nodes.length})
                                                          </h5>

                                                          {group.nodes.length === 0 ? (
                                                              <p
                                                                  style={{
                                                                    color: '#64748b',
                                                                    fontSize: '13px',
                                                                  }}
                                                              >
                                                                No resolved methods found.
                                                              </p>
                                                          ) : (
                                                              <div
                                                                  style={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '6px',
                                                                  }}
                                                              >
                                                                {group.nodes.map(node => (
                                                                    <button
                                                                        key={node.id}
                                                                        onClick={() =>
                                                                            setSelectedNode(node)
                                                                        }
                                                                        style={{
                                                                          textAlign: 'left',
                                                                          padding: '10px 12px',
                                                                          borderRadius: '8px',
                                                                          border: '1px solid #303647',
                                                                          background: '#101722',
                                                                          color: '#e2e8f0',
                                                                          cursor: 'pointer',
                                                                          overflowWrap: 'anywhere',
                                                                        }}
                                                                    >
                                                                      <strong>{node.name}</strong>
                                                                      <span
                                                                          style={{
                                                                            display: 'block',
                                                                            color: '#94a3b8',
                                                                            fontSize: '11px',
                                                                            marginTop: '4px',
                                                                          }}
                                                                      >
                                                  {node.type} · {node.filePath}
                                                </span>
                                                                    </button>
                                                                ))}
                                                              </div>
                                                          )}
                                                        </div>
                                                    ))}
                                                  </>
                                              )}
                                        </div>
                                    )}

                                    <h4
                                        style={{
                                          color: '#cbd5e1',
                                          marginBottom: '10px',
                                        }}
                                    >
                                      Connected components
                                    </h4>

                                    {connectedComponents.length === 0 ? (
                                        <p
                                            style={{
                                              color: '#94a3b8',
                                              fontSize: '13px',
                                            }}
                                        >
                                          No connected components found for this node.
                                        </p>
                                    ) : (
                                        <div
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: '8px',
                                            }}
                                        >
                                          {connectedComponents.map((item, index) => (
                                              <button
                                                  key={`${item.node.id}-${item.relationship}-${index}`}
                                                  onClick={() => setSelectedNode(item.node)}
                                                  style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #303647',
                                                    background: '#101722',
                                                    color: '#e2e8f0',
                                                    cursor: 'pointer',
                                                  }}
                                              >
                                  <span
                                      style={{
                                        minWidth: 0,
                                        overflowWrap: 'anywhere',
                                      }}
                                  >
                                    <strong>{item.node.name}</strong>
                                    <span
                                        style={{
                                          display: 'block',
                                          color: '#94a3b8',
                                          fontSize: '11px',
                                          marginTop: '4px',
                                        }}
                                    >
                                      {item.node.type} · {item.direction}
                                    </span>
                                  </span>

                                                <span
                                                    style={{
                                                      color: '#67e8f9',
                                                      fontSize: '10px',
                                                      flexShrink: 0,
                                                    }}
                                                >
                                    {item.relationship}
                                  </span>
                                              </button>
                                          ))}
                                        </div>
                                    )}
                                  </div>

                                  <button
                                      className="analyze-button"
                                      onClick={() => {
                                        setView('overview')
                                        void openFile(selectedNode.filePath)
                                        window.scrollTo({
                                          top: 0,
                                          behavior: 'smooth',
                                        })
                                      }}
                                  >
                                    Open source file ↗
                                  </button>
                                </article>
                            )}
                          </>
                      )}
                    </>
                )}
              </section>
          ) : view === 'dependencies' ? (
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>Dependency Explorer</h2>
                    <p>Inspect which project files depend on one another.</p>
                  </div>
                  <span className="coming-soon">
                    {graph ? `${graph.relationships.filter(edge => edge.type === 'DEPENDS_ON').length} LINKS` : 'FILE DEPENDENCIES'}
                  </span>
                </div>

                {!repository && (
                    <article className="feature-card">
                      <h3>Choose a repository first</h3>
                      <p>Analyze a GitHub repository from Overview to explore its dependencies.</p>
                    </article>
                )}

                {repository && graphLoading && (
                    <article className="feature-card">
                      <h3>Analyzing dependencies...</h3>
                      <p>Resolving imports and building the dependency map.</p>
                    </article>
                )}

                {repository && graphError && !graphLoading && (
                    <article className="feature-card" role="alert">
                      <h3>Could not load dependencies</h3>
                      <p style={{ color: '#ff8585' }}>{graphError}</p>
                      <button className="analyze-button" onClick={() => void loadGraph(true)}>Retry analysis</button>
                    </article>
                )}

                {repository && graph && !graphLoading && !graphError && (() => {
                  const fileNodes = graph.nodes
                      .filter(node => node.type === 'FILE' && node.filePath)
                      .filter((node, index, all) => all.findIndex(candidate => candidate.filePath === node.filePath) === index)
                      .sort((a, b) => a.filePath.localeCompare(b.filePath))
                  const selectedPath = dependencyFile || fileNodes[0]?.filePath || ''
                  const dependencyEdges = graph.relationships.filter(edge => edge.type === 'DEPENDS_ON')
                  type ConnectedDependency = {
                    node: GraphNode
                    direction: 'OUTGOING' | 'INCOMING'
                    source: GraphNode
                  }
                  const allConnected: ConnectedDependency[] = []
                  dependencyEdges.forEach(edge => {
                    const source = fileNodes.find(node => node.id === edge.sourceId)
                    const target = fileNodes.find(node => node.id === edge.targetId)
                    if (!source || !target) return
                    if (source.filePath === selectedPath && dependencyDirection !== 'incoming') {
                      allConnected.push({ node: target, direction: 'OUTGOING', source })
                    }
                    if (target.filePath === selectedPath && dependencyDirection !== 'outgoing') {
                      allConnected.push({ node: source, direction: 'INCOMING', source })
                    }
                  })
                  const connected = allConnected.filter((item: ConnectedDependency) =>
                      item.node.filePath.toLowerCase().includes(dependencySearch.toLowerCase())
                  )
                  return (
                      <>
                        {fileNodes.length === 0 ? (
                            <article className="feature-card">
                              <h3>No file-level dependencies found</h3>
                              <p>The graph contains no file nodes to inspect. Try a repository with supported Java source files.</p>
                            </article>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.85fr) minmax(0, 1.6fr)', gap: '16px', alignItems: 'start' }}>
                              <article className="feature-card" style={{ minWidth: 0 }}>
                                <label htmlFor="dependency-file-search" style={{ display: 'block', marginBottom: '8px', color: '#aeb8cc', fontSize: '13px' }}>Selected source file</label>
                                <div style={{ position: 'relative', marginBottom: '14px' }}>
                                  <input
                                      id="dependency-file-search"
                                      aria-label="Search source files for dependencies"
                                      placeholder="Search and select a source file..."
                                      value={dependencyPickerOpen ? dependencyFileSearch : selectedPath}
                                      onFocus={() => { setDependencyPickerOpen(true); setDependencyFileSearch('') }}
                                      onChange={event => { setDependencyFileSearch(event.target.value); setDependencyPickerOpen(true) }}
                                      onKeyDown={event => {
                                        if (event.key === 'Escape') setDependencyPickerOpen(false)
                                        if (event.key === 'Enter') {
                                          const match = fileNodes.find(node => node.filePath.toLowerCase().includes(dependencyFileSearch.toLowerCase()))
                                          if (match) { setDependencyFile(match.filePath); setDependencySearch(''); setDependencyPickerOpen(false); setDependencyFileSearch('') }
                                        }
                                      }}
                                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #303647', background: '#0b0e16', color: '#fff' }}
                                  />
                                  {dependencyPickerOpen && (
                                      <div style={{ position: 'absolute', zIndex: 10, top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: '260px', overflowY: 'auto', border: '1px solid #303647', borderRadius: '8px', background: '#10131d', boxShadow: '0 12px 28px rgba(0,0,0,.35)' }}>
                                        {fileNodes.filter(node => node.filePath.toLowerCase().includes(dependencyFileSearch.toLowerCase())).slice(0, 100).map(node => (
                                            <button key={node.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setDependencyFile(node.filePath); setDependencySearch(''); setDependencyPickerOpen(false); setDependencyFileSearch('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px', border: 0, borderBottom: '1px solid #252b3a', background: node.filePath === selectedPath ? '#25203d' : 'transparent', color: '#e5e7eb', cursor: 'pointer', overflowWrap: 'anywhere' }}>{node.filePath}</button>
                                        ))}
                                        {fileNodes.filter(node => node.filePath.toLowerCase().includes(dependencyFileSearch.toLowerCase())).length === 0 && <p style={{ margin: 0, padding: '12px', color: '#aeb8cc', fontSize: '13px' }}>No source files match that search.</p>}
                                      </div>
                                  )}
                                </div>
                                <input aria-label="Search dependencies" placeholder="Filter dependency paths..." value={dependencySearch} onChange={event => setDependencySearch(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #303647', background: '#0b0e16', color: '#fff' }} />
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                  {(['both', 'outgoing', 'incoming'] as const).map(direction => <button key={direction} onClick={() => setDependencyDirection(direction)} style={{ border: '1px solid', borderColor: dependencyDirection === direction ? '#8b72ef' : '#303647', background: dependencyDirection === direction ? '#25203d' : '#0b0e16', color: '#e5e7eb', borderRadius: '7px', padding: '7px 9px', cursor: 'pointer', textTransform: 'capitalize' }}>{direction === 'both' ? 'All directions' : direction}</button>)}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#aeb8cc', fontSize: '12px', marginBottom: '8px' }}><span>{connected.length} dependencies</span><span>{dependencyEdges.length} total links</span></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '440px', overflowY: 'auto' }}>
                                  {connected.map((item, index) => <article key={`${item.direction}-${item.node.id}-${index}`} style={{ padding: '10px', borderRadius: '7px', border: '1px solid #303647', background: '#0b0e16', minWidth: 0 }}><strong style={{ display: 'block', fontSize: '12px', fontWeight: 600, overflowWrap: 'anywhere', color: '#e5e7eb' }}>{item.node.filePath}</strong><span style={{ display: 'block', color: item.direction === 'OUTGOING' ? '#67e8f9' : '#c4b5fd', fontSize: '11px', marginTop: '5px' }}>{item.direction === 'OUTGOING' ? 'Selected file depends on this file' : 'This file depends on the selected file'}</span><div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '10px' }}><button type="button" onClick={() => { setDependencyPreviewPath(item.node.filePath); void openFile(item.node.filePath) }} style={{ border: '1px solid #3b82a0', background: '#123043', color: '#a5e7ff', borderRadius: '6px', padding: '6px 9px', cursor: 'pointer', fontSize: '12px' }}>Load preview</button><button type="button" onClick={() => { setDependencyPreviewPath(''); setView('overview'); void openFile(item.node.filePath); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ border: '1px solid #303647', background: '#151a26', color: '#e5e7eb', borderRadius: '6px', padding: '6px 9px', cursor: 'pointer', fontSize: '12px' }}>Show in Source Explorer ↗</button></div></article>)}
                                  {connected.length === 0 && <p style={{ color: '#aeb8cc', fontSize: '13px' }}>No dependencies match this selection and filter.</p>}
                                </div>
                              </article>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                                <article className="feature-card" style={{ minWidth: 0 }}>
                                  <div className="eyebrow">SELECTED FILE</div>
                                  <h3 style={{ overflowWrap: 'anywhere' }}>{selectedPath}</h3>
                                  <p style={{ color: '#aeb8cc' }}>{connected.filter(item => item.direction === 'OUTGOING').length} outgoing · {connected.filter(item => item.direction === 'INCOMING').length} incoming dependencies shown</p>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}><button type="button" onClick={() => { setDependencyPreviewPath(selectedPath); void openFile(selectedPath) }} style={{ border: '1px solid #3b82a0', background: '#123043', color: '#a5e7ff', borderRadius: '7px', padding: '9px 12px', cursor: 'pointer' }}>Load preview</button><button type="button" className="analyze-button" onClick={() => { setDependencyPreviewPath(''); setView('overview'); void openFile(selectedPath); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Show in Source Explorer ↗</button></div>
                                </article>
                                {dependencyPreviewPath && selectedFile === dependencyPreviewPath && (
                                    <article className="feature-card" style={{ minWidth: 0 }}>
                                      <div className="section-heading"><div><h3 style={{ overflowWrap: 'anywhere' }}>{dependencyPreviewPath}</h3><p>Source preview</p></div><button type="button" onClick={() => setDependencyPreviewPath('')} style={{ border: '1px solid #303647', background: '#0b0e16', color: '#cbd5e1', borderRadius: '6px', padding: '6px 9px', cursor: 'pointer' }}>Hide preview</button></div>
                                      {fileContentLoading && <p>Loading file contents...</p>}
                                      {fileError && <p role="alert" style={{ color: '#ff8585' }}>{fileError}</p>}
                                      {!fileContentLoading && !fileError && fileContent !== '' && <pre style={{ marginTop: '12px', padding: '14px', borderRadius: '8px', background: '#090b11', color: '#d8deeb', overflow: 'auto', maxHeight: '460px', whiteSpace: 'pre', fontSize: '12px', lineHeight: 1.6 }}><code>{fileContent}</code></pre>}
                                    </article>
                                )}
                              </div>
                            </div>
                        )}
                      </>
                  )
                })()}
              </section>
          ) : (
              <>
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
                          <p role="alert" style={{ color: '#ff8585' }}>
                            {fileError}
                          </p>
                      )}

                      {!filesLoading &&
                          !fileError &&
                          sourceFiles.length === 0 && (
                              <p>No supported source files or README files were found.</p>
                          )}

                      {sourceFiles.length > 0 && (
                          <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'minmax(220px, 0.8fr) minmax(0, 2fr)',
                                gap: '16px',
                                alignItems: 'start',
                              }}
                          >
                            <article
                                className="feature-card"
                                style={{ minWidth: 0 }}
                            >
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
                                    color: '#ffffff',
                                  }}
                              />

                              <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    maxHeight: '420px',
                                    overflowY: 'auto',
                                  }}
                              >
                                {filteredFiles.map(file => (
                                    <button
                                        key={file.path}
                                        onClick={() => void openFile(file.path)}
                                        style={{
                                          textAlign: 'left',
                                          padding: '10px',
                                          borderRadius: '6px',
                                          border: '1px solid',
                                          borderColor:
                                              selectedFile === file.path
                                                  ? '#8b72ef'
                                                  : 'transparent',
                                          background:
                                              selectedFile === file.path
                                                  ? '#25203d'
                                                  : 'transparent',
                                          color: '#e5e7eb',
                                          cursor: 'pointer',
                                          overflowWrap: 'anywhere',
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

                            <article
                                className="feature-card"
                                style={{ minWidth: 0 }}
                            >
                              <h3 style={{ overflowWrap: 'anywhere' }}>
                                {selectedFile || 'Select a file to preview'}
                              </h3>

                              {selectedFile && fileContentLoading && !fileError && (
                                  <p>Loading file contents...</p>
                              )}

                              {!fileContentLoading && fileContent !== '' && (
                                  <pre
                                      style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        background: '#090b11',
                                        color: '#d8deeb',
                                        overflow: 'auto',
                                        maxHeight: '520px',
                                        whiteSpace: 'pre',
                                        fontSize: '13px',
                                        lineHeight: 1.6,
                                      }}
                                  >
                          <code>{fileContent}</code>
                        </pre>
                              )}

                              {selectedFile && !fileContentLoading && !fileError && fileContent === '' && (
                                  <p>This file is empty.</p>
                              )}

                              {!selectedFile && (
                                  <p>
                                    Choose a file from the list to view its contents here.
                                  </p>
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
                      <p>
                        Explore files and modules as an interactive network of
                        connected nodes.
                      </p>
                      <button
                          className="feature-link"
                          onClick={() => void openGalaxy()}
                      >
                        Explore architecture ↗
                      </button>
                    </article>

                    <article className="feature-card">
                      <div className="feature-icon cyan">⌁</div>
                      <h3>Dependency Explorer</h3>
                      <p>
                        See what depends on what, and understand the impact of changes.
                      </p>
                      <span className="feature-link">Map dependencies ↗</span>
                    </article>

                    <article className="feature-card">
                      <div className="feature-icon orange">⌘</div>
                      <h3>Execution Traces</h3>
                      <p>
                        Follow the path from an entry point through the code it invokes.
                      </p>
                      <span className="feature-link">Trace execution ↗</span>
                    </article>

                    <article className="feature-card">
                      <div className="feature-icon green">✧</div>
                      <h3>AI Code Assistant</h3>
                      <p>
                        Ask questions about your repository and get context-aware explanations.
                      </p>
                      <span className="feature-link">Understand code</span>
                    </article>
                  </div>
                </section>
              </>
          )}

          <footer className="footer">
          <span>
            JSinapse <span className="footer-muted">· Codebase Intelligence</span>
          </span>
            <span>Built to make complex code understandable.</span>
          </footer>
        </main>
      </div>
  )
}

export default App
