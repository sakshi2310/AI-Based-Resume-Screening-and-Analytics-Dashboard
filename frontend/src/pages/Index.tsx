import { Briefcase, Users, FileText, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AppLayout from "@/components/AppLayout";
import StatsCard from "@/components/StatsCard";
import { dashboardStats, statusDistribution, candidatesPerJob, scoreDistribution } from "@/lib/mockData";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI-powered resume screening overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard title="Total Jobs" value={dashboardStats.totalJobs} icon={Briefcase} trend="2 this week" trendUp />
          <StatsCard title="Candidates" value={dashboardStats.totalCandidates} icon={Users} trend="5 new" trendUp />
          <StatsCard title="Resumes" value={dashboardStats.totalResumes} icon={FileText} trend="8 parsed" trendUp />
          <StatsCard title="Shortlisted" value={dashboardStats.shortlisted} icon={CheckCircle} trend="+2" trendUp />
          <StatsCard title="Rejected" value={dashboardStats.rejected} icon={XCircle} />
          <StatsCard title="Avg Score" value={`${dashboardStats.avgScore}%`} icon={TrendingUp} trend="+3%" trendUp />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Candidates per Job */}
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Candidates per Job</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={candidatesPerJob}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis dataKey="job" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 44% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: 8, color: "hsl(210 40% 96%)" }}
                />
                <Bar dataKey="candidates" fill="hsl(187 94% 43%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Candidate Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(222 44% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: 8, color: "hsl(210 40% 96%)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
              <XAxis dataKey="range" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "hsl(222 44% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: 8, color: "hsl(210 40% 96%)" }} />
              <Bar dataKey="count" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
