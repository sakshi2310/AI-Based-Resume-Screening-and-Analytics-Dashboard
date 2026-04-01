import { useState } from "react";
import { Upload as UploadIcon, FileText, CheckCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const UploadResume = () => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const names = Array.from(e.dataTransfer.files).map((f) => f.name);
    setFiles((prev) => [...prev, ...names]);
    toast.success(`${names.length} file(s) uploaded`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map((f) => f.name);
      setFiles((prev) => [...prev, ...names]);
      toast.success(`${names.length} file(s) selected`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload Resumes</h1>
          <p className="text-muted-foreground mt-1">Upload PDF or DOCX resumes for AI parsing</p>
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
          <p className="text-sm text-muted-foreground">Supports PDF and DOCX files</p>
          <input id="file-input" type="file" multiple accept=".pdf,.docx" className="hidden" onChange={handleFileSelect} />
        </div>

        {files.length > 0 && (
          <div className="glass-card p-6 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground">Uploaded Files</h3>
            {files.map((name, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground flex-1">{name}</span>
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
            ))}
            <Button className="mt-4 w-full">Parse All Resumes with AI</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UploadResume;
