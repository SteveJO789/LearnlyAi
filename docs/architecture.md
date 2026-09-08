# System Architecture

## High-level architecture

```text
Student
  |
  v
Next.js Frontend
  |
  v
FastAPI Backend
  |
  +--> Authentication / User
  |
  +--> Learning Session Engine
  |      |
  |      +--> Assessment
  |      +--> Learning Workflow
  |
  +--> Input Processing
  |      +--> Text
  |      +--> PDF
  |      +--> Image/OCR
  |
  +--> AI Orchestrator
  |      +--> Prompt Builder
  |      +--> RAG Retriever
  |      +--> Model Provider Adapter
  |      +--> Structured Output Validator
  |
  +--> PostgreSQL + pgvector
  |
  +--> File Storage
```

## Learning workflow

```text
INPUT
  ↓
CONTENT_ANALYSIS
  ↓
PRE_TEST
  ↓
LEARNING
  ↓
TRANSFER
  ↓
POST_TEST
  ↓
COMPLETED
```

The backend controls workflow state deterministically. The LLM adapts or generates learning content inside controlled boundaries.

## Backend modules

- Authentication
- User Management
- Learning Sessions
- Learning State Machine
- Input Processing
- Assessment
- AI Orchestrator
- RAG
- Structured Output Validation
- Learning Profile
- History

## Minimum data entities

- users
- learning_sessions
- messages
- assessments
- assessment_answers
- learning_profiles
- documents
- document_chunks
- ai_requests

## Reliability requirements

- Request validation
- File validation
- AI timeout
- Limited retry policy
- Controlled fallback/error response
- Structured JSON schema validation
- Centralized exception handling
- Health check
- Application and AI request logs
