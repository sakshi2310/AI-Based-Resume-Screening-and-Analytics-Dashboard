# Resume Intelligence Backend Plan

## 1. Backend architecture

Use a layered backend:

- `api/`: thin FastAPI routes for upload, parsing, screening, and evaluation
- `ml/parsers/`: document text extraction from PDF, DOCX, and TXT
- `ml/extractors/`: structured feature extraction such as skills, education, experience, companies, and quality flags
- `ml/scorers/`: ranking logic that combines hard constraints, semantic similarity, skill coverage, and explanation generation
- `ml/evaluators/`: offline benchmarking with both classification and ranking metrics
- `db/`: MongoDB connection plus collection access
- `workers/`: Celery async jobs for heavy parsing, batch screening, and later retraining workflows
- `config/`: all environment-based settings in one place

This keeps the API independent from the model logic, which matters when you later replace heuristics with a trained ranker.

## 2. ML and NLP approach

Recommended roadmap:

1. Resume parsing:
   Start with file text extraction plus structured feature extraction. Add spaCy NER later for entities like skills, degree names, organizations, and job titles.
2. Screening:
   Treat screening as a ranking problem, not only a similarity problem. Recruiters care about ordering candidates for a job, so optimize ranking metrics such as `MRR`, `MAP@K`, and `NDCG@K`.
3. Matching:
   Combine three signals:
   - hard filters: experience range, mandatory skills, location if required
   - sparse lexical features: explicit keyword and skill matches
   - dense semantic features: transformer embeddings or a cross-encoder reranker
4. Explanations:
   Generate recruiter-facing explanations with Gemini or OpenAI only after scoring. Keep the LLM out of the critical ranking logic.

For model choice:

- Start with pretrained models first
- Use `sentence-transformers` for dense retrieval
- Add a cross-encoder later for reranking top candidates
- Train your own model only after collecting labeled recruiter decisions

## 3. Feature engineering

Important features:

- normalized skills and skill coverage against job requirements
- years of experience, recent role titles, and company history
- degree level, major, certifications
- project keywords and domain keywords
- section quality and extraction confidence
- semantic embedding of summary, experience, and full resume excerpt

Representation strategy:

- structured tabular features for hard constraints and interpretable scoring
- dense embeddings for semantic matching
- optional sparse TF-IDF features for lexical coverage and fallback behavior

## 4. Evaluation

Evaluate by use case:

- Parsing quality:
  entity-level precision, recall, and F1 for skills, education, experience, and contact fields
- Binary shortlist classification:
  accuracy, precision, recall, F1, and confusion matrix
- Ranking quality:
  `Precision@K`, `Recall@K`, `MRR`, `MAP@K`, and `NDCG@K`

To prove the new system beats the rule-based baseline:

1. Build a labeled benchmark set from historical recruiter decisions
2. Run the old rule-based system and save its predictions
3. Run the new pipeline on the same benchmark
4. Compare metrics side by side and report relative lift
5. Review failure cases manually to show where semantic and learned signals help

## 5. Improvement strategy

- Log recruiter actions such as shortlisted, rejected, interviewed, and hired
- Turn those actions into labels for retraining
- Add active learning so reviewers label uncertain candidates first
- Keep a resume normalization layer to handle OCR noise and inconsistent formatting
- Add confidence flags when parsing quality is poor, and route those cases to manual review
- Version datasets and models with MLflow before changing production scoring

## 6. Step-by-step implementation path

1. Stabilize parsing and feature extraction
2. Keep the current hybrid scorer as a strong baseline
3. Collect labeled job-candidate outcomes from real reviews
4. Train a learning-to-rank or classification model on top of extracted features
5. Add a reranking stage for top candidates only
6. Benchmark every change against the saved rule-based baseline

## 7. Current code status

This backend now includes:

- FastAPI app entrypoint
- MongoDB connection and indexes
- upload parsing endpoints
- text screening endpoint
- hybrid scoring pipeline
- evaluation endpoints for classification and ranking
- Celery task scaffolding

Next recommended upgrade:

- add spaCy custom NER for domain entities
- build a labeled dataset from recruiter actions
- train a reranker for top candidate ordering
