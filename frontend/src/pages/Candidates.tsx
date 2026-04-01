import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { candidates, jobs } from "@/lib/mockData";
import type { CandidateStatus } from "@/lib/mockData";

const statusColors: Record<CandidateStatus, string> = {
  New: "bg-info/20 text-info",
  "Under Review": "bg-warning/20 text-warning",
  Shortlisted: "bg-success/20 text-success",
  Rejected: "bg-destructive/20 text-destructive",
  Interviewed: "bg-primary/20 text-primary",
};

const Candidates = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-muted-foreground mt-1">View and manage all candidates</p>
        </div>

        <div className="glass-card overflow-hidden animate-fade-in">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Candidate</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills Match</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const job = jobs.find((j) => j.id === c.jobId);
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{job?.title || "—"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${c.score >= 85 ? "text-success" : c.score >= 70 ? "text-warning" : "text-destructive"}`}>
                          {c.score}%
                        </span>
                        <Progress value={c.score} className="w-16 h-1.5" />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap max-w-[200px]">
                        {c.matchedSkills.slice(0, 3).map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] border-success/30 text-success">{s}</Badge>
                        ))}
                        {c.missingSkills.length > 0 && (
                          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                            -{c.missingSkills.length}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{c.experience} yrs</td>
                    <td className="p-4">
                      <Badge className={`border-0 text-xs ${statusColors[c.status]}`}>{c.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default Candidates;
