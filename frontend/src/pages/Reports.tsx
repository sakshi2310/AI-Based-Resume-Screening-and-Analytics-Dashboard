import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getJobs, getResumes, type Job, type ResumeRecord } from "@/lib/api";

const reports = [
  { key: "shortlisted", title: "Shortlisted Candidates Report", description: "All shortlisted candidates across active jobs", type: "CSV" },
  { key: "all", title: "Full Candidate List", description: "Complete candidate database with scores and skills", type: "CSV" },
  { key: "analytics", title: "Analytics Summary", description: "Hiring funnel metrics, status distribution, skill frequency", type: "CSV" },
  { key: "job-wise", title: "Job-wise Screening Report", description: "Screening results grouped by job posting", type: "CSV" },
];

const createCsv = (headers: string[], rows: string[][]) => {
  const content = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");
  return new Blob([content], { type: "text/csv;charset=utf-8;" });
};

const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const Reports = () => {
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
        toast.error(error instanceof Error ? error.message : "Unable to load reports data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [session?.access_token]);

  const buildShortlistedCsv = () => {
    const shortlisted = resumes.filter((resume) => resume.candidate_status === "Shortlisted");
    const rows = shortlisted.map((resume) => [
      resume.parsed_data?.name ?? "Unknown",
      resume.parsed_data?.email ?? "Unknown",
      resume.job_title ?? "Unmapped",
      (resume.parsed_data?.skills ?? []).join("; "),
      resume.parsed_data?.experience_years?.toString() ?? "N/A",
      resume.candidate_status,
    ]);
    return createCsv(["Name", "Email", "Job", "Skills", "Experience", "Status"], rows);
  };

  const buildAllCandidatesCsv = () => {
    const rows = resumes.map((resume) => [
      resume.parsed_data?.name ?? "Unknown",
      resume.parsed_data?.email ?? "Unknown",
      resume.job_title ?? "Unmapped",
      (resume.parsed_data?.skills ?? []).join("; "),
      resume.parsed_data?.education?.join("; ") ?? "",
      resume.parsed_data?.experience_years?.toString() ?? "N/A",
      resume.candidate_status,
      resume.parse_status,
    ]);
    return createCsv(["Name", "Email", "Job", "Skills", "Education", "Experience", "Status", "Parse Status"], rows);
  };

  const buildAnalyticsCsv = () => {
    const statusCounts = resumes.reduce<Record<string, number>>((acc, resume) => {
      acc[resume.candidate_status] = (acc[resume.candidate_status] ?? 0) + 1;
      return acc;
    }, {});
    const rows = Object.entries(statusCounts).map(([status, count]) => [status, count.toString()]);
    return createCsv(["Status", "Count"], rows);
  };

  const buildJobWiseCsv = () => {
    const rows = jobs.flatMap((job) => {
      const mapped = resumes.filter((resume) => resume.job_title === job.title || resume.job_id === job.id);
      return mapped.map((resume) => [
        job.title,
        resume.parsed_data?.name ?? "Unknown",
        resume.parsed_data?.email ?? "Unknown",
        (resume.parsed_data?.skills ?? []).join("; "),
        resume.candidate_status,
      ]);
    });
    return createCsv(["Job", "Candidate", "Email", "Skills", "Status"], rows);
  };

  const handleExport = (key: string, title: string) => {
    if (loading) {
      toast.error("Please wait until report data has loaded.");
      return;
    }

    let blob: Blob;
    let extension = "csv";

    switch (key) {
      case "shortlisted":
        blob = buildShortlistedCsv();
        break;
      case "all":
        blob = buildAllCandidatesCsv();
        break;
      case "analytics":
        blob = buildAnalyticsCsv();
        break;
      case "job-wise":
        blob = buildJobWiseCsv();
        break;
      default:
        toast.error("Unsupported report type");
        return;
    }

    downloadFile(blob, `${title.replace(/\s+/g, "_").toLowerCase()}.${extension}`);
    toast.success(`${title} downloaded`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Reports</h1>
          <p className="text-muted-foreground mt-1">Download screening and analytics reports as CSV files</p>
        </div>

        <div className="grid gap-4">
          {reports.map((report) => (
            <div key={report.key} className="glass-card p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                </div>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => handleExport(report.key, report.title)}>
                <Download className="w-4 h-4" /> {report.type}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
