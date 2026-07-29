import {
	type CellDimensions,
	encodeKittyDeleteImage,
	encodeKittyPlacement,
	encodeKittyRgbTransmit,
	getCellDimensions,
	ImageBudget,
} from "@oh-my-pi/pi-tui";

export const KITTY_CRAWL_FRAME_MS = 48;
export const KITTY_CRAWL_MAX_WIDTH_PX = 1440;
export const KITTY_CRAWL_MAX_HEIGHT_PX = 810;
export const KITTY_CRAWL_WRAP_COLUMNS = 38;

const FIRST_GLYPH = 32;
const LAST_GLYPH = 126;
const FONT_CENTER_Y = 10.5;
const BODY_GLYPH_WIDTH = 18;
const SCROLL_UNITS_PER_SECOND = 1.5;
const LINE_SPACING = 0.65;
const PERSPECTIVE_STRENGTH = 0.16;
const HORIZON_RATIO = 0.11;
const BOTTOM_RATIO = 0.81;
const FADE_START = 0.22;
const FADE_END = 0.38;
const BODY_NEAR_WIDTH = 0.88;
const RESERVED_IMAGE_ROW = "\x1b[0m";
const SAVE_CURSOR = "\x1b7";
const RESTORE_CURSOR = "\x1b8";

// Public-domain Hershey Roman Simplex stroke data for printable ASCII (U+0020–U+007E).
const FONT_DATA = Buffer.from(
	"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",
	"base64",
);

const GLYPH_OFFSETS = new Uint16Array(LAST_GLYPH - FIRST_GLYPH + 1);
for (let glyph = 0, offset = 0; glyph < GLYPH_OFFSETS.length; glyph++) {
	GLYPH_OFFSETS[glyph] = offset;
	offset += 2 + FONT_DATA[offset + 1] * 2;
}

export interface KittyCrawlLine {
	readonly text: string;
	readonly kind: "title" | "episode" | "heading" | "body";
}

export interface KittyCrawlRasterFrame {
	readonly width: number;
	readonly height: number;
	readonly rgb: Uint8Array;
	readonly complete: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = clamp((value - edge0) / Math.max(Number.EPSILON, edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

export function getKittyCrawlCanvasSize(
	columns: number,
	rows: number,
	cellDimensions: CellDimensions = getCellDimensions(),
) {
	const physicalWidth = Math.max(1, Math.trunc(columns)) * Math.max(1, cellDimensions.widthPx);
	const physicalHeight = Math.max(1, Math.trunc(rows)) * Math.max(1, cellDimensions.heightPx);
	const scale = Math.min(1, KITTY_CRAWL_MAX_WIDTH_PX / physicalWidth, KITTY_CRAWL_MAX_HEIGHT_PX / physicalHeight);
	return {
		width: Math.max(1, Math.round(physicalWidth * scale)),
		height: Math.max(1, Math.round(physicalHeight * scale)),
	};
}

function hash32(value: number): number {
	let hash = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
	hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
	return (hash ^ (hash >>> 16)) >>> 0;
}

function blendPixel(
	rgb: Uint8Array,
	width: number,
	height: number,
	x: number,
	y: number,
	red: number,
	green: number,
	blue: number,
	alpha: number,
): void {
	if (x < 0 || x >= width || y < 0 || y >= height || alpha <= 0) return;
	const index = (y * width + x) * 3;
	const amount = clamp(alpha, 0, 1);
	rgb[index] = Math.round(rgb[index] + (red - rgb[index]) * amount);
	rgb[index + 1] = Math.round(rgb[index + 1] + (green - rgb[index + 1]) * amount);
	rgb[index + 2] = Math.round(rgb[index + 2] + (blue - rgb[index + 2]) * amount);
}

function drawStars(rgb: Uint8Array, width: number, height: number, frame: number): void {
	const count = clamp(Math.floor((width * height) / 1_900), 90, 360);
	for (let index = 0; index < count; index++) {
		const seed = hash32(index + 1);
		const x = seed % width;
		const y = hash32(seed) % height;
		const phase = (frame + ((seed >>> 16) % 31)) % 31;
		const brightness = phase === 0 ? 235 : phase < 4 ? 145 : 72;
		blendPixel(rgb, width, height, x, y, brightness, brightness, brightness + 12, 1);
		if (phase === 0 && width > 160 && height > 90) {
			blendPixel(rgb, width, height, x - 1, y, 88, 118, 138, 0.7);
			blendPixel(rgb, width, height, x + 1, y, 88, 118, 138, 0.7);
			blendPixel(rgb, width, height, x, y - 1, 88, 118, 138, 0.7);
			blendPixel(rgb, width, height, x, y + 1, 88, 118, 138, 0.7);
		}
	}
}

function sourceTextWidth(text: string): number {
	let width = 0;
	for (let index = 0; index < text.length; index++) {
		const codepoint = text.charCodeAt(index);
		const safeCodepoint = codepoint >= FIRST_GLYPH && codepoint <= LAST_GLYPH ? codepoint : 63;
		width += FONT_DATA[GLYPH_OFFSETS[safeCodepoint - FIRST_GLYPH]];
	}
	return Math.max(1, width);
}

function nearScale(kind: KittyCrawlLine["kind"], text: string, width: number): number {
	const measured = sourceTextWidth(text);
	const bodyScale = (width * BODY_NEAR_WIDTH) / (KITTY_CRAWL_WRAP_COLUMNS * BODY_GLYPH_WIDTH);
	switch (kind) {
		case "title":
			return (width * 0.82) / measured;
		case "episode":
			return (width * 0.74) / measured;
		case "heading":
			return Math.min(bodyScale * 1.45, (width * 0.64) / measured);
		default:
			return bodyScale;
	}
}

function drawAntialiasedSegment(
	rgb: Uint8Array,
	width: number,
	height: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	strokeWidth: number,
	color: readonly [number, number, number],
	opacity: number,
): void {
	const radius = strokeWidth / 2;
	const fringe = 0.75;
	const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radius - fringe));
	const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + radius + fringe));
	const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radius - fringe));
	const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + radius + fringe));
	const dx = x1 - x0;
	const dy = y1 - y0;
	const lengthSquared = dx * dx + dy * dy;

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const along =
				lengthSquared > Number.EPSILON
					? clamp(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / lengthSquared, 0, 1)
					: 0;
			const nearestX = x0 + along * dx;
			const nearestY = y0 + along * dy;
			const distance = Math.hypot(x + 0.5 - nearestX, y + 0.5 - nearestY);
			const coverage = clamp(radius + fringe - distance, 0, 1);
			if (coverage > 0) {
				blendPixel(rgb, width, height, x, y, color[0], color[1], color[2], coverage * opacity);
			}
		}
	}
}

