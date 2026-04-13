/**
 * pages/Screening.tsx
 * ====================
 * Rule-based getWeightedMatchScore() REMOVED completely.
 * All scores come from resume.ai_score (sentence-transformers backend).
 * Gemini AI insight shown per candidate.
 */

import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { getJobs, getResumes, getResumeFinalScore, type Job, type ResumeRecord } from "@/lib/api";
import { toast } from "sonner";
import { Brain, CheckCircle, Sparkles, XCircle, Zap } from "lucide-react";

const Screening = () => {
  const { session } = useAuth();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!session?.access_token) { setLoading(false); return; }
      try {
        const [resumeData, jobData] = await Promise.all([
          getResumes(session.access_token),
          getJobs(session.access_token),
        ]);
        setResumes(resumeData);
        setJobs(jobData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load screening data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [session?.access_token]);

  const candidates = useMemo(() => {
    return resumes
      .map((resume) => {
        const job = jobs.find((item) => item.id === resume.job_id);
        const ai  = resume.ai_score;

        return {
          resume,
          job,
          totalScore:        Math.round(getResumeFinalScore(resume)),
          skillScore:        ai ? Math.round(ai.skill_score)      : 0,
          experienceScore:   ai ? Math.round(ai.experience_score) : 0,
          educationScore:    ai ? Math.round(ai.education_score)  : 0,
          completenessScore: ai ? Math.round(ai.profile_score)    : 0,
          matchedSkills:     ai ? ai.matched_skills                : [],
          missingSkills:     ai ? ai.missing_skills                : [],
          breakdown:         ai ? ai.breakdown                     : "No AI score available — upload resume with a job selected.",
          hasAiScore:        !!ai,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [resumes, jobs]);

  const aiScoredCount = candidates.filter((c) => c.hasAiScore).length;

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Screening Results</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Semantic AI Matching — sentence-transformers (all-MiniLM-L6-v2)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Skills (40%) + Experience (30%) + Education (20%) + Profile (10%)
            </p>
          </div>
          {aiScoredCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 self-start">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-400">{aiScoredCount} AI-scored</span>
            </div>
          )}
        </div>

        {/* ── Candidate cards ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">
            Loading AI screening results...
          </div>
        ) : (
          <div className="space-y-4">
            {candidates.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">
                No candidates yet. Upload resumes and map them to a job to see AI scores.
              </div>
            ) : (
              candidates.map(({
                resume, job,
                totalScore, skillScore, experienceScore, educationScore, completenessScore,
                matchedSkills, missingSkills, breakdown, hasAiScore,
              }, idx) => {
                const candidateName  = resume.parsed_data?.name || resume.original_filename;
                const applicationJob = job?.title || resume.job_title || "Unmapped role";
                const experience     = resume.parsed_data?.experience_years ?? 0;
                const education      = resume.parsed_data?.education?.join(", ") || "N/A";
                const isFresher      = experience === 0;

                return (
                  <div key={resume.id} className="glass-card p-5 animate-fade-in hover:border-primary/30 transition-colors">
                    <div className="flex items-start gap-4">

                      {/* Rank */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        idx < 3 ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                      }`}>
                        #{idx + 1}
                      </div>

                      <div className="flex-1 space-y-3">

                        {/* Name row */}
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-semibold text-foreground">{candidateName}</h3>
                              {isFresher && (
                                <Badge variant="outline" className="text-[10px] border-warning/50 text-warning gap-1">
                                  <Zap className="w-3 h-3" /> Fresher
                                </Badge>
                              )}
                              {hasAiScore && (
                                <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-400 gap-1">
                                  <Sparkles className="w-3 h-3" /> AI
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Applied for: {applicationJob}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-3xl font-bold ${
                              totalScore >= 85 ? "text-success"
                              : totalScore >= 70 ? "text-warning"
                              : "text-destructive"
                            }`}>
                              {totalScore}%
                            </span>
                            <Progress value={totalScore} className="w-28 h-2 mt-2" />
                          </div>
                        </div>

                        {/* Score breakdown */}
                        <div className="grid grid-cols-4 gap-3 text-xs bg-muted/30 rounded p-3">
                          <div>
                            <p className="text-muted-foreground">Skills</p>
                            <p className="text-sm font-bold text-foreground">{skillScore}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Experience</p>
                            <p className="text-sm font-bold text-foreground">{experienceScore}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Education</p>
                            <p className="text-sm font-bold text-foreground">{educationScore}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Profile</p>
                            <p className="text-sm font-bold text-foreground">{completenessScore}%</p>
                          </div>
                        </div>

                        {/* Matched / Missing skills */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-success" />
                              Matched JD Skills ({matchedSkills.length})
                            </p>
                            <div className="flex gap-1 flex-wrap">
                              {matchedSkills.length > 0
                                ? matchedSkills.map((s) => (
                                    <Badge key={s} variant="outline" className="text-[10px] border-success/30 text-success">{s}</Badge>
                                  ))
                                : <span className="text-xs text-muted-foreground">No matched skills</span>
                              }
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-destructive" />
                              Missing JD Skills ({missingSkills.length})
                            </p>
                            <div className="flex gap-1 flex-wrap">
                              {missingSkills.length > 0
                                ? missingSkills.map((s) => (
                                    <Badge key={s} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{s}</Badge>
                                  ))
                                : <span className="text-xs text-success">All JD skills matched! 🎉</span>
                              }
                            </div>
                          </div>
                        </div>

                        {/* Experience + Education */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span><Brain className="w-3 h-3 inline mr-1" />Experience: {experience} yrs</span>
                          <span>Education: {education}</span>
                        </div>

                        {/* AI breakdown text */}
                        <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border border-border/40">
                          {breakdown}
                        </div>

                        {/* ── Gemini AI insight ─────────────────────────── */}
                        {resume.ai_explanation && (
                          <div className="flex items-start gap-2 p-3 rounded-lg border border-cyan-500/25 bg-cyan-500/5">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-cyan-400">AI Insight</span>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                {resume.ai_explanation}
                              </p>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Screening;
