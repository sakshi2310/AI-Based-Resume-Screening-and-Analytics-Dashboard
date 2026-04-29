import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Filter, Search as SearchIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import SummaryCandidateCard from "@/components/SummaryCandidateCard";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  confirmCandidateStatus,
  getResumes,
  resendCandidateEmail,
  type EmailStatus,
  type FinalCandidateStatus,
  type ResumeRecord,
} from "@/lib/api";
import { toast } from "sonner";

type FilterValue = "all" | "needs_action" | "Shortlisted" | "Under Review" | "Rejected" | "email_failed";
type SortValue = "score_desc" | "score_asc" | "latest";

const SearchPage = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all");
  const [sortBy, setSortBy] = useState<SortValue>("score_desc");
  const [loading, setLoading] = useState(true);
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const previousEmailStatuses = useRef<Record<string, EmailStatus | null | undefined>>({});
  const hasLoadedSnapshot = useRef(false);

  const applySnapshot = (records: ResumeRecord[], announceEmailTransitions: boolean) => {
    if (announceEmailTransitions && hasLoadedSnapshot.current) {
      records.forEach((record) => {
        const previousStatus = previousEmailStatuses.current[record.id];
        const currentStatus = record.email_status;
        const candidateName = record.candidate_name || record.parsed_data?.name || record.original_filename;

        if (previousStatus === "pending" && currentStatus === "sent") {
          toast.success(`Email sent successfully to ${candidateName}`);
        }

        if (previousStatus === "pending" && currentStatus === "failed") {
          toast.error(`Email failed for ${candidateName}`);
        }
      });
    }

    previousEmailStatuses.current = Object.fromEntries(records.map((record) => [record.id, record.email_status]));
    hasLoadedSnapshot.current = true;
    setResumes(records);
  };

  const loadSummary = async (announceEmailTransitions: boolean) => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const resumeData = await getResumes(session.access_token);
      applySnapshot(resumeData, announceEmailTransitions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load summary data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadSummary(false);
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    if (!resumes.some((resume) => resume.email_status === "pending")) return;

    const intervalId = window.setInterval(() => {
      loadSummary(true);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [resumes, session?.access_token]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return resumes
      .filter((resume) => {
        const candidateName = (resume.candidate_name || resume.parsed_data?.name || resume.original_filename).toLowerCase();
        const candidateEmail = resume.parsed_data?.email?.toLowerCase() ?? "";
        const jobTitle = resume.job_title?.toLowerCase() ?? "";
        const matchedSkills = resume.matched_skills.map((skill) => skill.toLowerCase());
        const missingSkills = resume.missing_skills.map((skill) => skill.toLowerCase());
        const matchesQuery =
          !normalizedQuery ||
          candidateName.includes(normalizedQuery) ||
          candidateEmail.includes(normalizedQuery) ||
          jobTitle.includes(normalizedQuery) ||
          matchedSkills.some((skill) => skill.includes(normalizedQuery)) ||
          missingSkills.some((skill) => skill.includes(normalizedQuery));

        if (!matchesQuery) return false;

        if (statusFilter === "all") return true;
        if (statusFilter === "needs_action") return !resume.final_status;
        if (statusFilter === "email_failed") return resume.email_status === "failed";
        return resume.final_status === statusFilter || resume.ml_suggested_status === statusFilter || resume.candidate_status === statusFilter;
      })
      .sort((left, right) => {
        const leftScore = left.score ?? 0;
        const rightScore = right.score ?? 0;

        if (sortBy === "score_asc") return leftScore - rightScore;
        if (sortBy === "latest") return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
        return rightScore - leftScore;
      });
  }, [query, resumes, sortBy, statusFilter]);

  const handleConfirmStatus = async (candidateId: string, finalStatus: FinalCandidateStatus) => {
    if (!session?.access_token) return;

    try {
      setBusyCandidateId(candidateId);
      const updated = await confirmCandidateStatus(session.access_token, candidateId, finalStatus);
      const next = resumes.map((resume) => (resume.id === updated.id ? updated : resume));
      applySnapshot(next, false);
      toast.success("Status confirmed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to confirm candidate status");
    } finally {
      setBusyCandidateId(null);
    }
  };

  const handleResendEmail = async (candidateId: string) => {
    if (!session?.access_token) return;

    try {
      setBusyCandidateId(candidateId);
      const updated = await resendCandidateEmail(session.access_token, candidateId);
      const next = resumes.map((resume) => (resume.id === updated.id ? updated : resume));
      applySnapshot(next, false);
      toast.success("Email retry queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to resend candidate email");
    } finally {
      setBusyCandidateId(null);
    }
  };

  const pendingReviewCount = resumes.filter((resume) => !resume.final_status).length;
  const sentEmailCount = resumes.filter((resume) => resume.email_status === "sent").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Summary</h1>
            <p className="mt-1 text-muted-foreground">HR confirmation dashboard for ML-screened candidates and automated communication.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 px-3 py-1 text-primary">
              {pendingReviewCount} awaiting HR decision
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              {sentEmailCount} emails sent
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search by candidate, job, matched skill, or missing skill..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterValue)}>
            <SelectTrigger>
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All candidates</SelectItem>
              <SelectItem value="needs_action">Pending HR action</SelectItem>
              <SelectItem value="Shortlisted">Shortlisted</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="email_failed">Email failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortValue)}>
            <SelectTrigger>
              <ArrowDownUp className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score_desc">Highest score</SelectItem>
              <SelectItem value="score_asc">Lowest score</SelectItem>
              <SelectItem value="latest">Latest updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">{loading ? "Loading summary..." : `${filtered.length} candidates in summary`}</p>

        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">
            Loading candidate summary...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">
            No candidates match the current filters.
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((candidate) => (
              <SummaryCandidateCard
                key={candidate.id}
                candidate={candidate}
                isBusy={busyCandidateId === candidate.id}
                onConfirm={(finalStatus) => handleConfirmStatus(candidate.id, finalStatus)}
                onResendEmail={() => handleResendEmail(candidate.id)}
                onViewScreening={() => navigate(`/screening?resumeId=${candidate.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SearchPage;
