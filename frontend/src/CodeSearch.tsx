
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

type SearchMatch = {
    path: string
    lineNumber: number
    line: string
}

type SearchResponse = {
    query: string
    matches: SearchMatch[]
    matchCount: number
    scannedFiles: number
    truncated: boolean
}

type AiSource = {
    path: string
}

type AiResponse = {
    question: string
    answer: string
    sources: AiSource[]
}

type CodeSearchProps = {
    owner: string
    repo: string
    onOpenFile: (path: string) => void
}

export default function CodeSearch({
                                       owner,
                                       repo,
                                       onOpenFile,
                                   }: CodeSearchProps) {
    const [query, setQuery] = useState('')
    const [extension, setExtension] = useState('')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [results, setResults] = useState<SearchResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [aiQuestion, setAiQuestion] = useState('')
    const [aiResult, setAiResult] = useState<AiResponse | null>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState('')

    async function searchCode() {
        if (!owner || !repo) {
            setError('Analyze a repository from Overview first.')
            return
        }

        if (!query.trim()) {
            setError('Enter a search term.')
            return
        }

        setLoading(true)
        setError('')
        setResults(null)

        try {
            const params = new URLSearchParams({
                owner,
                repo,
                query: query.trim(),
                caseSensitive: String(caseSensitive),
            })

            if (extension) {
                params.set('extension', extension)
            }

            const response = await fetch(
                `http://localhost:8080/api/code-search?${params.toString()}`
            )

            if (!response.ok) {
                const body = await response.text()
                throw new Error(body || `Search failed (${response.status}).`)
            }

            const data: SearchResponse = await response.json()
            setResults(data)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not search the repository.'
            )
        } finally {
            setLoading(false)
        }
    }

    async function askAi() {
        if (!owner || !repo) {
            setAiError('Analyze a repository from Overview first.')
            return
        }

        if (!aiQuestion.trim()) {
            setAiError('Enter a question about your code.')
            return
        }

        setAiLoading(true)
        setAiError('')
        setAiResult(null)

        try {
            const params = new URLSearchParams({
                owner,
                repo,
                question: aiQuestion.trim(),
            })

            const response = await fetch(
                `http://localhost:8080/api/ai/search?${params.toString()}`
            )

            if (!response.ok) {
                const body = await response.text()
                throw new Error(
                    body || `AI request failed (${response.status}).`
                )
            }

            const data: AiResponse = await response.json()
            setAiResult(data)
        } catch (err) {
            setAiError(
                err instanceof Error
                    ? err.message
                    : 'Could not get an AI answer.'
            )
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <section className="section">
            <div className="section-heading">
                <div>
                    <h2 className="workspace-title">
                        Code <span>Search.</span>
                    </h2>
                    <p>Search source code or ask questions about your repository.</p>
                </div>
                <span className="coming-soon">REPOSITORY SEARCH</span>
            </div>

            <article className="feature-card">
                <h3 style={{ marginTop: 0 }}>AI Code Assistant</h3>
                <p style={{ color: '#aeb8cc', fontSize: '13px' }}>
                    Ask how your code works, where a feature is implemented,
                    or how different files interact.
                </p>

                <form
                    onSubmit={event => {
                        event.preventDefault()
                        void askAi()
                    }}
                >
                    <label
                        htmlFor="ai-code-question"
                        style={{
                            display: 'block',
                            color: '#aeb8cc',
                            fontSize: '13px',
                            marginBottom: '8px',
                        }}
                    >
                        Ask a question
                    </label>

                    <div
                        style={{
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <input
                            id="ai-code-question"
                            value={aiQuestion}
                            onChange={event => setAiQuestion(event.target.value)}
                            placeholder="e.g. How does WizMonitor detect bulb state changes?"
                            maxLength={500}
                            style={{
                                flex: '1 1 260px',
                                minWidth: 0,
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #303647',
                                background: '#0b0e16',
                                color: '#fff',
                            }}
                        />

                        <button
                            className="analyze-button"
                            type="submit"
                            disabled={aiLoading}
                        >
                            {aiLoading ? 'Thinking...' : 'Ask AI ✦'}
                        </button>
                    </div>
                </form>

                {aiError && (
                    <p role="alert" style={{ color: '#ff8585' }}>
                        {aiError}
                    </p>
                )}

                {aiLoading && (
                    <p style={{ color: '#aeb8cc', marginTop: '16px' }}>
                        Reading repository files and preparing an answer...
                    </p>
                )}

                {aiResult && (
                    <div
                        style={{
                            marginTop: '20px',
                            paddingTop: '16px',
                            borderTop: '1px solid #303647',
                        }}
                    >
                        <h4 style={{ marginTop: 0 }}>Answer</h4>

                        <div
                            className="ai-markdown"
                            style={{
                                color: '#d8deeb',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                lineHeight: 1.75,
                                overflowWrap: 'anywhere',
                            }}
                        >
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => <strong>{children}</strong>,
                                    h2: ({ children }) => <strong>{children}</strong>,
                                    h3: ({ children }) => <strong>{children}</strong>,
                                    h4: ({ children }) => <strong>{children}</strong>,
                                    p: ({ children }) => (
                                        <p style={{ margin: '0 0 12px', fontSize: 'inherit' }}>
                                            {children}
                                        </p>
                                    ),
                                    ul: ({ children }) => (
                                        <ul style={{ margin: '0 0 12px', paddingLeft: '22px' }}>
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol style={{ margin: '0 0 12px', paddingLeft: '22px' }}>
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li style={{ marginBottom: '6px', fontSize: 'inherit' }}>
                                            {children}
                                        </li>
                                    ),
                                    strong: ({ children }) => <strong>{children}</strong>,
                                    em: ({ children }) => <em>{children}</em>,
                                    code: ({ children, className }) => (
                                        <code
                                            className={className}
                                            style={{
                                                fontFamily: 'Consolas, monospace',
                                                fontSize: 'inherit',
                                                color: '#c4b5fd',
                                                background: '#171827',
                                                padding: '2px 5px',
                                                borderRadius: '4px',
                                            }}
                                        >
                                            {children}
                                        </code>
                                    ),
                                    pre: ({ children }) => (
                                        <pre
                                            style={{
                                                margin: '10px 0 16px',
                                                padding: '14px',
                                                background: '#0b0e16',
                                                border: '1px solid #303647',
                                                borderRadius: '8px',
                                                overflowX: 'auto',
                                                whiteSpace: 'pre',
                                                fontSize: 'inherit',
                                            }}
                                        >
                    {children}
                </pre>
                                    ),
                                }}
                            >
                                {aiResult.answer}
                            </ReactMarkdown>
                        </div>


                        {aiResult.sources?.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <h4>Source files</h4>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                    }}
                                >
                                    {aiResult.sources.map(source => (
                                        <button
                                            key={source.path}
                                            type="button"
                                            onClick={() => onOpenFile(source.path)}
                                            style={{
                                                padding: '10px 12px',
                                                border: '1px solid #303647',
                                                borderRadius: '8px',
                                                background: '#0b0e16',
                                                color: '#b6a0ff',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                overflowWrap: 'anywhere',
                                            }}
                                        >
                                            ↗ {source.path}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </article>

            <article className="feature-card" style={{ marginTop: '16px' }}>
                <h3 style={{ marginTop: 0 }}>Keyword Search</h3>
                <p style={{ color: '#aeb8cc', fontSize: '13px' }}>
                    Find exact text across supported source files.
                </p>

                <form
                    onSubmit={event => {
                        event.preventDefault()
                        void searchCode()
                    }}
                >
                    <label
                        htmlFor="code-search-query"
                        style={{
                            display: 'block',
                            color: '#aeb8cc',
                            fontSize: '13px',
                            marginBottom: '8px',
                        }}
                    >
                        Search term
                    </label>

                    <div
                        style={{
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <input
                            id="code-search-query"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="e.g. Pet, getOwner, @RestController"
                            maxLength={200}
                            style={{
                                flex: '1 1 260px',
                                minWidth: 0,
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #303647',
                                background: '#0b0e16',
                                color: '#fff',
                            }}
                        />

                        <button
                            className="analyze-button"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Searching...' : 'Search code ↗'}
                        </button>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: '18px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            marginTop: '16px',
                        }}
                    >
                        <label
                            style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                color: '#cbd5e1',
                                fontSize: '13px',
                            }}
                        >
                            File type
                            <select
                                value={extension}
                                onChange={event => setExtension(event.target.value)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '7px',
                                    border: '1px solid #303647',
                                    background: '#0b0e16',
                                    color: '#fff',
                                }}
                            >
                                <option value="">All supported files</option>
                                <option value=".java">Java</option>
                                <option value=".py">Python</option>
                                <option value=".js">JavaScript</option>
                                <option value=".ts">TypeScript</option>
                                <option value=".tsx">TSX</option>
                                <option value=".cpp">C++</option>
                                <option value=".c">C</option>
                                <option value=".go">Go</option>
                                <option value=".rs">Rust</option>
                            </select>
                        </label>

                        <label
                            style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                color: '#cbd5e1',
                                fontSize: '13px',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={caseSensitive}
                                onChange={event =>
                                    setCaseSensitive(event.target.checked)
                                }
                            />
                            Case-sensitive
                        </label>
                    </div>
                </form>
            </article>

            {error && (
                <article
                    className="feature-card"
                    role="alert"
                    style={{ marginTop: '16px' }}
                >
                    <p style={{ color: '#ff8585' }}>{error}</p>
                </article>
            )}

            {results && (
                <article className="feature-card" style={{ marginTop: '16px' }}>
                    <div className="section-heading">
                        <div>
                            <h3>{results.matchCount} matching lines</h3>
                            <p>
                                Scanned {results.scannedFiles} source files for{' '}
                                <strong>{results.query}</strong>
                            </p>
                        </div>
                    </div>

                    {results.truncated && (
                        <p style={{ color: '#fbbf24', fontSize: '13px' }}>
                            Results may be incomplete because the search reached a limit.
                        </p>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginTop: '16px',
                        }}
                    >
                        {results.matches.map((match, index) => (
                            <article
                                key={`${match.path}:${match.lineNumber}:${index}`}
                                style={{
                                    border: '1px solid #303647',
                                    borderRadius: '8px',
                                    background: '#0b0e16',
                                    padding: '12px',
                                    minWidth: 0,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => onOpenFile(match.path)}
                                    style={{
                                        padding: 0,
                                        border: 0,
                                        background: 'transparent',
                                        color: '#b6a0ff',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        overflowWrap: 'anywhere',
                                        fontWeight: 600,
                                    }}
                                >
                                    {match.path}
                                </button>

                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '10px',
                                        marginTop: '8px',
                                        minWidth: 0,
                                    }}
                                >
                                    <span
                                        style={{
                                            color: '#67e8f9',
                                            flexShrink: 0,
                                            fontSize: '12px',
                                        }}
                                    >
                                        Line {match.lineNumber}
                                    </span>

                                    <pre
                                        style={{
                                            margin: 0,
                                            color: '#d8deeb',
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                            fontSize: '12px',
                                            lineHeight: 1.6,
                                        }}
                                    >
                                        {match.line || '(blank line)'}
                                    </pre>
                                </div>
                            </article>
                        ))}

                        {results.matches.length === 0 && (
                            <p style={{ color: '#aeb8cc' }}>
                                No matches found. Try another term or file type.
                            </p>
                        )}
                    </div>
                </article>
            )}
        </section>
    )
}
