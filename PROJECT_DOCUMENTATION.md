# AI-Based Resume Screening and Analytics Dashboard — Complete Project Documentation

## 1. PROJECT OVERVIEW

### Project Title
**AI-Based Resume Screening and Analytics Dashboard**

### Objective
To build an end-to-end recruitment support platform that allows recruiters to upload candidate resumes, parse and structure resume content, score candidates against job requirements using an AI-assisted hybrid scoring engine, and manage the hiring workflow from screening to status communication.

### Problem Statement
Manual resume screening is time-consuming, inconsistent, and difficult to scale. Recruiters often face:
- Large volumes of resumes for each role.
- Inconsistent shortlisting decisions due to subjective review.
- Difficulty tracking candidate status and recruiter actions.
- Limited explainability when a candidate is accepted/rejected.

### Proposed Solution
Develop a full-stack web system with:
- A **React-based frontend** for recruiter operations.
- A **FastAPI backend** for authentication, resume upload, parsing, scoring, and workflow APIs.
- A **MongoDB data layer** for users, jobs, resumes, and screening records.
- A **hybrid AI scoring pipeline** that combines rule-based logic + semantic similarity + optional LLM explanation generation.

### Key Features
- JWT-based user authentication and role-aware access (admin, recruiter, viewer).
- Job management module (create, update, activate/deactivate, delete job postings).
- Multi-file resume upload (`.pdf`, `.docx`, `.txt`) with size validation.
- Automatic resume parsing (name, skills, education, experience, projects).
- AI-assisted scoring and candidate recommendation.
- Candidate status lifecycle updates and confirmation.
- Email workflow trigger for confirmed status communication.
- Analytics/reporting pages and screening API endpoints.

---

## 2. SYSTEM ARCHITECTURE

### High-Level Architecture Explanation
The system uses a layered architecture:
1. **Presentation Layer (Frontend)**: Provides UI pages for login, jobs, candidates, uploads, screening, analytics, and reports.
2. **API Layer (FastAPI Routes)**: Receives requests, validates payloads, applies role checks, and orchestrates business operations.
3. **ML Layer**:
   - Document parser (PDF/DOCX/TXT text extraction).
   - Feature extractor (skills, experience, sections, quality flags).
   - Hybrid scorer (skills + experience + education + profile/semantic).
   - Candidate explainer (fallback or LLM-generated explanation).
4. **Data Layer (MongoDB)**: Stores auth users, jobs, uploaded resume records, scoring outputs, and screening logs.

### Component Diagram (Textual)
```text
[Recruiter/Admin User]
        |
        v
[React + Vite Frontend]
  Pages + AuthContext + API Client
        |
        v
[FastAPI Backend]
  |-- Auth Routes (/auth)
  |-- Jobs Routes (/jobs)
  |-- Resume Routes (/resumes)
  |-- Screening Routes (/screening)
  |-- Candidate Routes (/candidates)
        |
        +--------------------------+
        |                          |
        v                          v
[ML Pipeline]                 [MongoDB]
 Parser -> Extractor ->       users, jobs,
 Scorer -> Explainer          resumes, screenings
```

### Flow of Data (Step-by-Step)
1. User logs in through frontend.
2. Frontend stores JWT and calls protected endpoints.
3. Recruiter creates/selects a job posting.
4. Recruiter uploads one or multiple resumes.
5. Backend validates file type/size and stores file.
6. ML parser extracts text from uploaded document.
7. Feature extractor identifies structured candidate details.
8. Hybrid scorer computes score breakdown and skill matches.
9. Explainer generates recruiter-readable summary.
10. Resume record with AI outputs is persisted in MongoDB.
11. Frontend fetches list and displays candidate score/status.
12. Recruiter confirms status; backend triggers background email task.

### Frontend ↔ Backend ↔ AI Model Interaction
```text
Frontend action
   -> API call (HTTP/JSON or multipart)
      -> FastAPI route validates auth + payload
         -> invokes ResumeScreeningPipeline
            -> parse -> extract -> score -> explain
               -> response + persistence
      <- structured JSON response
<- Frontend updates UI tables/cards/charts
```

---

## 3. TECH STACK

### Frontend
- React 18 + TypeScript
- Vite build tool
- React Router
- TanStack React Query
- Tailwind CSS + Radix UI component ecosystem
- Recharts (analytics visualization)

