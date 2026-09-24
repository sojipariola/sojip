/**
 * Canonical phase definitions.
 *
 * Every place in the frontend that needs the phase order, the short
 * label, or a route to a phase page imports from here. Never duplicate
 * these lists.
 */

export const PHASE_ORDER = [
  "idea",
  "plan",
  "blueprint",
  "scaffold",
  "development",
  "deployment",
  "maintenance",
] as const;

export type PhaseId = (typeof PHASE_ORDER)[number];

/**
 * Short label used in nav, chips, and jump links.
 * Keep these to one or two words.
 */
export const PHASE_LABEL: Record<PhaseId, string> = {
  idea: "Idea",
  plan: "Plan",
  blueprint: "Blueprint",
  scaffold: "Scaffold",
  development: "Dev",
  deployment: "Deploy",
  maintenance: "Maintenance",
};

/**
 * Long label used in page headers and body copy.
 */
export const PHASE_LABEL_LONG: Record<PhaseId, string> = {
  idea: "Idea",
  plan: "Plan",
  blueprint: "Blueprint",
  scaffold: "Scaffold",
  development: "Development",
  deployment: "Deployment",
  maintenance: "Maintenance",
};

/**
 * Ordinal position of each phase, starting at 1. Used in page headers
 * ("Phase 3 — Blueprint").
 */
export const PHASE_NUMBER: Record<PhaseId, number> = {
  idea: 1,
  plan: 2,
  blueprint: 3,
  scaffold: 4,
  development: 5,
  deployment: 6,
  maintenance: 7,
};

export function isPhase(value: string): value is PhaseId {
  return (PHASE_ORDER as readonly string[]).includes(value);
}

export function phaseLabel(phase: string): string {
  return isPhase(phase) ? PHASE_LABEL[phase] : phase;
}

export function phaseLabelLong(phase: string): string {
  return isPhase(phase) ? PHASE_LABEL_LONG[phase] : phase;
}

export function phaseNumber(phase: string): number | null {
  return isPhase(phase) ? PHASE_NUMBER[phase] : null;
}

export function phaseUrl(projectSlug: string, phase: string): string {
  return `/projects/${projectSlug}/${phase}`;
}
