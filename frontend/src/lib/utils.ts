/**
 * lib/utils.ts
 * ============
 * Rule-based scoring (getWeightedMatchScore, getSkillMatchDetails) has been
 * fully REMOVED. All scoring now comes from the backend AI pipeline.
 *
 * Only the cn() Tailwind utility is kept here.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