function drawVectorText(
	rgb: Uint8Array,
	width: number,
	height: number,
	text: string,
	left: number,
	centerY: number,
	scaleX: number,
	scaleY: number,
	strokeWidth: number,
	color: readonly [number, number, number],
	opacity: number,
): void {
	let cursor = 0;
	for (let character = 0; character < text.length; character++) {
		const codepoint = text.charCodeAt(character);
		const safeCodepoint = codepoint >= FIRST_GLYPH && codepoint <= LAST_GLYPH ? codepoint : 63;
		const offset = GLYPH_OFFSETS[safeCodepoint - FIRST_GLYPH];
		const advance = FONT_DATA[offset];
		const points = FONT_DATA[offset + 1];
		let previousX: number | undefined;
		let previousY: number | undefined;
		for (let point = 0; point < points; point++) {
			const xByte = FONT_DATA[offset + 2 + point * 2];
			const yByte = FONT_DATA[offset + 3 + point * 2];
			const x = xByte > 127 ? xByte - 256 : xByte;
			const y = yByte > 127 ? yByte - 256 : yByte;
			if (x === -1 && y === -1) {
				previousX = undefined;
				previousY = undefined;
				continue;
			}
			const projectedX = left + (cursor + x) * scaleX;
			const projectedY = centerY + (FONT_CENTER_Y - y) * scaleY;
			if (previousX !== undefined && previousY !== undefined) {
				drawAntialiasedSegment(
					rgb,
					width,
					height,
					previousX,
					previousY,
					projectedX,
					projectedY,
					strokeWidth,
					color,
					opacity,
				);
			}
			previousX = projectedX;
			previousY = projectedY;
		}
		cursor += advance;
	}
}

