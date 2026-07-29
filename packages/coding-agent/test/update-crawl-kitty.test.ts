import { describe, expect, it } from "bun:test";
import {
	getKittyCrawlCanvasSize,
	KITTY_CRAWL_FRAME_MS,
	KITTY_CRAWL_MAX_HEIGHT_PX,
	KITTY_CRAWL_MAX_WIDTH_PX,
	type KittyCrawlRasterFrame,
	KittyUpdateCrawlRenderer,
	rasterizeKittyCrawl,
} from "@oh-my-pi/pi-coding-agent/modes/components/update-crawl-kitty";

const CELL_DIMENSIONS = { widthPx: 9, heightPx: 18 } as const;
const TITLE_ONLY = [{ text: "OH MY PI", kind: "title" }] as const;

function goldenBounds(frame: KittyCrawlRasterFrame): { width: number; centerY: number } {
	let left = frame.width;
	let right = -1;
	let top = frame.height;
	let bottom = -1;
	for (let y = 0; y < frame.height; y++) {
		for (let x = 0; x < frame.width; x++) {
			const index = (y * frame.width + x) * 3;
			const red = frame.rgb[index];
			const green = frame.rgb[index + 1];
			const blue = frame.rgb[index + 2];
			if (red < 120 || green < 50 || blue >= 100) continue;
			left = Math.min(left, x);
			right = Math.max(right, x);
			top = Math.min(top, y);
			bottom = Math.max(bottom, y);
		}
	}
	if (right < left || bottom < top) throw new Error("Expected rasterized gold text");
	return { width: right - left + 1, centerY: (top + bottom) / 2 };
}

describe("Kitty update crawl renderer", () => {
	it("bounds the pixel buffer while preserving the terminal aspect ratio", () => {
		const size = getKittyCrawlCanvasSize(300, 100, CELL_DIMENSIONS);
		expect(size.width).toBeLessThanOrEqual(KITTY_CRAWL_MAX_WIDTH_PX);
		expect(size.height).toBeLessThanOrEqual(KITTY_CRAWL_MAX_HEIGHT_PX);
		expect(size.width / size.height).toBeCloseTo(
			(300 * CELL_DIMENSIONS.widthPx) / (100 * CELL_DIMENSIONS.heightPx),
			2,
		);
		expect(size.width * size.height * 3).toBeLessThanOrEqual(
			KITTY_CRAWL_MAX_WIDTH_PX * KITTY_CRAWL_MAX_HEIGHT_PX * 3,
		);
	});

	it("moves and shrinks rasterized title text continuously toward the horizon", () => {
		const near = rasterizeKittyCrawl(100, 30, 0, TITLE_ONLY, undefined, CELL_DIMENSIONS);
		const far = rasterizeKittyCrawl(100, 30, 10_000, TITLE_ONLY, undefined, CELL_DIMENSIONS);
		const nearBounds = goldenBounds(near);
		const farBounds = goldenBounds(far);

		expect(far.rgb).not.toEqual(near.rgb);
		expect(farBounds.width).toBeLessThan(nearBounds.width / 2);
		expect(farBounds.centerY).toBeLessThan(nearBounds.centerY);
	});

	it("draws antialiased vector strokes without skewing enlarged title glyphs", () => {
		const frame = rasterizeKittyCrawl(100, 30, 0, [{ text: "H", kind: "title" }], undefined, CELL_DIMENSIONS);
		const leftEdges: number[] = [];
		const goldLevels = new Set<number>();
		for (let y = 0; y < frame.height - 30; y++) {
			const xs: number[] = [];
			for (let x = 0; x < frame.width; x++) {
				const index = (y * frame.width + x) * 3;
				const red = frame.rgb[index];
				const green = frame.rgb[index + 1];
				const blue = frame.rgb[index + 2];
				if (red < 120 || green < 50 || blue >= 100) continue;
				xs.push(x);
				goldLevels.add(red);
			}
			if (xs.length >= 2) leftEdges.push(Math.min(...xs));
		}

		expect(goldLevels.size).toBeGreaterThan(4);
		expect(leftEdges.length).toBeGreaterThan(20);
		expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(2);
	});

	it("reuses one raster buffer and replaces one stable Kitty image", () => {
		const firstRaster = rasterizeKittyCrawl(80, 24, 0, TITLE_ONLY, undefined, CELL_DIMENSIONS);
		const nextRaster = rasterizeKittyCrawl(
			80,
			24,
			KITTY_CRAWL_FRAME_MS,
			TITLE_ONLY,
			firstRaster.rgb,
			CELL_DIMENSIONS,
		);
		expect(nextRaster.rgb).toBe(firstRaster.rgb);

		const renderer = new KittyUpdateCrawlRenderer(TITLE_ONLY);
		const first = renderer.render(80, 24, 0);
		const cached = renderer.render(80, 24, KITTY_CRAWL_FRAME_MS - 1);
		const next = renderer.render(80, 24, KITTY_CRAWL_FRAME_MS);
		expect(first).toHaveLength(24);
		expect(cached).toBe(first);
		expect(next).not.toBe(first);
		expect(first.join("\n")).toContain("f=24");
		expect(first.join("\n")).toContain("o=z");
		expect(renderer.dispose()).toContain("a=d,d=I");
		expect(renderer.dispose()).toBe("");
		expect(renderer.render(80, 24, 0)).toEqual([]);
	});
});
