/**
 * pages/Candidates.tsx
 * ====================
 * Rule-based getWeightedMatchScore() REMOVED.
 * Scores now come directly from resume.ai_score (backend AI pipeline).
 * All UI layout, table, status dropdowns unchanged.
 */

import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getJobs, getResumes, getResumeFinalScore, updateResumeStatus, type Job, type ResumeRecord, type CandidateStatus } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const statusColors: Record<CandidateStatus, string> = {
  New:             "bg-info/20 text-info",
  "Under Review":  "bg-warning/20 text-warning",
  Shortlisted:     "bg-success/20 text-success",
  Rejected:        "bg-destructive/20 text-destructive",
  Interviewed:     "bg-primary/20 text-primary",
};

const statusOptions: CandidateStatus[] = ["New", "Under Review", "Shortlisted", "Rejected", "Interviewed"];

const Candidates = () => {
  const { session } = useAuth();
  const [resumes, setResumes]     = useState<ResumeRecord[]>([]);
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [loading, setLoading]     = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
        toast.error(error instanceof Error ? error.message : "Unable to load candidates");
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

        // ── AI scores from backend (sentence-transformers) ─────────────────
        const ai = resume.ai_score;
        const totalScore          = Math.round(getResumeFinalScore(resume));
        const skillScore          = ai ? Math.round(ai.skill_score) : 0;
        const matchedSkills       = ai ? ai.matched_skills : [];
        const missingSkills       = ai ? ai.missing_skills : [];
        const experienceLabel     = resume.parsed_data?.experience_years == null ? "Not detected" : `${resume.parsed_data.experience_years} yrs`;
        const aiRecommendedStatus = resume.ai_recommended_status;

        return { resume, job, totalScore, skillScore, matchedSkills, missingSkills, experienceLabel, aiRecommendedStatus };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [resumes, jobs]);

  const handleStatusChange = async (resumeId: string, candidateStatus: CandidateStatus) => {
    if (!session?.access_token) return;
    setUpdatingId(resumeId);
    try {
      const updated = await updateResumeStatus(session.access_token, resumeId, candidateStatus);
      setResumes((curr) => curr.map((r) => (r.id === updated.id ? updated : r)));
      toast.success("Candidate status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update candidate status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            AI semantic matching: Skills + Experience + Education + Profile
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">
            Loading candidates...
          </div>
        ) : (
          <div className="glass-card overflow-hidden animate-fade-in">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Job</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Skills Match</th>
                  <th className="p-4">Experience</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(({ resume, job, totalScore, skillScore, matchedSkills, missingSkills, experienceLabel, aiRecommendedStatus }) => {
                  const candidateName  = resume.parsed_data?.name  ?? resume.original_filename;
                  const candidateEmail = resume.parsed_data?.email ?? "—";
                  const hasAiScore     = !!resume.ai_score;

                  return (
                    <tr key={resume.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">

                      {/* Candidate name + email */}
                      <td className="p-4">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground">{candidateName}</p>
                            {hasAiScore && (
                              <Sparkles className="w-3 h-3 text-cyan-400" title="AI scored" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{candidateEmail}</p>
                        </div>
                      </td>

                      {/* Job title */}
                      <td className="p-4 text-sm text-muted-foreground">
                        {job?.title || resume.job_title || "Unmapped"}
                      </td>

                      {/* AI Score */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            totalScore >= 85 ? "text-success"
                            : totalScore >= 70 ? "text-warning"
                            : "text-destructive"
                          }`}>
                            {totalScore}%
                          </span>
                          <Progress value={totalScore} className="w-16 h-1.5" />
                        </div>
                      </td>

                      {/* Skills tags */}
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap max-w-[240px]">
                          {matchedSkills.slice(0, 3).map((skill) => (
                            <Badge key={skill} variant="outline" className="text-[10px] border-success/30 text-success">
                              {skill}
                            </Badge>
                          ))}
                          {missingSkills.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                              -{missingSkills.length}
                            </Badge>
                          ) : matchedSkills.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                              All matched
                            </Badge>
                          ) : null}
                        </div>
                      </td>

                      {/* Experience */}
                      <td className="p-4 text-sm text-muted-foreground">{experienceLabel}</td>

                      {/* Status dropdown */}
                      <td className="p-4">
                        <div className="space-y-2">
                          <Select
                            value={resume.candidate_status}
                            onValueChange={(v) => handleStatusChange(resume.id, v as CandidateStatus)}
                            disabled={updatingId === resume.id}
                          >
                            <SelectTrigger className="min-w-[140px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge className={`border-0 text-xs ${statusColors[resume.candidate_status]}`}>
                            {resume.candidate_status}
                          </Badge>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Candidates;