### Backend
- Python + FastAPI
- Pydantic models
- Uvicorn ASGI runtime
- Optional Celery scaffolding for background tasks

### Database
- MongoDB (document database)
- Collections for users, jobs, resumes, and screening results

### AI/ML Models Used
- Custom **hybrid scoring engine** (heuristics + lexical similarity + optional embeddings).
- Optional SentenceTransformer model for embedding-based semantic similarity (config-driven).
- Optional LLM provider integration (Gemini/OpenAI) for textual explanation generation.

### APIs
- **Internal REST APIs** under `/api/v1` for auth, jobs, resumes, screening, and candidates.
- **External APIs (optional)**:
  - OpenAI Responses API (explanations)
  - Google Gemini API (explanations)

### Deployment Tools (Current Readiness)
- Local dev setup documented for frontend/backend.
- CORS and env-driven configuration are already implemented.
- Architecture is deployment-ready for standard containerized cloud hosting.

---

## 4. FRONTEND DETAILS

### UI Structure (Pages/Components)
Main route pages:
- `/login`, `/signup`
- `/` (dashboard/index)
- `/jobs`
- `/candidates`
- `/upload`
- `/screening`
- `/analytics`
- `/search`
- `/reports`
- `/admin`

Shared architecture:
- `AuthProvider` context for authentication state.
- `ProtectedRoute` for guarded pages.
- API utility module with typed request/response models.

### State Management
- **Auth state**: React Context + localStorage persistence.
- **Server state**: React Query (caching, async fetching).
- **UI local state**: per page/component via React hooks.

### API Integration Methods
- Typed client methods in `src/lib/api.ts`.
- Bearer token sent for protected endpoints.
- Health-check probing and fallback API base URL resolution.
- Multipart upload for resume files + job metadata.

### User Flow (Step-by-Step)
1. User signs up/logs in.
2. Token stored in browser localStorage.
3. User accesses protected dashboard routes.
4. Admin/recruiter creates jobs.
5. Recruiter uploads resumes for a selected job.
6. Candidate list populates with parsed/scored records.
7. Recruiter reviews AI score + explanation.
8. Recruiter updates/confirm candidate status.
9. System triggers communication workflow.

---

## 5. BACKEND DETAILS

### API Endpoints (with Purpose)
**Auth (`/api/v1/auth`)**
- `POST /register` → create user and issue JWT.
- `POST /login` → authenticate user and return JWT.
- `GET /me` → get current user profile.
- `GET /users` → admin list users.
- `PATCH /users/{user_id}/role` → admin role update.

**Jobs (`/api/v1/jobs`)**
- `GET /` → list jobs.
- `POST /` → create job.
- `GET /{job_id}` → fetch single job.
- `PUT /{job_id}` → update job.
- `PATCH /{job_id}/status` → activate/deactivate job.
- `DELETE /{job_id}` → delete job.

**Resumes (`/api/v1/resumes`)**
- `GET /` → list resumes with search/filter.
- `POST /upload` → upload, parse, and score resumes.
- `PATCH /{resume_id}/status` → recruiter/manual status update.
- `DELETE /{resume_id}` → delete resume record.

**Screening (`/api/v1/screening`)**
- `POST /parse-upload` → parse uploaded document.
- `POST /score-upload` → score uploaded resume against job payload.
- `POST /score-text` → score plain-text resume.
- `POST /evaluate/classification` → compute classification metrics.
- `POST /evaluate/ranking` → compute ranking metrics.

**Candidates (`/api/v1/candidates`)**
- `POST /{candidate_id}/confirm-status` → lock final status + queue email.
- `POST /{candidate_id}/resend-email` → resend candidate status email.

### Authentication
- JWT token generation at login/register.
- Role-based access control with dependency guards:
  - user-level read
  - staff-level mutation
  - admin-only user management.

### Business Logic
- Upload validation (type/size).
- Job payload normalization.
- Resume parsing + score generation.
- AI recommendation converted to candidate status.
- Manual override capability for recruiter decisions.
- Candidate confirmation triggers background communication task.

### Resume Generation/Processing Pipeline
```text
Upload file -> Validate -> Store file
-> Parse text (pdf/docx/txt)
-> Extract resume features
-> Score against selected job
-> Generate explanation
-> Save full record + return API response
```

---

## 6. AI/ML IMPLEMENTATION

### Model(s) Used
- Deterministic parsing + feature extraction modules.
- Hybrid scoring model combining:
  - skill alignment
  - experience alignment
  - education alignment
  - semantic/profile similarity
