# Project Requirements

**Project Name**: gcloud-mcp
**Created**: 2026-03-14
**Status**: Active

---

## Overview

A Google Cloud MCP server that provides tools for interacting with Cloud Build and Cloud Run services. It enables AI agents and web applications to list builds, inspect build details and logs, list Cloud Run services, and retrieve service logs — all through the Model Context Protocol.

---

## Problem Statement

Developers and SREs working with Google Cloud need to frequently check build statuses, read build logs, inspect Cloud Run deployments, and debug service issues. Currently this requires switching between the GCP Console, `gcloud` CLI, and various dashboards. An MCP server that surfaces these capabilities directly to AI agents (via Claude Code locally) and web apps (via SSE transport) eliminates context switching and enables AI-assisted debugging workflows.

---

## Goals and Objectives

### Primary Goals
1. Provide Cloud Build tools: list builds, get build details, get build logs
2. Provide Cloud Run tools: list services, get service logs
3. Support both local (stdio) and web app (SSE/HTTP) transports
4. Support multiple GCP projects via optional `projectId` parameter

### Secondary Goals
1. Provide a `gcloud_whoami` diagnostic tool for verifying auth and permissions
2. Publish as npm package for easy consumption via npx and mcp-auth wrapping
3. Return actionable error messages for permission issues

---

## Functional Requirements

### Core Features
1. **List Builds** (`list_builds`): List Cloud Build builds with optional filters for status, trigger ID, branch name. Default limit 10, max 100. Returns status, duration, source repo/branch, trigger name, start/finish times.
2. **Get Build Details** (`get_build`): Return full build object including steps, substitutions, images, source, and per-step timing breakdown.
3. **Get Build Logs** (`get_build_logs`): Fetch build logs from Cloud Logging API with optional step name filter, tail/limit options. Default 100 lines. Completed logs only for v1.
4. **List Cloud Run Services** (`list_services`): List services in a specified region. Required `region` parameter with `GOOGLE_CLOUD_REGION` env var default. Returns URL, latest revision, status, last deployed timestamp.
5. **Get Service Logs** (`get_service_logs`): Fetch Cloud Run service logs via Cloud Logging API. Supports severity, time range (`since` — default 1 hour), revision filters. Default 50 entries, max 500.
6. **Auth Diagnostic** (`gcloud_whoami`): Return current project, authenticated identity, and available permissions.

### Tool Parameters (Common)
- `projectId` (optional on all tools): GCP project ID. Defaults to `GOOGLE_CLOUD_PROJECT` env var.

---

## Non-Functional Requirements

### Performance
- Tool responses should return within reasonable GCP API latency bounds (no added overhead beyond API calls)

### Security
- Use Application Default Credentials (ADC) for GCP auth — no service account key management in the server
- GCP auth is separate from mcp-auth application-level JWT auth
- Never expose credentials in tool responses

### Reliability
- Graceful error handling for missing GCP permissions with actionable messages
- Clean shutdown on SIGINT/SIGTERM

---

## Technical Requirements

### Technology Stack
- **Language**: TypeScript 5.x
- **Runtime**: Node.js 20+
- **Protocol**: Model Context Protocol (MCP) via `@modelcontextprotocol/sdk` ^1.0.4
- **Build**: esbuild (per mcp-server-starter build-config pattern)
- **Transport**: stdio (standalone) + SSE/HTTP (via mcp-auth wrapping)

### Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `@google-cloud/cloudbuild`: Cloud Build API client
- `@google-cloud/run`: Cloud Run API client
- `@google-cloud/logging`: Cloud Logging API client
- `dotenv`: Environment variable management
- `@prmichaelsen/mcp-auth`: Multi-tenant auth wrapping (peer/optional)

### Architecture
- **Dual export**: `server.ts` (standalone stdio) + `server-factory.ts` (factory for mcp-auth)
- **Per mcp-server-starter patterns**: bootstrap, server-standalone, server-factory, tool-creation, config-management, build-config
- **GCP clients**: Single global instance per client library, `projectId` passed per-request
- **Auth**: ADC everywhere. `GOOGLE_APPLICATION_CREDENTIALS` env var as fallback.

### Configuration
- `GOOGLE_CLOUD_PROJECT`: Default GCP project ID (required)
- `GOOGLE_CLOUD_REGION`: Default Cloud Run region (optional)
- Standard mcp-server-starter config pattern (dotenv, validated at startup)

---

## User Stories

### As a Developer (Claude Code)
1. I want to list recent builds so I can check if my deploy succeeded
2. I want to read build logs so I can debug a failed build without leaving my editor
3. I want to check Cloud Run service status so I can verify my deployment is healthy
4. I want to read service logs so I can debug production issues with AI assistance

### As a Web App User
1. I want to view build statuses across projects so I can monitor CI/CD pipelines
2. I want to filter service logs by severity so I can focus on errors
3. I want to check logs for a specific revision so I can compare behavior across deploys

---

## Constraints

### Technical Constraints
- Cloud Run API requires region-scoped requests (cannot list all regions in one call)
- GCP client libraries require ADC or `authClient` — raw OAuth tokens not supported
- Cloud Build log streaming not included in v1

### Resource Constraints
- Single developer
- MVP-first approach — no prompts, no resources, no streaming in v1

---

## Success Criteria

### MVP Success Criteria
- [ ] All 6 tools implemented and functional (list_builds, get_build, get_build_logs, list_services, get_service_logs, gcloud_whoami)
- [ ] Works via stdio in Claude Code
- [ ] Factory export compatible with mcp-auth wrapping
- [ ] Published to npm as `@prmichaelsen/gcloud-mcp`
- [ ] Error messages are actionable for permission issues

---

## Out of Scope

1. **Streaming/following active build logs**: v1 fetches completed logs only
2. **MCP Resources**: No resource endpoints in v1
3. **MCP Prompts**: No prompt templates in v1
4. **Cloud Run deployment/management**: Read-only — no deploy, scale, or delete operations
5. **Cloud Build trigger management**: Read-only — no creating or running triggers
6. **Multi-region Cloud Run listing**: Region must be specified per request

---

## Key Design Decisions

### Authentication
| Decision | Choice | Rationale |
|---|---|---|
| GCP auth mechanism | ADC (Application Default Credentials) | Works in local dev, Cloud Run, and GCE without key management. GCP client libs don't accept raw OAuth tokens. |
| mcp-auth integration | Separate concern — JWT for app auth, ADC for GCP | accessToken from mcp-auth is for user identity, not GCP credentials |
| Multi-project support | `projectId` as optional tool parameter | Near-zero lift — GCP clients support per-request projectId. Env var as default. |

### Architecture
| Decision | Choice | Rationale |
|---|---|---|
| Transport | Dual: stdio + SSE/HTTP | stdio for Claude Code local, SSE for webapp via mcp-auth wrapping |
| Server pattern | mcp-server-starter dual export | server.ts (standalone) + server-factory.ts (factory) |
| Log source | Cloud Logging API | Consistent across Cloud Build and Cloud Run, supports structured queries |
| Package publishing | `@prmichaelsen/gcloud-mcp` on npm | Enables npx usage and easy mcp-auth wrapping |

---

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io): MCP protocol documentation
- [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth): Authentication framework for MCP servers
- [Cloud Build API](https://cloud.google.com/build/docs/api): Google Cloud Build REST API
- [Cloud Run Admin API](https://cloud.google.com/run/docs/reference/rest): Google Cloud Run REST API
- [Cloud Logging API](https://cloud.google.com/logging/docs/reference/v2/rest): Google Cloud Logging REST API

---

**Status**: Active
**Last Updated**: 2026-03-14
