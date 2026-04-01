import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { candidates, jobs } from "@/lib/mockData";
import { Brain, CheckCircle, XCircle } from "lucide-react";

const Screening = () => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Screening Results</h1>
          <p className="text-muted-foreground mt-1">Resume matching scores and skill analysis</p>
        </div>

        <div className="space-y-4">
          {sorted.map((c, idx) => {
            const job = jobs.find((j) => j.id === c.jobId);
            return (
              <div key={c.id} className="glass-card p-5 animate-fade-in hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx < 3 ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">Applied for: {job?.title}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${c.score >= 85 ? "text-success" : c.score >= 70 ? "text-warning" : "text-destructive"}`}>
                          {c.score}%
                        </span>
                        <Progress value={c.score} className="w-24 h-2 mt-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" /> Matched Skills</p>
                        <div className="flex gap-1 flex-wrap">
                          {c.matchedSkills.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] border-success/30 text-success">{s}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> Missing Skills</p>
                        <div className="flex gap-1 flex-wrap">
                          {c.missingSkills.length > 0 ? c.missingSkills.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{s}</Badge>
                          )) : <span className="text-xs text-success">All matched!</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span><Brain className="w-3 h-3 inline mr-1" />Experience: {c.experience} yrs</span>
                      <span>Education: {c.education}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Screening;