- Optional embedding similarity via SentenceTransformer.
- Optional LLM for final recruiter-friendly explanation text.

### Why Chosen
- **Hybrid scoring** gives interpretability for exam/demo use.
- **Embedding toggle** allows improved semantic match without forcing heavy dependencies.
- **LLM explanations are optional**, keeping scoring stable even when external API is unavailable.

### How Resume Content Is Generated/Processed
1. Resume text is extracted from document bytes.
2. Sections such as skills, education, experience are parsed.
3. Regex + lexicon logic captures entities and normalizes skills.
4. Job vs candidate comparison computes match coverage and weighted score.

### Prompt Engineering (If Used)
When LLM explanations are enabled:
- Prompt includes role, candidate name, experience, matched/missing skills, and final score.
- Instruction enforces exactly two concise recruiter-focused sentences.

### Data Preprocessing
- Text normalization, tokenization, section splitting.
- Skill synonym normalization (e.g., `js`→`javascript`, `postgres`→`postgresql`).
- Resume quality flags for short/incomplete extractions.

### Output Formatting
- Final output includes structured score breakdown:
  - `final_score`, `skill_score`, `experience_score`, `education_score`, `profile_score`
  - matched/missing skills
  - strengths/risks
  - explanation and recommendation.

---

## 7. DATABASE DESIGN

### Schema (Collections)
1. **users**
   - email, full_name, password_hash, role, is_active, timestamps
2. **jobs**
   - title, department, location, requirements, skills, qualifications, active flag, creator, timestamps
3. **resumes**
   - original/stored filename, upload metadata, parsed_data, ai_score, ai_explanation, status fields, email tracking
4. **screenings**
   - candidate/job snapshot, score summary, matched/missing skills, full screening payload

### Relationships
- `resumes.job_id` references `jobs._id` (logical relation).
- Resume records link to workflow statuses and recruiter actions.
- Users perform job/resume actions with role-based constraints.

### Example Data Structure (Resume Record)
```json
{
  "original_filename": "candidate1.pdf",
  "job_id": "<ObjectId>",
  "candidate_status": "Shortlisted",
  "parsed_data": {
    "name": "John Doe",
    "skills": ["python", "fastapi", "mongodb"],
    "experience_years": 3.5
  },
  "ai_score": {
    "final_score": 78.4,
    "skill_score": 82.0,
    "experience_score": 75.0
  },
  "ai_explanation": "Candidate demonstrates strong alignment..."
}
```

---

## 8. WORKFLOW (END-TO-END)

```text
User Input
  -> Recruiter logs in and chooses job
  -> Uploads resume(s)
Processing
  -> Backend validates and stores files
  -> Parser extracts text and features
AI Generation
  -> Hybrid scorer compares resume vs job
  -> Explanation engine generates rationale
Output
  -> Candidate score + status + explanation shown in UI
Download/Access
  -> Uploaded resume file is available via static file URL
  -> Recruiter can review and proceed with final decision
```

Stepwise narrative:
1. Recruiter authenticates.
2. Job context is selected/created.
3. Resume uploaded via multipart form.
4. Backend writes file and metadata.
5. Parser handles file type-specific extraction.
6. Extractor identifies skills/experience/education.
7. Scorer computes weighted final score.
8. Result persisted and returned to frontend.
9. Recruiter confirms status and can trigger email communication.

---

## 9. RESULTS & OUTPUT

### Sample Outputs (Descriptive)
- Candidate list with sortable scores and status labels.
- AI explanation text for recruiter support.
- Skill-gap visibility (matched vs missing skills).
- Evaluation endpoints output classification/ranking metrics for benchmarking.

### Performance/Accuracy (Current State)
- System includes metric APIs (`classification`, `ranking`) to evaluate model behavior.
- Supports transparent score decomposition, helping auditors understand why a score was assigned.
- Optional embedding/LLM usage allows balancing speed vs quality.

### Screens (UI Description)
- **Login/Signup**: secure entry and onboarding.
- **Dashboard/Home**: quick operational overview.
- **Jobs**: create/edit/manage openings.
- **Upload Resume**: bulk upload and job association.
- **Candidates**: parsed data, AI score, status actions.
- **Analytics/Reports**: performance and hiring insights visualization.

---

## 10. CHALLENGES & SOLUTIONS

