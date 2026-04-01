import { Download, FileText } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const reports = [
  { title: "Shortlisted Candidates Report", description: "All shortlisted candidates across active jobs", type: "CSV" },
  { title: "Full Candidate List", description: "Complete candidate database with scores and skills", type: "CSV" },
  { title: "Analytics Summary", description: "Hiring funnel metrics, skill gap analysis, score distribution", type: "PDF" },
  { title: "Job-wise Screening Report", description: "Screening results grouped by job posting", type: "PDF" },
];

const Reports = () => {
  const handleExport = (title: string) => {
    toast.success(`Generating ${title}...`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Reports</h1>
          <p className="text-muted-foreground mt-1">Download reports in CSV or PDF format</p>
        </div>

        <div className="grid gap-4">
          {reports.map((r) => (
            <div key={r.title} className="glass-card p-5 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => handleExport(r.title)}>
                <Download className="w-4 h-4" /> {r.type}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
