# Milestone 2: Cloud Run Tools & Publishing

**Goal**: Implement Cloud Run tools, add server-factory for mcp-auth, and publish to npm
**Duration**: 1-2 days
**Dependencies**: M1 — Project Setup & Core Tools
**Status**: Not Started

---

## Overview

This milestone adds the Cloud Run tools (list_services, get_service_logs), creates the server-factory.ts for mcp-auth multi-tenant wrapping, and publishes the package to npm as `@prmichaelsen/gcloud-mcp`. By the end, the server supports both local stdio and production SSE/HTTP transports.

---

## Deliverables

### 1. Cloud Run Tools
- src/tools/list-services.ts — list Cloud Run services in a region
- src/tools/get-service-logs.ts — service logs with severity/time/revision filters

### 2. Server Factory
- src/server-factory.ts — createServer(accessToken, userId) factory for mcp-auth wrapping
- Dual export in package.json (. and ./factory)

### 3. npm Package
- Published as `@prmichaelsen/gcloud-mcp`
- README.md with installation, Claude Code config, and mcp-auth usage examples
- bin entry for npx execution

---

## Success Criteria

- [ ] `list_services` returns Cloud Run services for a region
- [ ] `get_service_logs` returns logs with severity/time/revision filtering
- [ ] `createServer()` factory works with mcp-auth `wrapServer()`
- [ ] Package published to npm
- [ ] `npx @prmichaelsen/gcloud-mcp` starts server on stdio
- [ ] README has Claude Code config example and mcp-auth usage

---

## Key Files to Create

```
gcloud-mcp/
├── src/
│   ├── server-factory.ts        (new)
│   └── tools/
│       ├── list-services.ts     (new)
│       └── get-service-logs.ts  (new)
└── README.md                    (updated)
```

---

## Tasks

1. [Task 5: Implement Cloud Run Tools](../tasks/milestone-2-cloud-run-tools-and-publishing/task-5-implement-cloud-run-tools.md) - list_services, get_service_logs
2. [Task 6: Create Server Factory](../tasks/milestone-2-cloud-run-tools-and-publishing/task-6-create-server-factory.md) - server-factory.ts + dual export
3. [Task 7: Publish to npm](../tasks/milestone-2-cloud-run-tools-and-publishing/task-7-publish-to-npm.md) - README, package metadata, npm publish

---

**Next Milestone**: None (MVP complete)
**Blockers**: None
