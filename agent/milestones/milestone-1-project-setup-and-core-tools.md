# Milestone 1: Project Setup & Core Tools

**Goal**: Bootstrap the TypeScript MCP server and implement Cloud Build tools + auth diagnostic
**Duration**: 1-2 days
**Dependencies**: None
**Status**: Not Started

---

## Overview

This milestone establishes the project foundation following the mcp-server-starter patterns (bootstrap, server-standalone, tool-creation, config-management, build-config) and implements the Cloud Build tools and gcloud_whoami diagnostic. By the end, the server will be functional via stdio transport with 4 working tools.

---

## Deliverables

### 1. Project Structure
- package.json with ESM, scripts, and metadata
- tsconfig.json for TypeScript 5.x / ES2022
- esbuild.build.js for dual build (server + factory)
- .env.example with GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_REGION
- .gitignore for node_modules, dist, .env
- src/ directory structure (tools/, utils/, types/)

### 2. Standalone Server
- src/server.ts — stdio MCP server with graceful shutdown
- src/config.ts — env var config with validation
- src/utils/logger.ts — stderr JSON logger

### 3. Cloud Build Tools
- src/tools/list-builds.ts — list builds with status/trigger/branch filters
- src/tools/get-build.ts — full build details with per-step timing
- src/tools/get-build-logs.ts — build logs via Cloud Logging API

### 4. Diagnostic Tool
- src/tools/gcloud-whoami.ts — auth verification (project, identity, permissions)

---

## Success Criteria

- [ ] `npm run build` completes without errors
- [ ] `npm run dev` starts server on stdio
- [ ] `list_builds` returns builds from a GCP project
- [ ] `get_build` returns full build details for a specific build ID
- [ ] `get_build_logs` returns log entries for a build
- [ ] `gcloud_whoami` returns current project and identity
- [ ] All tools accept optional `projectId` parameter
- [ ] Permission errors return actionable messages

---

## Key Files to Create

```
gcloud-mcp/
├── package.json
├── tsconfig.json
├── esbuild.build.js
├── .env.example
├── .gitignore
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── error-handler.ts
│   └── tools/
│       ├── list-builds.ts
│       ├── get-build.ts
│       ├── get-build-logs.ts
│       └── gcloud-whoami.ts
└── dist/                    (generated)
```

---

## Tasks

1. [Task 1: Bootstrap Project](../tasks/milestone-1-project-setup-and-core-tools/task-1-bootstrap-project.md) - npm init, dependencies, config files, build system
2. [Task 2: Implement Standalone Server](../tasks/milestone-1-project-setup-and-core-tools/task-2-implement-standalone-server.md) - server.ts, config.ts, logger, error handler
3. [Task 3: Implement Cloud Build Tools](../tasks/milestone-1-project-setup-and-core-tools/task-3-implement-cloud-build-tools.md) - list_builds, get_build, get_build_logs
4. [Task 4: Implement Whoami Tool](../tasks/milestone-1-project-setup-and-core-tools/task-4-implement-whoami-tool.md) - gcloud_whoami diagnostic

---

## Environment Variables

```env
# GCP Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1

# Server Configuration
LOG_LEVEL=info
NODE_ENV=development
```

---

**Next Milestone**: [Milestone 2: Cloud Run Tools & Publishing](milestone-2-cloud-run-tools-and-publishing.md)
**Blockers**: None
