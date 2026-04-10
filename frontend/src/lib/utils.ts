import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SkillMatchResult = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
};

export type WeightedMatchResult = {
  totalScore: number;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  completenessScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  breakdown: string;
};

const normalizeSkill = (skill: string) =>
  skill
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

const isSkillEquivalent = (left: string, right: string) => {
  const normalizedLeft = normalizeSkill(left);
  const normalizedRight = normalizeSkill(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
};

export const getSkillMatchDetails = (
  resumeSkills?: string[],
  jobSkills?: string[],
): SkillMatchResult => {
  const resumeList = (resumeSkills ?? []).map((skill) => skill.trim()).filter(Boolean);
  const jobList = (jobSkills ?? []).map((skill) => skill.trim()).filter(Boolean);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const jobSkill of jobList) {
    const hasMatch = resumeList.some((resumeSkill) => isSkillEquivalent(resumeSkill, jobSkill));
    if (hasMatch) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push(jobSkill);
    }
  }

  const uniqueNormalized = new Set<string>();
  for (const skill of [...resumeList, ...jobList]) {
    const normalized = normalizeSkill(skill);
    if (normalized) uniqueNormalized.add(normalized);
  }

  const score = uniqueNormalized.size
    ? Math.round((matchedSkills.length / uniqueNormalized.size) * 100)
    : 0;

  return {
    score,
    matchedSkills,
    missingSkills,
  };
};

/**
 * FAIR & WEIGHTED MATCHING ALGORITHM
 * ===================================
 *
 * This algorithm is designed to give equal opportunity to ALL candidates,
 * whether fresher, intermediate, or senior.
 *
 * WEIGHTS:
 * - Skills: 40% (most important - what you CAN DO)
 * - Experience: 30% (fair calculation - freshers get partial credit)
 * - Education: 20% (qualifications and learning)
 * - Completeness: 10% (profile quality - CV detail level)
 *
 * WHY THIS IS FAIR:
 * 1. Fresher with great skills + education can score 60-80% even with 0 years experience
 * 2. Senior with average skills BUT matching experience gets 70-80%
 * 3. Everyone is judged on MULTIPLE factors, not just one
 * 4. Profile completeness matters - encouraging candidates to fill in details
 *
 * EXAMPLE SCORES:
 * - Fresher (0 yrs) with all skills + degree: ~75% → Gets SHOWN ✓
 * - Mid-level (3 yrs) with 70% skills + degree: ~73% → Gets SHOWN ✓
 * - Senior (8 yrs) with 50% skills only: ~67% → Still gets SHOWN ✓
 * - Junior (1 yr) incomplete profile + 40% skills: ~45% → Lower priority
 */
export const getWeightedMatchScore = (
  resumeSkills?: string[],
  resumeExperienceYears?: number | null,
  resumeEducation?: string[],
  jobSkills?: string[],
  jobMinExperience?: number,
  jobMaxExperience?: number | null,
): WeightedMatchResult => {
  // SKILL SCORE (40% weight)
  const resumeList = (resumeSkills ?? []).map((s) => s.trim()).filter(Boolean);
  const jobList = (jobSkills ?? []).map((s) => s.trim()).filter(Boolean);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const jobSkill of jobList) {
    const hasMatch = resumeList.some((resumeSkill) => isSkillEquivalent(resumeSkill, jobSkill));
    if (hasMatch) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push(jobSkill);
    }
  }

  const skillScore = jobList.length > 0 ? Math.round((matchedSkills.length / jobList.length) * 100) : 100;

  // EXPERIENCE SCORE (30% weight) - FAIR FOR FRESHERS
  const candidateExperience = resumeExperienceYears ?? 0;
  const minExp = jobMinExperience ?? 0;
  const maxExp = jobMaxExperience ?? minExp + 5;

  let experienceScore = 0;

  if (candidateExperience >= minExp && candidateExperience <= maxExp) {
    // Perfect match range: 100%
    experienceScore = 100;
  } else if (candidateExperience < minExp) {
    // Fresher/Junior: partial credit based on SKILLS instead
    // If fresher has good skills, they get 70-85% experience score too
    // This encourages showing talented freshers
    const skillBonus = skillScore >= 80 ? 15 : skillScore >= 60 ? 10 : 5;
    experienceScore = Math.min(85, (candidateExperience / minExp) * 100 + skillBonus);
  } else {
    // Overqualified but still valuable: 95%
    experienceScore = 95;
  }

  // EDUCATION SCORE (20% weight) - Degree or relevant education
  const educationList = (resumeEducation ?? []).map((e) => e.trim()).filter(Boolean);
  let educationScore = 0;

  if (educationList.length > 0) {
    // Has education background
    const hasRelevantEducation = educationList.some((edu) => {
      const lowerEdu = edu.toLowerCase();
      return (
        lowerEdu.includes("bachelor") ||
        lowerEdu.includes("master") ||
        lowerEdu.includes("degree") ||
        lowerEdu.includes("diploma") ||
        lowerEdu.includes("certification") ||
        lowerEdu.includes("course")
      );
    });
    educationScore = hasRelevantEducation ? 100 : 75;
  } else {
    // No education info but has skills/experience
    educationScore = candidateExperience > 2 ? 70 : 50;
  }

  // COMPLETENESS SCORE (10% weight) - Profile quality
  // Encourages candidates to fill in all details
  let completenessScore = 0;
  let completenessCount = 0;

  if (resumeList.length > 0) completenessCount++;
  if (candidateExperience !== null && candidateExperience > 0) completenessCount++;
  if (educationList.length > 0) completenessCount++;
  if (resumeList.length > 3) completenessCount++; // Bonus for many skills
  if (educationList.length > 1) completenessCount++; // Bonus for multiple degrees

  completenessScore = Math.round((completenessCount / 5) * 100);

  // CALCULATE WEIGHTED FINAL SCORE
  const totalScore = Math.round(
    skillScore * 0.4 + experienceScore * 0.3 + educationScore * 0.2 + completenessScore * 0.1,
  );

  const breakdown =
    `Skills: ${skillScore}% (${matchedSkills.length}/${jobList.length}) | ` +
    `Experience: ${experienceScore}% (${candidateExperience}/${minExp}-${maxExp}yrs) | ` +
    `Education: ${educationScore}% | ` +
    `Completeness: ${completenessScore}%`;

  return {
    totalScore,
    skillScore,
    experienceScore,
    educationScore,
    completenessScore,
    matchedSkills,
    missingSkills,
    breakdown,
  };
};
