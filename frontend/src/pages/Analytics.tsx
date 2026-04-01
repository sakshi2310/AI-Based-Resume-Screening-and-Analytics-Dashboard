import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import AppLayout from "@/components/AppLayout";
import { statusDistribution, skillsFrequency, candidatesPerJob, scoreDistribution } from "@/lib/mockData";

const experienceData = [
  { range: "0-2 yrs", count: 1 },
  { range: "2-4 yrs", count: 3 },
  { range: "4-6 yrs", count: 2 },
  { range: "6+ yrs", count: 2 },
];

const tooltipStyle = {
  background: "hsl(222 44% 9%)",
  border: "1px solid hsl(215 28% 17%)",
  borderRadius: 8,
  color: "hsl(210 40% 96%)",
};

const Analytics = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Hiring insights and statistics</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Top Skills in Talent Pool</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={skillsFrequency.sort((a, b) => b.count - a.count)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis type="number" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <YAxis dataKey="skill" type="category" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(187 94% 43%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Status Overview</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={100} innerRadius={55} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Experience Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={experienceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis dataKey="range" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Candidates per Job</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={candidatesPerJob}>
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
    </AppLayout>
  );
};

export default Analytics;
