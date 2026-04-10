import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getJobs, getResumes, type Job, type ResumeRecord } from "@/lib/api";
import { toast } from "sonner";

const tooltipStyle = {
  background: "hsl(222 44% 9%)",
  border: "1px solid hsl(215 28% 17%)",
  borderRadius: 8,
  color: "hsl(210 40% 96%)",
};

const statusColors = [
  "hsl(199, 89%, 48%)",
  "hsl(38, 92%, 50%)",
  "hsl(142, 76%, 36%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
];

const Analytics = () => {
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
        toast.error(error instanceof Error ? error.message : "Unable to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [session?.access_token]);

  const summary = useMemo(() => {
    const parsed = resumes.filter((resume) => resume.parse_status === "success");
    const failed = resumes.filter((resume) => resume.parse_status === "failed");
    const statusCounts = resumes.reduce<Record<string, number>>((acc, resume) => {
      acc[resume.candidate_status] = (acc[resume.candidate_status] ?? 0) + 1;
      return acc;
    }, {});

    const skillsFrequency = resumes
      .flatMap((resume) => resume.parsed_data?.skills ?? [])
      .reduce<Record<string, number>>((acc, skill) => {
        const normalized = skill.trim();
        if (!normalized) return acc;
        acc[normalized] = (acc[normalized] ?? 0) + 1;
        return acc;
      }, {});

    const jobCounts = resumes.reduce<Record<string, number>>((acc, resume) => {
      const key = resume.job_title ?? "Unmapped";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const experienceBuckets = resumes.reduce<Record<string, number>>((acc, resume) => {
      const value = resume.parsed_data?.experience_years ?? 0;
      const bucket = value < 2 ? "0-2 yrs" : value < 4 ? "2-4 yrs" : value < 6 ? "4-6 yrs" : "6+ yrs";
      acc[bucket] = (acc[bucket] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalJobs: jobs.length,
      totalResumes: resumes.length,
      successCount: parsed.length,
      failedCount: failed.length,
      shortlisted: statusCounts["Shortlisted"] ?? 0,
      rejected: statusCounts["Rejected"] ?? 0,
      avgExperience: resumes.length
        ? Math.round(
            resumes.reduce((sum, item) => sum + (item.parsed_data?.experience_years ?? 0), 0) / resumes.length,
          )
        : 0,
      statusDistribution: Object.entries(statusCounts).map(([name, value], index) => ({ name, value, fill: statusColors[index % statusColors.length] })),
      skillsFrequency: Object.entries(skillsFrequency)
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count),
      candidatesPerJob: Object.entries(jobCounts).map(([job, candidates]) => ({ job, candidates })),
      experienceData: ["0-2 yrs", "2-4 yrs", "4-6 yrs", "6+ yrs"].map((range) => ({ range, count: experienceBuckets[range] ?? 0 })),
    };
  }, [resumes, jobs]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Hiring insights and statistics</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-8 text-center text-muted-foreground">Loading analytics...</div>
        ) : (
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-6">
                <p className="text-sm text-muted-foreground">Total jobs</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{summary.totalJobs}</p>
              </div>
              <div className="glass-card p-6">
                <p className="text-sm text-muted-foreground">Resumes parsed</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{summary.successCount}</p>
              </div>
              <div className="glass-card p-6">
                <p className="text-sm text-muted-foreground">Parse failures</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{summary.failedCount}</p>
              </div>
              <div className="glass-card p-6">
                <p className="text-sm text-muted-foreground">Avg experience</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{summary.avgExperience} yrs</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 animate-fade-in">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top skills in talent pool</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={summary.skillsFrequency.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                    <XAxis type="number" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                    <YAxis dataKey="skill" type="category" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} width={120} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(187 94% 43%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-6 animate-fade-in">
                <h3 className="text-sm font-semibold text-foreground mb-4">Application status</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={summary.statusDistribution} cx="50%" cy="50%" outerRadius={100} innerRadius={55} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {summary.statusDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 animate-fade-in">
                <h3 className="text-sm font-semibold text-foreground mb-4">Experience distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={summary.experienceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                    <XAxis dataKey="range" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-6 animate-fade-in">
                <h3 className="text-sm font-semibold text-foreground mb-4">Candidates per job</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={summary.candidatesPerJob}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                    <XAxis dataKey="job" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="candidates" stroke="hsl(187 94% 43%)" strokeWidth={2} dot={{ fill: "hsl(187 94% 43%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Analytics;
