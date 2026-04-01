import { useState } from "react";
import { Search as SearchIcon, Filter } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { candidates, jobs } from "@/lib/mockData";
import type { CandidateStatus } from "@/lib/mockData";

const statusColors: Record<CandidateStatus, string> = {
  New: "bg-info/20 text-info",
  "Under Review": "bg-warning/20 text-warning",
  Shortlisted: "bg-success/20 text-success",
  Rejected: "bg-destructive/20 text-destructive",
  Interviewed: "bg-primary/20 text-primary",
};

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = candidates.filter((c) => {
    const matchesQuery = !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.skills.some((s) => s.toLowerCase().includes(query.toLowerCase()));
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search & Filter</h1>
          <p className="text-muted-foreground mt-1">Find candidates by name, skill, or status</p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or skill..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-muted border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-muted border-border">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Shortlisted">Shortlisted</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Interviewed">Interviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">{filtered.length} candidates found</p>

        <div className="space-y-3">
          {filtered.map((c) => {
            const job = jobs.find((j) => j.id === c.jobId);
            return (
              <div key={c.id} className="glass-card p-4 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{job?.title} • {c.experience} yrs • {c.education}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${c.score >= 85 ? "text-success" : c.score >= 70 ? "text-warning" : "text-destructive"}`}>
                    {c.score}%
                  </span>
                  <Badge className={`border-0 text-xs ${statusColors[c.status]}`}>{c.status}</Badge>
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
