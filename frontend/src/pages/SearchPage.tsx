import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Filter } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getJobs, getResumes, type Job, type ResumeRecord, type CandidateStatus } from "@/lib/api";
import { toast } from "sonner";

const statusColors: Record<CandidateStatus, string> = {
  New: "bg-info/20 text-info",
  "Under Review": "bg-warning/20 text-warning",
  Shortlisted: "bg-success/20 text-success",
  Rejected: "bg-destructive/20 text-destructive",
  Interviewed: "bg-primary/20 text-primary",
};

const statusOptions: CandidateStatus[] = ["New", "Under Review", "Shortlisted", "Rejected", "Interviewed"];

const SearchPage = () => {
  const { session } = useAuth();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
        toast.error(error instanceof Error ? error.message : "Unable to load search data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [session?.access_token]);

  const filtered = useMemo(() => {
    return resumes.filter((resume) => {
      const queryValue = query.trim().toLowerCase();
      const candidateName = resume.parsed_data?.name?.toLowerCase() ?? "";
      const candidateEmail = resume.parsed_data?.email?.toLowerCase() ?? "";
      const candidateSkills = resume.parsed_data?.skills?.map((skill) => skill.toLowerCase()) ?? [];
      const job = jobs.find((jobItem) => jobItem.id === resume.job_id);
      const jobTitle = job?.title.toLowerCase() ?? resume.job_title?.toLowerCase() ?? "";

      const matchesQuery =
        !queryValue ||
        candidateName.includes(queryValue) ||
        candidateEmail.includes(queryValue) ||
        jobTitle.includes(queryValue) ||
        candidateSkills.some((skill) => skill.includes(queryValue));

      const matchesStatus = statusFilter === "all" || resume.candidate_status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [resumes, jobs, query, statusFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search & Filter</h1>
          <p className="text-muted-foreground mt-1">Find candidates by name, skill, job, or status</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search by name, email, or skill..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">{loading ? "Loading candidates..." : `${filtered.length} candidates found`}</p>

        <div className="space-y-3">
          {filtered.map((resume) => {
            const job = jobs.find((j) => j.id === resume.job_id);
            const initials = (resume.parsed_data?.name || resume.original_filename)
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const parsedSkills = resume.parsed_data?.skills?.map((s) => s.toLowerCase()) ?? [];
            const score = job?.skills
              ? Math.round(
                  (job.skills.filter((skill) => parsedSkills.includes(skill.toLowerCase())).length / job.skills.length) * 100,
                )
              : 0;

            return (
              <div key={resume.id} className="glass-card p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">{initials}</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{resume.parsed_data?.name || resume.original_filename}</p>
                    <p className="text-xs text-muted-foreground">{job?.title || resume.job_title || "Unmapped position"} • {resume.parsed_data?.experience_years ?? "N/A"} yrs</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-sm font-bold ${score >= 85 ? "text-success" : score >= 70 ? "text-warning" : "text-destructive"}`}>{score}%</span>
                  <Badge className={`border-0 text-xs ${statusColors[resume.candidate_status]}`}>{resume.candidate_status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default SearchPage;
