import { FormEvent, useEffect, useMemo, useState } from "react";
import { Briefcase, Eye, MapPin, Pencil, Plus, Power, Search, ShieldAlert, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createJob, deleteJob, getJobs, updateJob, updateJobStatus, type Job, type JobPayload } from "@/lib/api";
import { toast } from "sonner";

type JobFormState = {
  title: string;
  department: string;
  location: string;
  employment_type: string;
  work_mode: string;
  experience_level: string;
  min_experience_years: string;
  max_experience_years: string;
  openings: string;
  salary_range: string;
  description: string;
  responsibilities: string;
  requirements: string;
  skills: string;
  qualifications: string;
  benefits: string;
  is_active: boolean;
};

const emptyForm: JobFormState = {
  title: "",
  department: "",
  location: "",
  employment_type: "Full-time",
  work_mode: "On-site",
  experience_level: "Mid-Level",
  min_experience_years: "0",
  max_experience_years: "",
  openings: "1",
  salary_range: "",
  description: "",
  responsibilities: "",
  requirements: "",
  skills: "",
  qualifications: "",
  benefits: "",
  is_active: true,
};

const employmentTypes = ["Full-time", "Part-time", "Contract", "Internship"];
const workModes = ["On-site", "Hybrid", "Remote"];
const experienceLevels = ["Entry-Level", "Mid-Level", "Senior-Level", "Lead", "Manager"];

const listToText = (values: string[]) => values.join("\n");

const textToList = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const mapJobToForm = (job: Job): JobFormState => ({
  title: job.title,
  department: job.department,
  location: job.location,
  employment_type: job.employment_type,
  work_mode: job.work_mode,
  experience_level: job.experience_level,
  min_experience_years: String(job.min_experience_years),
  max_experience_years: job.max_experience_years === null ? "" : String(job.max_experience_years),
  openings: String(job.openings),
  salary_range: job.salary_range || "",
  description: job.description,
  responsibilities: listToText(job.responsibilities),
  requirements: listToText(job.requirements),
  skills: listToText(job.skills),
  qualifications: listToText(job.qualifications),
  benefits: listToText(job.benefits),
  is_active: job.is_active,
});

const buildPayload = (form: JobFormState): JobPayload => {
  const title = form.title.trim();
  const department = form.department.trim();
  const location = form.location.trim();
  const description = form.description.trim();
  const minExperience = Number(form.min_experience_years);
  const maxExperience = form.max_experience_years.trim() ? Number(form.max_experience_years) : null;

  if (title.length < 2) {
    throw new Error("Job title must be at least 2 characters");
  }

  if (department.length < 2) {
    throw new Error("Department must be at least 2 characters");
  }

  if (location.length < 2) {
    throw new Error("Location must be at least 2 characters");
  }

  if (description.length < 20) {
    throw new Error("Job description must be at least 20 characters");
  }

  if (Number.isNaN(minExperience) || minExperience < 0) {
    throw new Error("Minimum experience must be a valid number");
  }

  if (maxExperience !== null && (Number.isNaN(maxExperience) || maxExperience < minExperience)) {
    throw new Error("Maximum experience must be greater than or equal to minimum experience");
  }

  return {
    title,
    department,
    location,
    employment_type: form.employment_type,
    work_mode: form.work_mode,
    experience_level: form.experience_level,
    min_experience_years: minExperience,
    max_experience_years: maxExperience,
    openings: Number(form.openings) || 1,
    salary_range: form.salary_range.trim() || null,
    description,
    responsibilities: textToList(form.responsibilities),
    requirements: textToList(form.requirements),
    skills: textToList(form.skills),
    qualifications: textToList(form.qualifications),
    benefits: textToList(form.benefits),
    is_active: form.is_active,
  };
};

