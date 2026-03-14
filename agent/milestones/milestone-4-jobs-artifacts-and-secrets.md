# Milestone 4: Jobs, Artifacts & Secrets

**Goal**: Add read-only tools for Cloud Run Jobs, Artifact Registry, and Secret Manager
**Duration**: 1 week
**Dependencies**: M2
**Status**: Not Started

---

## Overview

Expands gcloud-mcp coverage to additional GCP services. Cloud Run Jobs are used for batch workloads, Artifact Registry stores container images, and Secret Manager holds secrets. These tools provide read-only visibility into these services without requiring developers to switch to the GCP Console.

---

## Deliverables

### 1. Cloud Run Jobs
- `gcloud_list_jobs` — list Cloud Run Jobs in a region
- `gcloud_get_job_execution` — get job execution status, logs, and timing

### 2. Artifact Registry
- `gcloud_list_artifacts` — list container images in a repository (tags, digests, push times)

### 3. Secret Manager
- `gcloud_list_secrets` — list secret names and metadata (NOT values)

---

## Success Criteria

- [ ] `gcloud_list_jobs` returns Cloud Run Jobs with status and schedule
- [ ] `gcloud_get_job_execution` returns execution details and logs
- [ ] `gcloud_list_artifacts` returns images with tags and timestamps
- [ ] `gcloud_list_secrets` returns secret names without exposing values
- [ ] All tools accept optional `projectId` parameter
- [ ] New GCP dependencies installed (`@google-cloud/artifact-registry`, `@google-cloud/secret-manager`)
- [ ] `npm run build` and `npm run typecheck` pass

---

## Tasks

1. Task 12: Implement Cloud Run Jobs tools (list + get execution)
2. Task 13: Implement gcloud_list_artifacts
3. Task 14: Implement gcloud_list_secrets
4. Task 15: Update README and server registrations

---

**Next Milestone**: [Milestone 5: Write Operations](milestone-5-write-operations.md)
**Blockers**: None
