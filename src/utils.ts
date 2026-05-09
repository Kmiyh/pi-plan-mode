/**
 * Pure utility functions for plan mode.
 * Extracted for testability.
 */

import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export const PLAN_FILE = "plan.md";

export function planFilePath(cwd: string): string {
	return join(cwd, PLAN_FILE);
}

// Destructive commands blocked in plan mode
const DESTRUCTIVE_PATTERNS = [
	/\brm\b/i,
	/\brmdir\b/i,
	/\bmv\b/i,
	/\bcp\b/i,
	/\bmkdir\b/i,
	/\btouch\b/i,
	/\bchmod\b/i,
	/\bchown\b/i,
	/\bchgrp\b/i,
	/\bln\b/i,
	/\btee\b/i,
	/\btruncate\b/i,
	/\bdd\b/i,
	/\bshred\b/i,
	/(^|[^<])>(?!>)/,
	/>>/,
	/\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
	/\byarn\s+(add|remove|install|publish)/i,
	/\bpnpm\s+(add|remove|install|publish)/i,
	/\bpip\s+(install|uninstall)/i,
	/\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
	/\bbrew\s+(install|uninstall|upgrade)/i,
	/\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
	/\bsudo\b/i,
	/\bsu\b/i,
	/\bkill\b/i,
	/\bpkill\b/i,
	/\bkillall\b/i,
	/\breboot\b/i,
	/\bshutdown\b/i,
	/\bsystemctl\s+(start|stop|restart|enable|disable)/i,
	/\bservice\s+\S+\s+(start|stop|restart)/i,
	/\b(vim?|nano|emacs|code|subl)\b/i,
];

// Safe read-only commands allowed in plan mode
const SAFE_PATTERNS = [
	/^\s*cat\b/,
	/^\s*head\b/,
	/^\s*tail\b/,
	/^\s*less\b/,
	/^\s*more\b/,
	/^\s*grep\b/,
	/^\s*find\b/,
	/^\s*ls\b/,
	/^\s*pwd\b/,
	/^\s*echo\b/,
	/^\s*printf\b/,
	/^\s*wc\b/,
	/^\s*sort\b/,
	/^\s*uniq\b/,
	/^\s*diff\b/,
	/^\s*file\b/,
	/^\s*stat\b/,
	/^\s*du\b/,
	/^\s*df\b/,
	/^\s*tree\b/,
	/^\s*which\b/,
	/^\s*whereis\b/,
	/^\s*type\b/,
	/^\s*env\b/,
	/^\s*printenv\b/,
	/^\s*uname\b/,
	/^\s*whoami\b/,
	/^\s*id\b/,
	/^\s*date\b/,
	/^\s*cal\b/,
	/^\s*uptime\b/,
	/^\s*ps\b/,
	/^\s*top\b/,
	/^\s*htop\b/,
	/^\s*free\b/,
	/^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
	/^\s*git\s+ls-/i,
	/^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
	/^\s*yarn\s+(list|info|why|audit)/i,
	/^\s*node\s+--version/i,
	/^\s*python\s+--version/i,
	/^\s*curl\s/i,
	/^\s*wget\s+-O\s*-/i,
	/^\s*jq\b/,
	/^\s*sed\s+-n/i,
	/^\s*awk\b/,
	/^\s*rg\b/,
	/^\s*fd\b/,
	/^\s*bat\b/,
	/^\s*eza\b/,
];

export function isSafeCommand(command: string): boolean {
	const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
	const isSafe = SAFE_PATTERNS.some((p) => p.test(command));
	return !isDestructive && isSafe;
}

export interface TodoItem {
	step: number;
	title: string;
	description: string;
	completed: boolean;
}

export function cleanStepText(text: string): string {
	let cleaned = text
		.replace(/\*{1,2}/g, "")
		.replace(/`([^`]+)`/g, "$1")
		.replace(
			/^(Use|Run|Execute|Create|Write|Read|Check|Verify|Update|Modify|Add|Remove|Delete|Install)\s+(the\s+)?/i,
			"",
		)
		.replace(/\s+/g, " ")
		.trim();

	if (cleaned.length > 0) {
		cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	}
	if (cleaned.length > 80) {
		cleaned = `${cleaned.slice(0, 77)}...`;
	}
	return cleaned;
}

function stripMarkdown(text: string): string {
	return text
		.replace(/\*{1,2}/g, "")
		.replace(/`([^`]+)`/g, "$1");
}

