# Milestone 5: Write Operations

**Goal**: Add write tools for triggering builds, deploying services, and managing traffic
**Duration**: 1-2 weeks
**Dependencies**: M3
**Status**: Not Started

---

## Overview

Adds mutating operations to gcloud-mcp. These tools carry higher risk than read-only tools and should include confirmation mechanisms. Triggering builds, deploying new revisions, and splitting traffic are the most commonly needed write operations for developers and SREs working with Cloud Build and Cloud Run.

---

## Deliverables

### 1. Cloud Build
- `gcloud_run_trigger` — manually trigger a Cloud Build (by trigger ID, with optional substitutions)

### 2. Cloud Run Deployments
- `gcloud_deploy_service` — deploy a new revision (image tag, env vars, scaling config)
- `gcloud_set_traffic` — split traffic between revisions (canary, rollback)

---

## Success Criteria

- [ ] `gcloud_run_trigger` triggers a build and returns the build ID
- [ ] `gcloud_deploy_service` deploys a new revision and returns revision name
- [ ] `gcloud_set_traffic` updates traffic split and returns new traffic config
- [ ] All write tools include clear descriptions of what they modify
- [ ] Error handling covers quota limits, permission issues, and invalid configs
- [ ] All tools accept optional `projectId` parameter
- [ ] `npm run build` and `npm run typecheck` pass

---

## Tasks

1. Task 16: Implement gcloud_run_trigger
2. Task 17: Implement gcloud_deploy_service
3. Task 18: Implement gcloud_set_traffic
4. Task 19: Update README and server registrations

---

**Next Milestone**: None (feature complete)
**Blockers**: None
**Notes**: Write operations require careful error handling and clear tool descriptions to prevent accidental mutations.