1. **Heterogeneous resume formats**
   - **Challenge**: Parsing consistency across PDF/DOCX/TXT.
   - **Solution**: Multi-parser fallback approach (`pdfplumber` + `pypdf`, `python-docx`) with normalization.

2. **Noisy and inconsistent skill wording**
   - **Challenge**: Same skills written in different forms.
   - **Solution**: Skill lexicon + synonym normalization + fuzzy phrase matching.

3. **Balancing explainability and intelligence**
   - **Challenge**: Pure black-box models reduce examiner trust.
   - **Solution**: Hybrid weighted scoring with clear sub-scores and strengths/risks.

4. **Workflow integrity**
   - **Challenge**: Status must be controlled and auditable.
   - **Solution**: Manual confirmation endpoint, final-status lock, email status tracking.

---

## 11. FUTURE ENHANCEMENTS

- Add advanced NER models for richer entity extraction.
- Introduce learning-to-rank from recruiter feedback data.
- Multi-language resume parsing support.
- Bias/fairness dashboards and compliance audit exports.
- Auto-generated interview question suggestions from skill gaps.
- SSO and enterprise role hierarchy.
- Containerized deployment with CI/CD, monitoring, and model versioning.

---

## 12. CONCLUSION

This project delivers a practical, production-style AI recruitment assistant that combines robust software engineering with transparent AI scoring. It addresses a real hiring pain point by reducing manual screening effort, improving consistency, and preserving recruiter control through interpretable outputs and workflow safeguards. The architecture is modular, academically defensible, and ready for future intelligent enhancements.

---

## 13. PRESENTATION SLIDES CONTENT

## Slide 1: Introduction
**Bullet Points**
- Recruitment teams receive high resume volumes.
- Manual screening is slow and inconsistent.
- Project goal: automate screening with explainable AI.

**Simple Speaking Explanation**
“This project helps recruiters quickly shortlist candidates by automatically parsing resumes and comparing them with job requirements, while still keeping human decision control.”

## Slide 2: Literature Review
**Bullet Points**
- Traditional keyword filtering has low semantic understanding.
- Pure ML/LLM systems can be hard to interpret.
- Hybrid methods provide better balance of performance and transparency.

**Simple Speaking Explanation**
“From prior approaches, we learned that keyword-only systems miss context, and black-box systems are hard to trust. So we used a hybrid design that is both accurate and explainable.”

## Slide 3: System Design & Methodology
**Bullet Points**
- Frontend: React dashboard for recruiter workflow.
- Backend: FastAPI service layer with role-based APIs.
- AI pipeline: Parse → Extract → Score → Explain.
- Database: MongoDB stores operational and AI outputs.

**Simple Speaking Explanation**
“The system is divided into clean layers so each part can evolve independently. The AI pipeline is called from the backend whenever a resume is uploaded or scored.”

## Slide 4: Data Collection & Preprocessing
**Bullet Points**
- Input formats: PDF, DOCX, TXT resumes.
- Text cleaning and section normalization.
- Skill lexicon and synonym mapping.
- Experience/education extraction with rule patterns.

**Simple Speaking Explanation**
“We first convert raw files into clean text, then identify useful sections like skills and experience. This preprocessing is critical because resume formats vary a lot.”

## Slide 5: Model Development
**Bullet Points**
- Hybrid scoring with weighted components:
  - Skills (40%)
  - Experience (30%)
  - Education (20%)
  - Profile/semantic fit (10%)
- Optional transformer similarity.
- Optional LLM-generated recruiter explanation.

**Simple Speaking Explanation**
“Our model is designed for practical use: it generates a final score from multiple interpretable sub-scores. This helps recruiters understand why a candidate ranked higher or lower.”

## Slide 6: Results & Analysis
**Bullet Points**
- Candidate-level score and recommendation output.
- Matched vs missing skills insight.
- Classification and ranking evaluation endpoints available.
- Status confirmation and communication workflow integrated.

**Simple Speaking Explanation**
“The platform does not only score candidates—it supports the full recruiter workflow by tracking status and enabling final communication actions.”

## Slide 7: Conclusion & Future Work
**Bullet Points**
- Achieved scalable and explainable AI resume screening.
- Improved consistency and speed of shortlisting.
- Future: feedback-driven learning-to-rank, fairness analytics, multilingual support.

**Simple Speaking Explanation**
“In summary, this project is academically strong and industry-relevant. It is already functional and can be expanded into an enterprise-grade intelligent hiring platform.”
