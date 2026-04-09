import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FileText, Link as LinkIcon, Trash2, Upload as UploadIcon, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { buildResumeUrl, deleteResume, getJobs, getResumes, uploadResumes, type Job, type ResumeRecord } from "@/lib/api";
import { toast } from "sonner";

const allowedExtensions = [".pdf", ".docx"];

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const dedupeFiles = (files: File[]) => {
  const unique = new Map<string, File>();
  files.forEach((file) => unique.set(`${file.name}-${file.size}-${file.lastModified}`, file));
  return Array.from(unique.values());
};

const UploadResume = () => {
  const { session, user } = useAuth();
  const canUpload = user?.role === "admin" || user?.role === "recruiter";

  const [dragOver, setDragOver] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [uploadedResumes, setUploadedResumes] = useState<ResumeRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeJobs = useMemo(() => jobs.filter((job) => job.is_active), [jobs]);

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
      setUploadedResumes(resumeData);
      setJobs(jobData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load upload module data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.access_token]);

  const addFiles = (incomingFiles: FileList | File[]) => {
    const picked = Array.from(incomingFiles).filter((file) => {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      return allowedExtensions.includes(extension);
    });

    if (picked.length === 0) {
      toast.error("Please select PDF or DOCX files only");
      return;
    }

    setQueuedFiles((current) => dedupeFiles([...current, ...picked]));
    toast.success(`${picked.length} file(s) ready for upload`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleUpload = async () => {
    if (!session?.access_token || queuedFiles.length === 0 || !canUpload) return;

    try {
      setUploading(true);
      const uploaded = await uploadResumes(
        session.access_token,
        queuedFiles,
        selectedJobId === "none" ? undefined : selectedJobId,
      );
      setUploadedResumes((current) => [...uploaded, ...current]);
      setQueuedFiles([]);
      setSelectedJobId("none");
      toast.success(`${uploaded.length} resume(s) uploaded successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeQueuedFile = (index: number) => {
    setQueuedFiles((current) => current.filter((_, i) => i !== index));
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!session?.access_token || !canUpload) return;

    try {
      setDeletingId(resumeId);
      await deleteResume(session.access_token, resumeId);
      setUploadedResumes((current) => current.filter((resume) => resume.id !== resumeId));
      toast.success("Resume deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete resume");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload Resumes</h1>
          <p className="text-muted-foreground mt-1">Upload PDF or DOCX resumes and map them to a job description.</p>
        </div>

        <div
          className={`glass-card p-12 flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <UploadIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-foreground font-medium mb-1">Drop resumes here or click to browse</p>
          <p className="text-sm text-muted-foreground">Supports PDF and DOCX files (max 10MB each)</p>
          <input id="file-input" type="file" multiple accept=".pdf,.docx" className="hidden" onChange={handleFileSelect} />
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle>Ready To Upload</CardTitle>
            <CardDescription>Select an optional job description before uploading.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Map to job description (optional)</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No job mapping</SelectItem>
                  {activeJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} - {job.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {queuedFiles.length === 0 && (
              <p className="text-sm text-muted-foreground">No files selected yet.</p>
            )}

            {queuedFiles.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                <Button variant="ghost" size="icon" onClick={() => removeQueuedFile(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button className="w-full" onClick={handleUpload} disabled={!canUpload || uploading || queuedFiles.length === 0}>
              {uploading ? "Uploading..." : "Upload Selected Resumes"}
            </Button>
            {!canUpload && (
              <p className="text-sm text-muted-foreground">Viewer accounts can view uploads but cannot upload or delete files.</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle>Uploaded Resumes</CardTitle>
            <CardDescription>{loading ? "Loading..." : `${uploadedResumes.length} resume(s) available`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && uploadedResumes.length === 0 && (
              <p className="text-sm text-muted-foreground">No resumes uploaded yet.</p>
            )}

            {uploadedResumes.map((resume) => (
              <div key={resume.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{resume.original_filename}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(resume.file_size_bytes)}</span>
                      <span>Uploaded by {resume.uploaded_by}</span>
                      <span>{format(new Date(resume.uploaded_at), "dd MMM yyyy, hh:mm a")}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{resume.mime_type}</Badge>
                      <Badge variant="outline">{resume.job_title || "No job mapped"}</Badge>
                      <Badge
                        variant={resume.parse_status === "success" ? "secondary" : resume.parse_status === "failed" ? "destructive" : "outline"}
                      >
                        Parse: {resume.parse_status}
                      </Badge>
                    </div>
                    {resume.parse_status === "failed" && resume.parse_error && (
                      <p className="text-xs text-red-500">Parse failed: {resume.parse_error}</p>
                    )}
                    {resume.parse_status === "success" && resume.parsed_data && (
                      <div className="text-xs text-muted-foreground space-y-1 pt-1">
                        <p>Name: {resume.parsed_data.name || "N/A"}</p>
                        <p>Email: {resume.parsed_data.email || "N/A"}</p>
                        <p>Phone: {resume.parsed_data.phone || "N/A"}</p>
                        <p>Location: {resume.parsed_data.location || "N/A"}</p>
                        <p>
                          Experience:
                          {" "}
                          {resume.parsed_data.experience_years !== null ? `${resume.parsed_data.experience_years} years` : "N/A"}
                        </p>
                        <p>Skills: {resume.parsed_data.skills.length > 0 ? resume.parsed_data.skills.join(", ") : "N/A"}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={buildResumeUrl(resume.file_url)} target="_blank" rel="noreferrer">
                        <LinkIcon className="h-4 w-4" />
                        Open
                      </a>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!canUpload || deletingId === resume.id}
                      onClick={() => handleDeleteResume(resume.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === resume.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default UploadResume;