const Jobs = () => {
  const { session, user } = useAuth();
  const canManageJobs = user?.role === "admin" || user?.role === "recruiter";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");

  const stats = useMemo(() => {
    const activeJobs = jobs.filter((job) => job.is_active).length;
    return {
      total: jobs.length,
      active: activeJobs,
      inactive: jobs.length - activeJobs,
      departments: new Set(jobs.map((job) => job.department)).size,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return jobs;
    }

    return jobs.filter((job) => {
      const haystack = [
        job.title,
        job.department,
        job.location,
        job.employment_type,
        job.work_mode,
        job.experience_level,
        job.description,
        job.created_by,
        job.is_active ? "active" : "inactive",
        ...job.skills,
        ...job.requirements,
        ...job.responsibilities,
        ...job.qualifications,
        ...job.benefits,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [jobs, searchTerm]);

  const loadJobs = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const response = await getJobs(session.access_token);
      setJobs(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load job descriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [session?.access_token]);

  const openCreateDialog = () => {
    setEditingJob(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditDialog = (job: Job) => {
    setEditingJob(job);
    setForm(mapJobToForm(job));
    setFormOpen(true);
  };

  const handleFieldChange = (field: keyof JobFormState, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token || !canManageJobs) return;

    try {
      setSaving(true);
      const payload = buildPayload(form);
      const savedJob = editingJob
        ? await updateJob(session.access_token, editingJob.id, payload)
        : await createJob(session.access_token, payload);

      setJobs((current) => {
        if (editingJob) {
          return current.map((job) => (job.id === editingJob.id ? savedJob : job));
        }
        return [savedJob, ...current];
      });

      toast.success(editingJob ? "Job description updated" : "Job description created");
      setFormOpen(false);
      setEditingJob(null);
      setForm(emptyForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save job description");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (job: Job, isActive: boolean) => {
    if (!session?.access_token || !canManageJobs) return;

    try {
      const updated = await updateJobStatus(session.access_token, job.id, isActive);
      setJobs((current) => current.map((item) => (item.id === job.id ? updated : item)));
      if (selectedJob?.id === job.id) {
        setSelectedJob(updated);
      }
      toast.success(`Job marked as ${isActive ? "active" : "inactive"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update status");
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!session?.access_token || !canManageJobs) return;

    try {
      await deleteJob(session.access_token, jobId);
      setJobs((current) => current.filter((job) => job.id !== jobId));
      if (selectedJob?.id === jobId) {
        setDetailsOpen(false);
        setSelectedJob(null);
      }
      toast.success("Job deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete job");
    }
  };

  const renderList = (title: string, values: string[]) => {
    if (values.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={`${title}-${value}`} variant="outline" className="border-border/60 text-muted-foreground">
              {value}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Job Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Create, update, review, activate, and remove job descriptions for your hiring dashboard.
            </p>
          </div>
          {canManageJobs && (
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Create JD
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/70 bg-card">
                <DialogHeader>
                  <DialogTitle>{editingJob ? "Update Job Description" : "Create Job Description"}</DialogTitle>
                </DialogHeader>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="title">Job title</Label>
                      <Input id="title" value={form.title} onChange={(e) => handleFieldChange("title", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input id="department" value={form.department} onChange={(e) => handleFieldChange("department", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" value={form.location} onChange={(e) => handleFieldChange("location", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Employment type</Label>
                      <Select value={form.employment_type} onValueChange={(value) => handleFieldChange("employment_type", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {employmentTypes.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Work mode</Label>
                      <Select value={form.work_mode} onValueChange={(value) => handleFieldChange("work_mode", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {workModes.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Experience level</Label>
                      <Select value={form.experience_level} onValueChange={(value) => handleFieldChange("experience_level", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {experienceLevels.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min-experience">Min experience (years)</Label>
                      <Input id="min-experience" type="number" min="0" value={form.min_experience_years} onChange={(e) => handleFieldChange("min_experience_years", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-experience">Max experience (years)</Label>
                      <Input id="max-experience" type="number" min="0" value={form.max_experience_years} onChange={(e) => handleFieldChange("max_experience_years", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openings">Openings</Label>
                      <Input id="openings" type="number" min="1" value={form.openings} onChange={(e) => handleFieldChange("openings", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary-range">Salary range</Label>
                      <Input id="salary-range" placeholder="e.g. 8 LPA - 12 LPA" value={form.salary_range} onChange={(e) => handleFieldChange("salary_range", e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="description">Job description</Label>
                      <Textarea id="description" rows={5} value={form.description} onChange={(e) => handleFieldChange("description", e.target.value)} placeholder="Write the complete job overview and hiring context" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="responsibilities">Responsibilities</Label>
                      <Textarea id="responsibilities" rows={4} value={form.responsibilities} onChange={(e) => handleFieldChange("responsibilities", e.target.value)} placeholder="One per line or comma separated" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirements">Requirements</Label>
                      <Textarea id="requirements" rows={4} value={form.requirements} onChange={(e) => handleFieldChange("requirements", e.target.value)} placeholder="One per line or comma separated" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skills">Skills</Label>
                      <Textarea id="skills" rows={4} value={form.skills} onChange={(e) => handleFieldChange("skills", e.target.value)} placeholder="React, Python, SQL, Communication" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qualifications">Qualifications</Label>
                      <Textarea id="qualifications" rows={4} value={form.qualifications} onChange={(e) => handleFieldChange("qualifications", e.target.value)} placeholder="Degree, certifications, domain knowledge" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="benefits">Benefits</Label>
                      <Textarea id="benefits" rows={3} value={form.benefits} onChange={(e) => handleFieldChange("benefits", e.target.value)} placeholder="Health insurance, learning budget, flexible timings" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">Job is active</p>
                      <p className="text-sm text-muted-foreground">Inactive jobs stay visible in the dashboard but are marked closed.</p>
                    </div>
                    <Switch checked={form.is_active} onCheckedChange={(checked) => handleFieldChange("is_active", checked)} />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : editingJob ? "Update JD" : "Create JD"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardDescription>Total jobs</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardDescription>Active jobs</CardDescription>
              <CardTitle className="text-3xl text-emerald-500">{stats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardDescription>Inactive jobs</CardDescription>
              <CardTitle className="text-3xl text-amber-500">{stats.inactive}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardDescription>Departments</CardDescription>
              <CardTitle className="text-3xl">{stats.departments}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {!canManageJobs && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 p-6">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-foreground">Read-only access</p>
                <p className="text-sm text-muted-foreground">
                  Viewer accounts can review all job descriptions, but only admin or recruiter users can create, update, delete, or change job status.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Job Descriptions
                </CardTitle>
                <CardDescription>All job descriptions created in the dashboard, ordered with active roles first.</CardDescription>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by title, skill, department, location..." className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading jobs...</p>}
            {!loading && jobs.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                <p className="font-medium text-foreground">No job descriptions yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Create your first JD to start managing open roles from the dashboard.</p>
              </div>
            )}
            {!loading && jobs.length > 0 && filteredJobs.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                <p className="font-medium text-foreground">No matching jobs found</p>
                <p className="mt-2 text-sm text-muted-foreground">Try a different keyword like title, department, location, or skill.</p>
              </div>
            )}
            {!loading &&
              filteredJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-border/60 bg-background/70 p-5 transition-colors hover:border-primary/30">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-foreground">{job.title}</h3>
                        <Badge className={job.is_active ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15" : "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15"}>
                          {job.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{job.department}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                        <span>{job.work_mode}</span>
                        <span>{job.employment_type}</span>
                        <span>{job.experience_level}</span>
                        <span>{job.min_experience_years}{job.max_experience_years !== null ? `-${job.max_experience_years}` : "+"} years</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {job.openings} opening{job.openings > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{job.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {job.skills.slice(0, 6).map((skill) => (
                          <Badge key={skill} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                        {job.skills.length > 6 && <Badge variant="outline">+{job.skills.length - 6} more</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created by {job.created_by} on {format(new Date(job.created_at), "dd MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 xl:min-w-[220px]">
                      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">Status</p>
                          <p className="text-xs text-muted-foreground">{job.is_active ? "Visible for hiring" : "Role closed"}</p>
                        </div>
                        <Switch checked={job.is_active} disabled={!canManageJobs} onCheckedChange={(checked) => handleStatusChange(job, checked)} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            setSelectedJob(job);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button variant="outline" className="gap-2" disabled={!canManageJobs} onClick={() => openEditDialog(job)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="gap-2" disabled={!canManageJobs}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this JD?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove <span className="font-medium text-foreground">{job.title}</span> from the dashboard.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(job.id)}>
                                Delete JD
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>{selectedJob?.title || "Job details"}</DialogTitle>
            </DialogHeader>
            {selectedJob && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge className={selectedJob.is_active ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15" : "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15"}>
                    {selectedJob.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">{selectedJob.department}</Badge>
                  <Badge variant="outline">{selectedJob.work_mode}</Badge>
                  <Badge variant="outline">{selectedJob.employment_type}</Badge>
                  <Badge variant="outline">{selectedJob.experience_level}</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="mt-1 font-medium text-foreground">{selectedJob.location}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm text-muted-foreground">Experience</p>
                    <p className="mt-1 font-medium text-foreground">
                      {selectedJob.min_experience_years}
                      {selectedJob.max_experience_years !== null ? ` - ${selectedJob.max_experience_years}` : "+"} years
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm text-muted-foreground">Openings</p>
                    <p className="mt-1 font-medium text-foreground">{selectedJob.openings}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm text-muted-foreground">Salary range</p>
                    <p className="mt-1 font-medium text-foreground">{selectedJob.salary_range || "Not specified"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Description</h4>
                  <p className="rounded-xl border border-border/60 p-4 text-sm leading-6 text-muted-foreground">{selectedJob.description}</p>
                </div>
                {renderList("Skills", selectedJob.skills)}
                {renderList("Responsibilities", selectedJob.responsibilities)}
                {renderList("Requirements", selectedJob.requirements)}
                {renderList("Qualifications", selectedJob.qualifications)}
                {renderList("Benefits", selectedJob.benefits)}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground">
                  <span>Created by {selectedJob.created_by}</span>
                  <span>Updated {format(new Date(selectedJob.updated_at), "dd MMM yyyy, hh:mm a")}</span>
                </div>
                {canManageJobs && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="gap-2" onClick={() => handleStatusChange(selectedJob, !selectedJob.is_active)}>
                      <Power className="h-4 w-4" />
                      Mark as {selectedJob.is_active ? "Inactive" : "Active"}
                    </Button>
                    <Button
                      className="gap-2"
                      onClick={() => {
                        setDetailsOpen(false);
                        openEditDialog(selectedJob);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit JD
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Jobs;
