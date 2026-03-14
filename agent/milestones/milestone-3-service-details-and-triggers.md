# Milestone 3: Service Details & Triggers

**Goal**: Add read-only tools for Cloud Run service details, revision history, and Cloud Build triggers
**Duration**: 1 week
**Dependencies**: M2
**Status**: Not Started

---

## Overview

These are the most useful companion tools to the existing set. Developers frequently need to inspect a specific service's config (env vars, scaling, traffic splits), check revision history for recent deploys, and see what triggers exist and how they're configured. All follow the same read-only, ADC-auth pattern.

---

## Deliverables

### 1. Cloud Run Service Details
- `gcloud_get_service` — full service details (URL, env vars, resource limits, scaling config, traffic splits, IAM policy)

### 2. Cloud Run Revision History
- `gcloud_list_revisions` — list revisions for a service (deployment history, image tags, creation times)

### 3. Cloud Build Triggers
- `gcloud_list_triggers` — list all Cloud Build triggers in a project
- `gcloud_get_trigger` — get trigger config (repo, branch filter, build config, substitutions)

---

## Success Criteria

- [ ] `gcloud_get_service` returns full service config including env vars, scaling, and traffic
- [ ] `gcloud_list_revisions` returns revision history for a service
- [ ] `gcloud_list_triggers` returns all triggers in a project
- [ ] `gcloud_get_trigger` returns full trigger configuration
- [ ] All tools accept optional `projectId` parameter
- [ ] All tools registered in both server.ts and server-factory.ts
- [ ] `npm run build` and `npm run typecheck` pass
- [ ] README updated with new tool docs

---

## Tasks

1. Task 8: Implement gcloud_get_service
2. Task 9: Implement gcloud_list_revisions
3. Task 10: Implement Cloud Build trigger tools (list + get)
4. Task 11: Update README and server registrations

---

**Next Milestone**: [Milestone 4: Jobs, Artifacts & Secrets](milestone-4-jobs-artifacts-and-secrets.md)
**Blockers**: None
