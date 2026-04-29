import { CheckCircle2, Clock3, ExternalLink, Mail, MailCheck, MailX, RefreshCcw, Sparkles, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getResumeFinalScore, type EmailStatus, type FinalCandidateStatus, type ResumeRecord } from "@/lib/api";

const statusStyles: Record<FinalCandidateStatus, string> = {
  Shortlisted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  "Under Review": "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Rejected: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const emailStyles: Record<EmailStatus, string> = {
  pending: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

function isFinalStatus(value: string | null | undefined): value is FinalCandidateStatus {
  return value === "Shortlisted" || value === "Under Review" || value === "Rejected";
}

const actionConfig: Array<{
  label: string;
  status: FinalCandidateStatus;
  icon: typeof CheckCircle2;
  className: string;
}> = [
  {
    label: "Confirm Shortlist",
    status: "Shortlisted",
    icon: CheckCircle2,
    className: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10",
  },
  {
    label: "Keep Under Review",
    status: "Under Review",
    icon: Clock3,
    className: "border-amber-500/40 text-amber-300 hover:bg-amber-500/10",
  },
  {
    label: "Confirm Reject",
    status: "Rejected",
    icon: XCircle,
    className: "border-rose-500/40 text-rose-300 hover:bg-rose-500/10",
  },
];

type SummaryCandidateCardProps = {
  candidate: ResumeRecord;
  isBusy: boolean;
  onConfirm: (status: FinalCandidateStatus) => void;
  onViewScreening: () => void;
  onResendEmail: () => void;
};

const SummaryCandidateCard = ({
  candidate,
  isBusy,
  onConfirm,
  onViewScreening,
  onResendEmail,
}: SummaryCandidateCardProps) => {
  const score = Math.round(getResumeFinalScore(candidate));
  const candidateName = candidate.candidate_name || candidate.parsed_data?.name || candidate.original_filename;
  const candidateEmail = candidate.parsed_data?.email || "No email parsed";
  const matchedSkills = candidate.matched_skills.length > 0 ? candidate.matched_skills : candidate.ai_score?.matched_skills || [];
  const missingSkills = candidate.missing_skills.length > 0 ? candidate.missing_skills : candidate.ai_score?.missing_skills || [];
  const rawSuggestedStatus = candidate.ml_suggested_status || candidate.ai_recommended_status || candidate.candidate_status;
  const mlSuggestedStatus = isFinalStatus(rawSuggestedStatus) ? rawSuggestedStatus : null;
  const finalStatus = candidate.final_status;
  const isConfirmed = Boolean(finalStatus);

  return (
    <Card className="glass-card border-border/60 bg-background/70">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-foreground">{candidateName}</h3>
              {mlSuggestedStatus && (
                <Badge variant="outline" className={`gap-1 ${statusStyles[mlSuggestedStatus]}`}>
                  <Sparkles className="h-3 w-3" />
                  ML: {mlSuggestedStatus}
                </Badge>
              )}
              {finalStatus && (
                <Badge variant="outline" className={`gap-1 ${statusStyles[finalStatus]}`}>
                  HR Final: {finalStatus}
                </Badge>
              )}
              {candidate.email_status && (
                <Badge variant="outline" className={`gap-1 ${emailStyles[candidate.email_status]}`}>
                  {candidate.email_status === "pending" && <Mail className="h-3 w-3" />}
                  {candidate.email_status === "sent" && <MailCheck className="h-3 w-3" />}
                  {candidate.email_status === "failed" && <MailX className="h-3 w-3" />}
                  Email: {candidate.email_status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{candidate.job_title || "Unmapped role"}</p>
            <p className="text-xs text-muted-foreground">{candidateEmail}</p>
          </div>

          <div className="min-w-[180px] rounded-2xl border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score</span>
              <span className={`font-semibold ${score >= 85 ? "text-emerald-300" : score >= 70 ? "text-amber-300" : "text-rose-300"}`}>
                {score}%
              </span>
            </div>
            <Progress value={score} className="mt-3 h-2.5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">Matched Skills</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {matchedSkills.length > 0 ? matchedSkills.map((skill) => (
                <Badge key={skill} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                  {skill}
                </Badge>
              )) : (
                <span className="text-sm text-muted-foreground">No matched skills captured yet.</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-300">Missing Skills</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {missingSkills.length > 0 ? missingSkills.map((skill) => (
                <Badge key={skill} variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-200">
                  {skill}
                </Badge>
              )) : (
                <span className="text-sm text-muted-foreground">No major skill gaps identified.</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {actionConfig.map((action) => {
            const Icon = action.icon;
            const isSelected = finalStatus === action.status;

            return (
              <Button
                key={action.status}
                type="button"
                variant={isSelected ? "default" : "outline"}
                disabled={isBusy || isConfirmed}
                className={isSelected ? "bg-primary text-primary-foreground" : action.className}
                onClick={() => onConfirm(action.status)}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Button>
            );
          })}

          <Button type="button" variant="ghost" onClick={onViewScreening}>
            <ExternalLink className="h-4 w-4" />
            View Screening
          </Button>

          {candidate.email_status === "failed" && (
            <Button type="button" variant="outline" onClick={onResendEmail}>
              <RefreshCcw className="h-4 w-4" />
              Resend Email
            </Button>
          )}
        </div>

        {isConfirmed && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            HR has confirmed <span className="font-medium text-foreground">{finalStatus}</span>. Further status changes are locked for this candidate.
          </div>
        )}

        {candidate.email_status === "failed" && candidate.email_error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200">
            Email delivery failed: {candidate.email_error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SummaryCandidateCard;