export function extractTodoItems(message: string): TodoItem[] {
	const items: TodoItem[] = [];

	// Flexible header: "Plan:", "**Plan:**", "## Plan", "# Plan", "Plan\n"
	const headerPattern = /(?:^|\n)\s*\*{0,2}(?:#{1,4}\s+)?Plan:?\*{0,2}[\s.:—–]*\n/im;
	const headerMatch = message.match(headerPattern);

	let planSection: string;
	if (headerMatch) {
		planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
	} else {
		planSection = message;
	}

	// Parse line by line to capture title + description for each numbered item
	const lines = planSection.split("\n");
	const numberedLinePattern = /^\s*(\d+)\s*[.)\-:]\s+(.+)$/;

	let currentItem: { step: number; title: string; descriptionLines: string[] } | null = null;

	for (const line of lines) {
		const match = line.match(numberedLinePattern);
		if (match) {
			// Save previous item
			if (currentItem) {
				const title = cleanStepText(stripMarkdown(currentItem.title));
				const description = currentItem.descriptionLines.map(stripMarkdown).join(" ").trim();
				if (title.length > 2) {
					items.push({
						step: currentItem.step,
						title,
						description,
						completed: false,
					});
				}
			}

			let rawTitle = match[2].trim();
			// Remove surrounding [brackets] from title: "[1]. [Title]" → "Title"
			rawTitle = rawTitle.replace(/^\[([^\]]+)\]\s*\.?\s*/, "$1");

			currentItem = {
				step: Number(match[1]),
				title: rawTitle,
				descriptionLines: [],
			};
		} else if (currentItem) {
			const trimmed = line.trim();
			if (trimmed) {
				currentItem.descriptionLines.push(trimmed);
			}
		}
	}

	// Don't forget the last item
	if (currentItem) {
		const title = cleanStepText(stripMarkdown(currentItem.title));
		const description = currentItem.descriptionLines.map(stripMarkdown).join(" ").trim();
		if (title.length > 2) {
			items.push({
				step: currentItem.step,
				title,
				description,
				completed: false,
			});
		}
	}

	// Without a Plan header, require at least 3 numbered items starting from 1
	if (!headerMatch && items.length > 0) {
		if (items.length < 3 || items[0].step !== 1) {
			return [];
		}
	}

	return items;
}

export function extractDoneSteps(message: string): number[] {
	const steps: number[] = [];
	for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
		const step = Number(match[1]);
		if (Number.isFinite(step)) steps.push(step);
	}
	return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
	const doneSteps = extractDoneSteps(text);
	for (const step of doneSteps) {
		const item = items.find((t) => t.step === step);
		if (item) item.completed = true;
	}
	return doneSteps.length;
}

export function generatePlanMarkdown(items: TodoItem[]): string {
	const lines: string[] = ["# Plan", ""];

	for (const item of items) {
		const status = item.completed ? "✅ Completed" : "⬜ Not started";
		lines.push(`## [${item.step}]. ${item.title}`);
		lines.push("");
		if (item.description) {
			lines.push(item.description);
			lines.push("");
		}
		lines.push(`**Status:** ${status}`);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	return lines.join("\n");
}

export async function writePlanFile(filePath: string, items: TodoItem[]): Promise<void> {
	const content = generatePlanMarkdown(items);
	await writeFile(filePath, content, "utf-8");
}

export async function updatePlanFile(filePath: string, items: TodoItem[]): Promise<void> {
	try {
		// Re-generate and overwrite the entire file
		const content = generatePlanMarkdown(items);
		await writeFile(filePath, content, "utf-8");
	} catch {
		// File may not exist or be unwritable; ignore
	}
}

export async function deletePlanFile(filePath: string): Promise<void> {
	try {
		await unlink(filePath);
	} catch {
		// File may not exist; ignore
	}
}