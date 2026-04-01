export const jobs = [
  { id: "1", title: "Senior React Developer", department: "Engineering", location: "Remote", experience: "5+ years", skills: ["React", "TypeScript", "Node.js", "GraphQL"], candidates: 24, status: "Active", posted: "2026-03-15" },
  { id: "2", title: "Data Scientist", department: "Data", location: "New York", experience: "3+ years", skills: ["Python", "ML", "TensorFlow", "SQL"], candidates: 18, status: "Active", posted: "2026-03-20" },
  { id: "3", title: "Product Manager", department: "Product", location: "San Francisco", experience: "4+ years", skills: ["Agile", "Analytics", "Strategy", "Roadmapping"], candidates: 12, status: "Active", posted: "2026-03-22" },
  { id: "4", title: "DevOps Engineer", department: "Infrastructure", location: "Remote", experience: "3+ years", skills: ["AWS", "Docker", "Kubernetes", "CI/CD"], candidates: 9, status: "Closed", posted: "2026-03-10" },
  { id: "5", title: "UX Designer", department: "Design", location: "London", experience: "2+ years", skills: ["Figma", "User Research", "Prototyping", "Design Systems"], candidates: 15, status: "Active", posted: "2026-03-25" },
];

export type CandidateStatus = "New" | "Under Review" | "Shortlisted" | "Rejected" | "Interviewed";

export const candidates = [
  { id: "1", name: "Priya Sharma", email: "priya@email.com", phone: "+91 98765 43210", skills: ["React", "TypeScript", "Node.js", "CSS"], experience: 6, education: "B.Tech CS", score: 92, status: "Shortlisted" as CandidateStatus, jobId: "1", matchedSkills: ["React", "TypeScript", "Node.js"], missingSkills: ["GraphQL"] },
  { id: "2", name: "Rahul Verma", email: "rahul@email.com", phone: "+91 87654 32109", skills: ["React", "JavaScript", "Redux", "REST"], experience: 4, education: "MCA", score: 78, status: "Under Review" as CandidateStatus, jobId: "1", matchedSkills: ["React"], missingSkills: ["TypeScript", "GraphQL"] },
  { id: "3", name: "Ananya Patel", email: "ananya@email.com", phone: "+91 76543 21098", skills: ["Python", "ML", "TensorFlow", "Pandas", "SQL"], experience: 5, education: "M.Tech AI", score: 95, status: "Shortlisted" as CandidateStatus, jobId: "2", matchedSkills: ["Python", "ML", "TensorFlow", "SQL"], missingSkills: [] },
  { id: "4", name: "Vikram Singh", email: "vikram@email.com", phone: "+91 65432 10987", skills: ["Python", "R", "Statistics"], experience: 2, education: "B.Sc Stats", score: 58, status: "Rejected" as CandidateStatus, jobId: "2", matchedSkills: ["Python"], missingSkills: ["ML", "TensorFlow", "SQL"] },
  { id: "5", name: "Sneha Gupta", email: "sneha@email.com", phone: "+91 54321 09876", skills: ["Agile", "Analytics", "Strategy", "Leadership"], experience: 7, education: "MBA", score: 88, status: "Interviewed" as CandidateStatus, jobId: "3", matchedSkills: ["Agile", "Analytics", "Strategy"], missingSkills: ["Roadmapping"] },
  { id: "6", name: "Arjun Reddy", email: "arjun@email.com", phone: "+91 43210 98765", skills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"], experience: 4, education: "B.Tech CS", score: 96, status: "Shortlisted" as CandidateStatus, jobId: "4", matchedSkills: ["AWS", "Docker", "Kubernetes", "CI/CD"], missingSkills: [] },
  { id: "7", name: "Meera Iyer", email: "meera@email.com", phone: "+91 32109 87654", skills: ["Figma", "Sketch", "User Research", "Prototyping"], experience: 3, education: "B.Des", score: 85, status: "Under Review" as CandidateStatus, jobId: "5", matchedSkills: ["Figma", "User Research", "Prototyping"], missingSkills: ["Design Systems"] },
  { id: "8", name: "Karthik Nair", email: "karthik@email.com", phone: "+91 21098 76543", skills: ["React", "Vue", "Angular", "TypeScript"], experience: 3, education: "B.Tech IT", score: 72, status: "New" as CandidateStatus, jobId: "1", matchedSkills: ["React", "TypeScript"], missingSkills: ["Node.js", "GraphQL"] },
];

export const dashboardStats = {
  totalJobs: 5,
  totalCandidates: 8,
  totalResumes: 12,
  shortlisted: 3,
  rejected: 1,
  avgScore: 83,
};

export const statusDistribution = [
  { name: "New", value: 1, fill: "hsl(199, 89%, 48%)" },
  { name: "Under Review", value: 2, fill: "hsl(38, 92%, 50%)" },
  { name: "Shortlisted", value: 3, fill: "hsl(142, 76%, 36%)" },
  { name: "Rejected", value: 1, fill: "hsl(0, 84%, 60%)" },
  { name: "Interviewed", value: 1, fill: "hsl(262, 83%, 58%)" },
];

export const scoreDistribution = [
  { range: "50-60", count: 1 },
  { range: "60-70", count: 0 },
  { range: "70-80", count: 2 },
  { range: "80-90", count: 2 },
  { range: "90-100", count: 3 },
];

export const skillsFrequency = [
  { skill: "React", count: 3 },
  { skill: "Python", count: 2 },
  { skill: "TypeScript", count: 3 },
  { skill: "AWS", count: 1 },
  { skill: "Figma", count: 1 },
  { skill: "SQL", count: 2 },
  { skill: "Docker", count: 1 },
  { skill: "ML", count: 1 },
  { skill: "Agile", count: 1 },
  { skill: "Node.js", count: 2 },
];

export const candidatesPerJob = [
  { job: "React Dev", candidates: 24 },
  { job: "Data Sci", candidates: 18 },
  { job: "PM", candidates: 12 },
  { job: "DevOps", candidates: 9 },
  { job: "UX Design", candidates: 15 },
];
