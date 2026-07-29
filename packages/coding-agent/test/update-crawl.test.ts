import { beforeAll, describe, expect, it } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import {
	formatRomanVersion,
	renderUpdateCrawl,
	runUpdateCrawl,
	UPDATE_CRAWL_TICK_MS,
} from "@oh-my-pi/pi-coding-agent/modes/components/update-crawl";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";
import { type Component, ImageProtocol, TERMINAL } from "@oh-my-pi/pi-tui";

const stripAnsi = (text: string): string => Bun.stripANSI(text);
const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();
const TITLE_TOP = " ###  #   #    #   # #   #    ####  #####";
const firstRowContaining = (lines: readonly string[], needle: string): number =>
	lines.findIndex(line => stripAnsi(line).includes(needle));
const foregroundBefore = (line: string, needle: string): string | undefined => {
	const prefix = line.slice(0, line.indexOf(needle));
	return prefix.match(/\x1b\[[0-9;]*m/g)?.at(-1);
};

beforeAll(async () => {
	await initTheme(false);
});

describe("update crawl", () => {
	it("renders complete release notes beneath an ASCII title over twinkling stars", () => {
		const markdown = "## [2.4.0]\n\n### Added\n\n- A new feature with **bold** details.";
		const opening = renderUpdateCrawl(80, 24, 0, markdown, "2.4.0");
		const introText = renderUpdateCrawl(80, 24, 3_000, markdown, "2.4.0").map(stripAnsi).join("\n");
		const releaseText = renderUpdateCrawl(80, 24, 6_000, markdown, "2.4.0").map(stripAnsi).join("\n");
		const openingText = opening.map(stripAnsi).join("\n");
		const finishedText = renderUpdateCrawl(80, 24, 100_000, markdown, "2.4.0").map(stripAnsi).join("\n");

		expect(opening).toHaveLength(24);
		expect(opening.map(line => Bun.stringWidth(line))).toEqual(Array(24).fill(80));
		expect(introText).toContain(TITLE_TOP);
		expect(introText).toContain("EPISODE II.IV.N");
		expect(introText).not.toContain("RELEASE 2.4.0");
		expect(openingText).toMatch(/[✦*·]/);
		expect(releaseText).toContain("ADDED");
		expect(normalizeWhitespace(releaseText)).toContain("• A new feature with bold details.");
		expect(releaseText).toContain("enter to skip");
		expect(finishedText).toContain("enter to continue");
	});

	it("formats every numeric version component as a Roman numeral", () => {
		expect(formatRomanVersion("17.0.5")).toBe("XVII.N.V");
		expect(formatRomanVersion("2026.12.104-beta.3")).toBe("MMXXVI.XII.CIV-beta.III");
	});

	it("uses high-cadence crisp rows with linear vertical movement", () => {
		const markdown = "### Added\n\n- Smooth movement.";
		const opening = renderUpdateCrawl(80, 24, 0, markdown, "2.4.0");
		const titleRows = opening.filter(line => stripAnsi(line).includes(TITLE_TOP));
		const nearStart = firstRowContaining(opening, TITLE_TOP);
		const nearEnd = firstRowContaining(renderUpdateCrawl(80, 24, 1_000, markdown, "2.4.0"), TITLE_TOP);
		const farStart = firstRowContaining(renderUpdateCrawl(80, 24, 4_000, markdown, "2.4.0"), TITLE_TOP);
		const farEnd = firstRowContaining(renderUpdateCrawl(80, 24, 5_000, markdown, "2.4.0"), TITLE_TOP);

		expect(UPDATE_CRAWL_TICK_MS).toBeGreaterThanOrEqual(40);
		expect(UPDATE_CRAWL_TICK_MS).toBeLessThanOrEqual(50);
		expect(titleRows).toHaveLength(1);
		expect(nearStart - nearEnd).toBe(farStart - farEnd);
	});

	it("wraps complete lines without ellipses, preserves word spacing, and fades at the horizon", () => {
		const markdown =
			"### Added\n\n- BEGINNING a deliberately long release note whose complete wording must remain readable across conservatively wrapped crawl rows without losing its ENDING.";
		const frames = Array.from({ length: 81 }, (_, index) =>
			renderUpdateCrawl(80, 24, index * 250, markdown, "2.4.0"),
		);
		const allText = frames.flat().map(stripAnsi).join("\n");
		const readableFrame = renderUpdateCrawl(80, 24, 6_000, "### Added\n\n- A new feature.", "2.4.0");
		const readableText = readableFrame.map(stripAnsi).join("\n");
		const nearTitle = renderUpdateCrawl(80, 24, 0, markdown, "2.4.0").find(line =>
			stripAnsi(line).includes(TITLE_TOP),
		);
		const farTitle = renderUpdateCrawl(80, 24, 6_800, markdown, "2.4.0").find(line =>
			stripAnsi(line).includes(TITLE_TOP),
		);
		const fadedFrame = renderUpdateCrawl(80, 24, 8_000, markdown, "2.4.0").map(stripAnsi).join("\n");

		expect(normalizeWhitespace(allText)).toContain("BEGINNING");
		expect(normalizeWhitespace(allText)).toContain("ENDING");
		expect(allText).not.toContain("…");
		expect(allText).not.toContain("...");
		expect(readableText).toContain("• A new feature.");
		expect(nearTitle).toBeDefined();
		expect(farTitle).toBeDefined();
		expect(foregroundBefore(nearTitle!, TITLE_TOP)).not.toBe(foregroundBefore(farTitle!, TITLE_TOP));
		expect(fadedFrame).not.toContain(TITLE_TOP);
	});

	it("waits after the full crawl and only Enter skips or continues", async () => {
		const preCrawlFocus: Component = { render: () => [] };
		let focused: Component | undefined = preCrawlFocus;
		let overlayComponent: (Component & { handleInput(data: string): void }) | undefined;
		let hidden = false;
		const host = {
			ui: {
				terminal: { rows: 12, write: () => {} },
				showOverlay: (component: Component) => {
					overlayComponent = component as Component & { handleInput(data: string): void };
					const previousFocus = focused;
					focused = component;
					return {
						hide: () => {
							hidden = true;
							if (focused === component) focused = previousFocus;
						},
						setHidden: (nextHidden: boolean) => {
							hidden = nextHidden;
						},
						isHidden: () => hidden,
					};
				},
				setFocus: (component: Component) => {
					focused = component;
				},
				requestRender: () => {},
			},
		};

		const running = runUpdateCrawl(host, "### Fixed\n\n- A bug.", "2.4.0", {
			tickMs: 60_000,
			now: () => 0,
		});
		overlayComponent?.handleInput(" ");
		expect(hidden).toBe(false);

		overlayComponent?.handleInput("\r");
		await running;
		expect(hidden).toBe(true);
		expect(focused).toBe(preCrawlFocus);
	});

	it("uses Kitty only in direct terminals and preserves text fallbacks", async () => {
		const previousProtocol = TERMINAL.imageProtocol;
		const environmentKeys = [
			"TMUX",
			"STY",
			"ZELLIJ",
			"CMUX_WORKSPACE_ID",
			"CMUX_SURFACE_ID",
			"CMUX_REMOTE_TRANSPORT",
			"TERM",
		] as const;
		const previousEnvironment = Object.fromEntries(environmentKeys.map(key => [key, Bun.env[key]]));
		TERMINAL.imageProtocol = ImageProtocol.Kitty;
		for (const key of environmentKeys) delete Bun.env[key];
		Bun.env.TERM = "xterm-256color";
		const terminalWrites: string[] = [];
		let component: (Component & { handleInput(data: string): void }) | undefined;
		const host = {
			ui: {
				terminal: { rows: 12, write: (data: string) => terminalWrites.push(data) },
				showOverlay: (next: Component) => {
					component = next as Component & { handleInput(data: string): void };
					return { hide: () => {}, setHidden: () => {}, isHidden: () => false };
				},
				setFocus: () => {},
				requestRender: () => {},
			},
		};

		try {
			const graphicalRun = runUpdateCrawl(host, "### Added\n\n- Rasterized perspective.", "17.0.5", {
				tickMs: 60_000,
				now: () => 0,
			});
			const graphicalFrame = component!.render(80).join("\n");
			expect(graphicalFrame).toContain("\x1b_G");
			expect(graphicalFrame).toContain("f=24");
			component!.handleInput("\r");
			await graphicalRun;
			expect(terminalWrites.at(-1)).toContain("a=d,d=I");

			const textRun = runUpdateCrawl(host, "### Added\n\n- Portable fallback.", "17.0.5", {
				tickMs: 60_000,
				now: () => 0,
				renderer: "text",
			});
			const textFrame = component!.render(80).join("\n");
			expect(textFrame).not.toContain("\x1b_G");
			component!.handleInput("\r");
			await textRun;

			Bun.env.CMUX_WORKSPACE_ID = "test-workspace";
			const multiplexerRun = runUpdateCrawl(host, "### Fixed\n\n- Safe multiplexer fallback.", "17.0.5", {
				tickMs: 60_000,
				now: () => 0,
			});
			const multiplexerFrame = component!.render(80).join("\n");
			expect(multiplexerFrame).not.toContain("\x1b_G");
			component!.handleInput("\r");
			await multiplexerRun;
		} finally {
			TERMINAL.imageProtocol = previousProtocol;
			for (const key of environmentKeys) {
				const value = previousEnvironment[key];
				if (value === undefined) delete Bun.env[key];
				else Bun.env[key] = value;
			}
		}
	});

	it("registers crawl as an optional mode without changing the summary default", () => {
		expect(Settings.isolated().get("startup.changelogMode")).toBe("summary");
		expect(Settings.isolated({ "startup.changelogMode": "crawl" }).get("startup.changelogMode")).toBe("crawl");
	});
});
