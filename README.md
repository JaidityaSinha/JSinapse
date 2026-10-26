# JSinapse

### Visual Code Intelligence Platform

JSinapse is a visual code intelligence platform designed to help developers explore, understand, and navigate Java codebases through interactive visualizations and source-level analysis.

It transforms repository structures into an interactive map of code elements, dependencies, and method calls, making complex codebases easier to understand.

---

## Features

- **Code Galaxy:** Explore codebases through interactive visualizations of their structure and relationships.
- **Dependency Analysis:** Discover dependencies between files and code elements.
- **Call-Chain Analysis:** Trace method calls and examine execution paths between methods.
- **Code Search:** Search across repository source files.
- **Source Explorer:** Browse source files and inspect code alongside its structural relationships.
- **GitHub Integration:** Analyze source code from GitHub repositories.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Java, Spring Boot |
| Code Parsing | JavaParser |
| Integration | GitHub API |
| Build Tool | Maven |

## Architecture

JSinapse separates code analysis from visualization. The backend parses source files and constructs a graph of code elements and their relationships, which the frontend renders for interactive exploration.

```text
GitHub Repository
       |
       v
 Repository Source Files
       |
       v
 Spring Boot Backend
       |
       v
    JavaParser
       |
       v
 Code Graph
 (Nodes + Relationships)
       |
       v
 React + TypeScript
       |
       v
 Interactive Visualization
```

The analysis engine identifies classes, interfaces, methods, fields, imports, inheritance relationships, method calls, and supported polymorphic dispatch relationships.

## Getting Started

### Prerequisites

- Java JDK
- Maven
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/JaidityaSinha/JSinapse.git
cd JSinapse
```

### 2. Start the backend

Open a terminal in the backend directory:

```bash
cd backend
mvn spring-boot:run
```

The backend should start at `http://localhost:8080` if configured to use the default port.

### 3. Start the frontend

Open a separate terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite.

Configure any required GitHub credentials and environment variables according to your backend configuration. Ensure the frontend points to the correct backend API address.

## Language Support

| Language | Status |
|---|---|
| Java | Supported |
| Python | Planned |
| C++ | Planned |

Java analysis currently uses JavaParser to build a structured representation of source code and resolve supported relationships within the analyzed repository.

Multi-language analysis is planned for future development.

## Roadmap

- [x] Java source parsing and code graph construction
- [x] Interactive code visualization
- [x] Dependency analysis
- [x] Call-chain analysis
- [x] Source exploration and code search
- [ ] Python language support
- [ ] C++ language support
- [ ] Improved cross-file and semantic resolution
- [ ] Expanded repository analysis and scalability

## Vision

JSinapse aims to make complex codebases easier to understand by turning source code into an explorable map of dependencies, relationships, and execution paths.

As software projects grow, understanding how their components interact becomes increasingly difficult. JSinapse seeks to make that process more visual, intuitive, and accessible.

## Contributing

Suggestions, bug reports, and feature ideas are welcome. Open an issue or submit a pull request to contribute.

---

Built to make code easier to understand.