export function rasterizeKittyCrawl(
	columns: number,
	rows: number,
	elapsedMs: number,
	lines: readonly KittyCrawlLine[],
	buffer?: Uint8Array,
	cellDimensions: CellDimensions = getCellDimensions(),
): KittyCrawlRasterFrame {
	const size = getKittyCrawlCanvasSize(columns, rows, cellDimensions);
	const requiredBytes = size.width * size.height * 3;
	const rgb = buffer?.byteLength === requiredBytes ? buffer : new Uint8Array(requiredBytes);
	rgb.fill(0);

	const frame = Math.floor(Math.max(0, elapsedMs) / KITTY_CRAWL_FRAME_MS);
	drawStars(rgb, size.width, size.height, Math.floor(frame / 2));
	const horizon = size.height * HORIZON_RATIO;
	const bottom = size.height * BOTTOM_RATIO;
	const scroll = (Math.max(0, elapsedMs) / 1_000) * SCROLL_UNITS_PER_SECOND;
	let lastContentIndex = 0;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (!line.text) continue;
		lastContentIndex = index;
		const travel = (scroll - index) * LINE_SPACING;
		if (travel < 0) continue;
		const perspective = 1 / (1 + PERSPECTIVE_STRENGTH * travel);
		if (perspective <= FADE_START) continue;
		const scaleX = nearScale(line.kind, line.text, size.width) * perspective;
		const scaleY = scaleX * 0.72 * perspective;
		const projectedWidth = sourceTextWidth(line.text) * scaleX;
		if (projectedWidth < 2 || scaleY < 0.08) continue;
		const proximity = smoothstep(0.08, 1, perspective);
		const color = [
			Math.round(160 + 95 * proximity),
			Math.round(96 + 126 * proximity),
			Math.round(18 + 48 * proximity),
		] as const;
		const weight = line.kind === "title" ? 0.82 : line.kind === "episode" ? 0.72 : 0.62;
		drawVectorText(
			rgb,
			size.width,
			size.height,
			line.text,
			(size.width - projectedWidth) / 2,
			horizon + (bottom - horizon) * perspective,
			scaleX,
			scaleY,
			Math.max(0.72, Math.min(4.2, scaleX * weight)),
			color,
			smoothstep(FADE_START, FADE_END, perspective),
		);
	}

	const completeTravel = (1 / FADE_START - 1) / PERSPECTIVE_STRENGTH;
	const complete = (scroll - lastContentIndex) * LINE_SPACING > completeTravel;
	const hint = complete ? "ENTER TO CONTINUE" : "ENTER TO SKIP";
	const hintScale = size.width < 360 ? 0.55 : 0.72;
	drawVectorText(
		rgb,
		size.width,
		size.height,
		hint,
		(size.width - sourceTextWidth(hint) * hintScale) / 2,
		size.height - Math.max(7, Math.round(size.height * 0.025)),
		hintScale,
		hintScale * 0.78,
		0.9,
		[104, 108, 116],
		1,
	);
	return { ...size, rgb, complete };
}

export class KittyUpdateCrawlRenderer {
	readonly #imageId = new ImageBudget(1).acquireId("update-crawl-cinematic");
	#pixels: Uint8Array | undefined;
	#cachedLines: readonly string[] | undefined;
	#cachedFrame = -1;
	#cachedColumns = 0;
	#cachedRows = 0;
	#disposed = false;

	constructor(readonly lines: readonly KittyCrawlLine[]) {}

	render(columns: number, rows: number, elapsedMs: number): readonly string[] {
		if (this.#disposed) return [];
		const safeColumns = Math.max(1, Math.trunc(columns));
		const safeRows = Math.max(1, Math.trunc(rows));
		const frame = Math.floor(Math.max(0, elapsedMs) / KITTY_CRAWL_FRAME_MS);
		if (
			this.#cachedLines &&
			frame === this.#cachedFrame &&
			safeColumns === this.#cachedColumns &&
			safeRows === this.#cachedRows
		) {
			return this.#cachedLines;
		}

		const raster = rasterizeKittyCrawl(safeColumns, safeRows, elapsedMs, this.lines, this.#pixels);
		this.#pixels = raster.rgb;
		const transmit = encodeKittyRgbTransmit(raster.rgb, raster.width, raster.height, this.#imageId);
		const placement = encodeKittyPlacement({
			imageId: this.#imageId,
			placementId: this.#imageId,
			columns: safeColumns,
			rows: safeRows,
		});
		const lines = Array<string>(safeRows).fill(RESERVED_IMAGE_ROW);
		const cursorRows = safeRows - 1;
		const moveUp = cursorRows > 0 ? `\x1b[${cursorRows}A` : "";
		lines[safeRows - 1] = `${SAVE_CURSOR}${moveUp}${transmit}${placement}${RESTORE_CURSOR}`;
		this.#cachedLines = lines;
		this.#cachedFrame = frame;
		this.#cachedColumns = safeColumns;
		this.#cachedRows = safeRows;
		return lines;
	}

	dispose(): string {
		if (this.#disposed) return "";
		this.#disposed = true;
		this.#pixels = undefined;
		this.#cachedLines = undefined;
		return encodeKittyDeleteImage(this.#imageId);
	}
}
