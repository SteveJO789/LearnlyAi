# Development Workflow

## Branch model

```text
main
  ↑
develop
  ↑
feature/*
```

Do not push directly to `main`.

Example branches:

- `feature/12-login-ui`
- `feature/18-learning-session-api`
- `feature/27-rag-retrieval`

## Pull Request requirements

A PR is ready to merge when:

- Build passes
- Relevant tests pass
- No secrets are committed
- Acceptance criteria are satisfied
- API contract changes are documented
- At least one reviewer approves

## Definition of Done

A task is Done only when:

- Implementation is complete
- Basic tests exist where appropriate
- Error states are handled
- Documentation is updated if needed
- PR is reviewed
- Feature works on `develop`

## Work ownership

Each work item has:

- Primary Owner
- Reviewer

Members may choose their preferred workstream. Avoid permanent silos by reviewing another member's area.

## Recommended status flow

Backlog → Ready → In Progress → In Review → Testing → Done
