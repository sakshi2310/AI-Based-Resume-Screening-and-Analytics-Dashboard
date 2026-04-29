from __future__ import annotations

import pytest

from config.settings import get_settings
from ml.extractors.resume_features import ResumeFeatureExtractor
from ml.scorers.hybrid_scorer import HybridResumeJobScorer
from ml.scorers.status_recommender import ResumeStatusRecommender
from models.job import JobCreate


@pytest.fixture(autouse=True)
def disable_transformer_similarity(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENABLE_TRANSFORMER_SIMILARITY", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def build_job(**overrides) -> JobCreate:
    payload = {
        "title": "AI/ML Engineer",
        "department": "Engineering",
        "location": "Remote",
        "employment_type": "Full-time",
        "work_mode": "Remote",
        "experience_level": "Mid",
        "min_experience_years": 0,
        "max_experience_years": None,
        "openings": 1,
        "salary_range": None,
        "description": "AI/ML Engineer with Python, Machine Learning, Deep Learning, NLP, LangChain, SQL, Docker, and FastAPI.",
        "responsibilities": ["Build APIs", "Deploy models"],
        "requirements": ["Strong Python", "Production-ready ML systems"],
        "skills": ["Python", "Machine Learning", "Deep Learning", "NLP", "LangChain", "SQL", "Docker", "FastAPI"],
        "qualifications": ["Bachelors or Masters in Computer Science, IT, or Data Science"],
        "benefits": [],
        "is_active": True,
    }
    payload.update(overrides)
    return JobCreate(**payload)


def test_extractor_estimates_experience_from_date_ranges():
    parsed = ResumeFeatureExtractor().extract(
        """
        Jane Doe
        Skills
        Python
        SQL
        Experience
        ML Intern at Example Labs
        Jan 2023 - Dec 2024
        Built NLP pipelines for screening.
        Education
        Bachelor of Computer Science
        """
    )

    assert parsed.experience_years == 2.0


def test_extractor_reads_technical_skills_section_with_grouped_labels():
    parsed = ResumeFeatureExtractor().extract(
        """
        Candidate Name
        TECHNICAL SKILLS
        Programming
        Python, SQL
        Data Analysis
        Pandas, NumPy, Excel
        Data Visualization
        Power BI, Matplotlib, Seaborn
        Databases
        MySQL
        Tools
        Git, Jupyter Notebook
        """
    )

    assert "python" in parsed.normalized_skills
    assert "sql" in parsed.normalized_skills
    assert "pandas" in parsed.normalized_skills
    assert "numpy" in parsed.normalized_skills
    assert "excel" in parsed.normalized_skills
    assert "power bi" in parsed.normalized_skills
    assert "matplotlib" in parsed.normalized_skills
    assert "seaborn" in parsed.normalized_skills
    assert "mysql" in parsed.normalized_skills
    assert "git" in parsed.normalized_skills
    assert "jupyter notebook" in parsed.normalized_skills


def test_extractor_supports_resume_alias_headers_and_data_engineering_skills():
    parsed = ResumeFeatureExtractor().extract(
        """
        Candidate Name
        PROFILE SUMMARY
        Aspiring data engineer with Python, SQL, Snowflake, Airflow, and dbt exposure.
        TECHNICAL SKILL
        Frameworks & Libraries : Pandas, NumPy, Apache Spark, PySpark
        Tools and Technologies : Snowflake, Databricks, Apache Airflow, DBT, Azure Data Factory, ADLS Gen2
        Concepts : ETL Pipelines, Data Modeling, Data Warehousing
        PROJECT
        Built a batch ETL workflow.
        CERTIFICATIONS
        Some certificate
        """
    )

    assert parsed.summary is not None and "Aspiring data engineer" in parsed.summary
    assert "snowflake" in parsed.normalized_skills
    assert "airflow" in parsed.normalized_skills
    assert "dbt" in parsed.normalized_skills
    assert "pyspark" in parsed.normalized_skills
    assert "azure data factory" in parsed.normalized_skills
    assert "adls gen2" in parsed.normalized_skills
    assert "etl" in parsed.normalized_skills


def test_scorer_rewards_majority_skill_matches_without_harsh_unknown_experience_penalty():
    job = build_job(min_experience_years=0)
    parsed = ResumeFeatureExtractor().extract(
        """
        Jane Doe
        Summary
        AI/ML candidate with Python, Machine Learning, Deep Learning, NLP, LangChain, SQL, and Docker experience.
        Skills
        Python
        Machine Learning
        Deep Learning
        NLP
        LangChain
        SQL
        Docker
        Education
        Master of Science in Data Science
        """
    )

    score = HybridResumeJobScorer().score(parsed, job)

    assert len(score.matched_skills) == 7
    assert score.skill_score >= 75.0
    assert score.experience_score >= 70.0
    assert score.profile_score > 0.0
    assert score.final_score >= 70.0


def test_status_recommender_uses_score_signals_for_shortlist_without_personal_fields():
    job = build_job(min_experience_years=2)
    parsed = ResumeFeatureExtractor().extract(
        """
        Jane Doe
        jane@example.com
        Pune, India
        Summary
        AI/ML engineer with Python, Machine Learning, Deep Learning, NLP, LangChain, SQL, Docker, and FastAPI.
        Skills
        Python
        Machine Learning
        Deep Learning
        NLP
        LangChain
        SQL
        Docker
        FastAPI
        Education
        Master of Science in Data Science
        Experience
        2 years experience in AI/ML engineering
        """
    )

    score = HybridResumeJobScorer().score(parsed, job)
    recommendation = ResumeStatusRecommender().recommend(score)

    assert recommendation.status == "Shortlisted"
    assert "ignores name, email, phone, and location" in recommendation.fairness_note


def test_status_recommender_shortlists_scores_at_or_above_seventy():
    recommendation = ResumeStatusRecommender().recommend(
        HybridResumeJobScorer().score(
            ResumeFeatureExtractor().extract(
                """
                Alex Candidate
                Summary
                Data analyst with Python, SQL, Power BI, Excel, statistics, dashboards, and reporting work.
                Skills
                Python
                SQL
                Power BI
                Excel
                Statistics
                Data Visualization
                Education
                Bachelor of Computer Applications
                Experience
                1 year experience in analytics
                """
            ),
            build_job(
                title="Junior Data Analyst",
                min_experience_years=0,
                skills=["Python", "SQL", "Power BI", "Excel", "Statistics", "Data Visualization"],
            ),
        )
    )

    assert recommendation.status == "Shortlisted"
