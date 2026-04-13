import { useEffect, useMemo, useState } from "react";
import { Briefcase, Users, FileText, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AppLayout from "@/components/AppLayout";
import StatsCard from "@/components/StatsCard";
import { useAuth } from "@/contexts/AuthContext";
import { getJobs, getResumes, getResumeFinalScore, type Job, type ResumeRecord } from "@/lib/api";
import { toast } from "sonner";

const tooltipStyle = {
  background: "hsl(222 44% 9%)",
  border: "1px solid hsl(215 28% 17%)",
  borderRadius: 8,
  color: "hsl(210 40% 96%)",
};

const Dashboard = () => {
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
        toast.error(error instanceof Error ? error.message : "Unable to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [session?.access_token]);

  const summary = useMemo(() => {
    const statusCounts = resumes.reduce<Record<string, number>>((acc, resume) => {
      acc[resume.candidate_status] = (acc[resume.candidate_status] ?? 0) + 1;
      return acc;
    }, {});

    const jobCounts = resumes.reduce<Record<string, number>>((acc, resume) => {
      const key = resume.job_title ?? "Unmapped";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalJobs: jobs.length,
      totalCandidates: resumes.length,
      totalResumes: resumes.length,
      shortlisted: statusCounts["Shortlisted"] ?? 0,
      rejected: statusCounts["Rejected"] ?? 0,
      avgScore: resumes.length
        ? Math.round(
            resumes.reduce((sum, resume) => sum + getResumeFinalScore(resume), 0) / resumes.length,
          )
        : 0,
      statusDistribution: Object.entries(statusCounts).map(([name, value], index) => ({ name, value, fill: ["hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(142, 76%, 36%)", "hsl(0, 84%, 60%)", "hsl(262, 83%, 58%)"][index % 5] })),
      candidatesPerJob: Object.entries(jobCounts).map(([job, candidates]) => ({ job, candidates })),
      scoreDistribution: ["0-20", "20-40", "40-60", "60-80", "80-100"].map((range) => ({
        range,
        count: resumes.filter((resume) => {
          const score = getResumeFinalScore(resume);
          const [min, max] = range.split("-").map(Number);
          return score >= min && score < max;
        }).length,
      })),
    };
  }, [resumes, jobs]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI-powered resume screening overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard title="Total Jobs" value={summary.totalJobs} icon={Briefcase} trend="Live" trendUp />
          <StatsCard title="Candidates" value={summary.totalCandidates} icon={Users} trend="Updated" trendUp />
          <StatsCard title="Resumes" value={summary.totalResumes} icon={FileText} trend="Live" trendUp />
          <StatsCard title="Shortlisted" value={summary.shortlisted} icon={CheckCircle} trend="Tracked" trendUp />
          <StatsCard title="Rejected" value={summary.rejected} icon={XCircle} />
          <StatsCard title="Avg score" value={`${summary.avgScore}%`} icon={TrendingUp} trend="Estimated" trendUp />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Candidates per Job</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summary.candidatesPerJob}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis dataKey="job" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="candidates" fill="hsl(187 94% 43%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Candidate Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={summary.statusDistribution} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                  {summary.statusDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
