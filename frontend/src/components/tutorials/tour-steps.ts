/**
 * Tour step definitions.
 *
 * Each `get*Steps()` function returns a list of driver.js steps. The
 * elements are selected by CSS class or data-tour attribute — we use
 * data-tour attributes so the tour never breaks when we restyle a page.
 *
 * Conventions:
 *   - The FIRST step always has no `element`, so driver.js centers a
 *     welcome popover with no spotlight. Everything else spotlights
 *     something on the page.
 *   - Keep each tour between 4 and 6 steps. Any longer and users skip.
 *   - Every step must have a "next" or "done" button label that reads
 *     naturally. "Got it", "Show me", "Next", "Finish".
 */
import type { DriveStep } from "driver.js";

export function getDashboardSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "Welcome to SOJIP",
        description:
          "This is your project home. Everything you build starts here. " +
          "Let's take 30 seconds to see how it works.",
        side: "over",
        align: "center",
      },
    },
    {
      element: '[data-tour="new-project"]',
      popover: {
        title: "Start a project",
        description:
          "Every project walks seven phases, from Idea to Maintenance. " +
          "Click here when you're ready to begin.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: '[data-tour="project-card"]',
      popover: {
        title: "Your project card",
        description:
          "The chip at the top shows your current phase. The links below " +
          "let you jump to any phase at any time.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: '[data-tour="github-badge"]',
      popover: {
        title: "Connect GitHub",
        description:
          "Connect GitHub once and SOJIP can create repositories, push " +
          "starter code, and review your commits.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: '[data-tour="user-menu"]',
      popover: {
        title: "You're ready",
        description:
          "That's it. Open a project and we'll show you around the " +
          "workspace next.",
        side: "bottom",
        align: "end",
      },
    },
  ];
}

export function getPhaseSteps(phaseLabel: string): DriveStep[] {
  return [
    {
      element: '[data-tour="stepper"]',
      popover: {
        title: "The seven phases",
        description:
          "Every project moves through seven phases. You're on " +
          phaseLabel +
          " right now. The checkmark shows what you've already completed.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="jump-bar"]',
      popover: {
        title: "Jump around anytime",
        description:
          "You don't have to finish one phase to look at another. Use " +
          "this bar to peek ahead or revisit something you've already done.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="support-panel"]',
      popover: {
        title: "Three ways to keep moving",
        description:
          "Games when you need a focus break. Ask Teacher to learn it " +
          "yourself. AI Mentor when you're stuck and want guidance.",
        side: "left",
        align: "start",
      },
    },
    {
      element: '[data-tour="phase-content"]',
      popover: {
        title: "Your workspace",
        description:
          "This is where the actual work happens. Every phase looks " +
          "different — forms, a canvas, a task graph, or a code editor.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="advance"]',
      popover: {
        title: "When you're ready, advance",
        description:
          "Each phase has a gate. When you've met its requirements, this " +
          "button takes you to the next phase. Until then, keep working.",
        side: "top",
        align: "end",
      },
    },
  ];
}
