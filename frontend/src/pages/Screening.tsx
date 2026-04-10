import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { getJobs, getResumes, type Job, type ResumeRecord } from "@/lib/api";
import { getWeightedMatchScore } from "@/lib/utils";
import { toast } from "sonner";
import { Brain, CheckCircle, XCircle, Zap } from "lucide-react";

const Screening = () => {
  const { session } = useAuth();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

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
        const matchResult = getWeightedMatchScore(
          resume.parsed_data?.skills,
          resume.parsed_data?.experience_years,
          resume.parsed_data?.education,
          job?.skills,
          job?.min_experience_years,
          job?.max_experience_years,
        );
        return {
          resume,
          job,
          ...matchResult,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [resumes, jobs]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Screening Results</h1>
          <p className="text-muted-foreground mt-1">Fair weighted matching: Skills (40%) + Experience (30%) + Education (20%) + Profile (10%)</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">Loading screening results...</div>
        ) : (
          <div className="space-y-4">
            {candidates.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">No candidates available yet.</div>
            ) : (
              candidates.map(({ resume, job, totalScore, skillScore, experienceScore, educationScore, completenessScore, matchedSkills, missingSkills, breakdown }, idx) => {
                const candidateName = resume.parsed_data?.name || resume.original_filename;
                const applicationJob = job?.title || resume.job_title || "Unmapped role";
                const experience = resume.parsed_data?.experience_years ?? 0;
                const education = resume.parsed_data?.education?.join(", ") || "N/A";
                const isFresher = experience === 0;

                return (
                  <div key={resume.id} className="glass-card p-5 animate-fade-in hover:border-primary/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx < 3 ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-foreground">{candidateName}</h3>
                              {isFresher && (
                                <Badge variant="outline" className="text-[10px] border-warning/50 text-warning gap-1">
                                  <Zap className="w-3 h-3" /> Fresher
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Applied for: {applicationJob}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-3xl font-bold ${
                              totalScore >= 85 ? "text-success" : totalScore >= 70 ? "text-warning" : "text-destructive"
                            }`}>
                              {totalScore}%
                            </span>
                            <Progress value={totalScore} className="w-28 h-2 mt-2" />
                          </div>
                        </div>

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

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" /> Matched JD Skills ({matchedSkills.length})</p>
                            <div className="flex gap-1 flex-wrap">
                              {matchedSkills.length > 0 ? matchedSkills.map((skill) => (
                                <Badge key={skill} variant="outline" className="text-[10px] border-success/30 text-success">{skill}</Badge>
                              )) : <span className="text-xs text-muted-foreground">No matched skills yet</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> Missing JD Skills ({missingSkills.length})</p>
                            <div className="flex gap-1 flex-wrap">
                              {missingSkills.length > 0 ? missingSkills.map((skill) => (
                                <Badge key={skill} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{skill}</Badge>
                              )) : <span className="text-xs text-success">All JD skills matched! 🎉</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span><Brain className="w-3 h-3 inline mr-1" />Experience: {experience} yrs</span>
                          <span>Education: {education}</span>
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border border-border/40">
                          {breakdown}
                        </div>
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
