/**
 * SCX ui: drawing primitives shared by every image of the /scx system.
 */
const { Canvas, hasCJK, FONT_STACK, DEFAULT_THEME } = require("./core");

const isHttp = v => typeof v === "string" && /^https?:\/\//i.test(v);

function paint(ctx, color, x1, y1, x2, y2) {
	if (Array.isArray(color)) {
		if (color.length === 1) return color[0];
		const g = ctx.createLinearGradient(x1, y1, x2, y2);
		color.forEach((c, i) => g.addColorStop(i / (color.length - 1), c));
		return g;
	}
	return color;
}

function rr(ctx, x, y, w, h, r) {
	r = Math.max(0, Math.min(r, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function fit(ctx, text, maxW, size, min = 14) {
	let s = size;
	do {
		ctx.font = `${s}px ${FONT_STACK}`;
		if (ctx.measureText(text).width <= maxW) break;
		s -= 2;
	} while (s > min);
	return ctx.font;
}

/** Draw text with optional gradient + auto-shrink. Returns text width. */
function txt(ctx, str, x, y, { size = 30, color = "#ffffff", align = "left", maxW = null, min = 14 } = {}) {
	str = String(str);
	ctx.textAlign = align;
	if (maxW) ctx.font = fit(ctx, str, maxW, size, min);
	else ctx.font = `${size}px ${FONT_STACK}`;
	const w = ctx.measureText(str).width;
	const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
	ctx.fillStyle = paint(ctx, color, x0, y - size, x0 + w, y);
	ctx.fillText(str, x, y);
	return w;
}

async function loadImg(src, ms = 8000) {
	if (!src || !Canvas) return null;
	let timer;
	try {
		return await Promise.race([
			Canvas.loadImage(src),
			new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), ms); })
		]);
	}
	catch (e) { return null; }
	finally { clearTimeout(timer); }
}

async function loadAvatar(usersData, uid) {
	try { return await loadImg(await usersData.getAvatarUrl(uid)); }
	catch (e) { return null; }
}

function drawCover(ctx, img, W, H) {
	const s = Math.max(W / img.width, H / img.height);
	const w = img.width * s, h = img.height * s;
	ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function clouds(ctx, x, y, r, color) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 3;
	for (let i = 0; i < 4; i++) {
		ctx.beginPath();
		ctx.arc(x, y, r - i * 22, Math.PI, 2 * Math.PI);
		ctx.stroke();
	}
	ctx.restore();
}

function corner(ctx, x, y, dx, dy) {
	ctx.beginPath();
	ctx.moveTo(x + dx * 80, y);
	ctx.lineTo(x, y);
	ctx.lineTo(x, y + dy * 80);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + dx * 22, y + dy * 10);
	ctx.lineTo(x + dx * 32, y + dy * 22);
	ctx.lineTo(x + dx * 22, y + dy * 34);
	ctx.lineTo(x + dx * 12, y + dy * 22);
	ctx.closePath();
	ctx.fill();
}

/**
 * Background + panel + gold frame. Leaves a rounded clip open: call finish() at the end.
 * opts.watermark = { char, x, y, size }
 */
async function createBase(W, H, t, { radius = 44, watermark = null } = {}) {
	if (!Canvas) throw new Error("canvas package is not installed");
	const canvas = Canvas.createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	ctx.textBaseline = "alphabetic";

	ctx.save();
	rr(ctx, 0, 0, W, H, radius);
	ctx.clip();

	let drawn = false;
	if (isHttp(t.main_color)) {
		const img = await loadImg(t.main_color);
		if (img) { drawCover(ctx, img, W, H); drawn = true; }
	}
	if (!drawn) {
		ctx.fillStyle = paint(ctx, isHttp(t.main_color) ? DEFAULT_THEME.main_color : t.main_color, 0, 0, W, H);
		ctx.fillRect(0, 0, W, H);
	}

	// inner panel
	ctx.save();
	ctx.globalAlpha = t.alpha_subcard;
	ctx.fillStyle = paint(ctx, t.sub_color, 0, 0, W, H);
	rr(ctx, 28, 28, W - 56, H - 56, radius - 12);
	ctx.fill();
	ctx.restore();

	// decoration: clouds + watermark
	ctx.save();
	ctx.globalAlpha = 0.1;
	const cc = Array.isArray(t.border_color) ? t.border_color[0] : t.border_color;
	clouds(ctx, 140, H, 150, cc);
	clouds(ctx, W - 420, H, 190, cc);
	clouds(ctx, W - 90, 70, 110, cc);
	ctx.restore();
	if (watermark && hasCJK) {
		ctx.save();
		ctx.globalAlpha = 0.08;
		ctx.textAlign = "center";
		ctx.font = `${watermark.size}px ${FONT_STACK}`;
		ctx.fillStyle = paint(ctx, t.realm_color, watermark.x - 300, 0, watermark.x + 300, H);
		ctx.fillText(watermark.char, watermark.x, watermark.y);
		ctx.restore();
	}

	// frame
	const borderPaint = paint(ctx, t.border_color, 0, 0, W, 0);
	ctx.strokeStyle = borderPaint;
	ctx.fillStyle = borderPaint;
	ctx.lineWidth = 5;
	rr(ctx, 28, 28, W - 56, H - 56, radius - 12);
	ctx.stroke();
	ctx.lineWidth = 1.5;
	rr(ctx, 44, 44, W - 88, H - 88, radius - 20);
	ctx.stroke();
	ctx.lineWidth = 7;
	corner(ctx, 60, 60, 1, 1);
	corner(ctx, W - 60, 60, -1, 1);
	corner(ctx, 60, H - 60, 1, -1);
	corner(ctx, W - 60, H - 60, -1, -1);

	return { canvas, ctx, borderPaint, W, H, t };
}

function finish(base) {
	base.ctx.restore();
	return base.canvas.createPNGStream();
}

function divider(ctx, x1, x2, y, borderPaint) {
	ctx.save();
	ctx.strokeStyle = borderPaint;
	ctx.fillStyle = borderPaint;
	ctx.globalAlpha = 0.75;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x1, y);
	ctx.lineTo(x2, y);
	ctx.stroke();
	const cx = (x1 + x2) / 2;
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.moveTo(cx, y - 9);
	ctx.lineTo(cx + 9, y);
	ctx.lineTo(cx, y + 9);
	ctx.lineTo(cx - 9, y);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawAvatar(ctx, img, cx, cy, r, t, borderPaint, ring = 8) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.clip();
	if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
	else {
		ctx.fillStyle = paint(ctx, t.bar_color, cx - r, cy - r, cx + r, cy + r);
		ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
	}
	ctx.restore();
	ctx.save();
	ctx.strokeStyle = borderPaint;
	ctx.lineWidth = ring;
	ctx.beginPath();
	ctx.arc(cx, cy, r + ring / 2 - 1, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function drawSeal(ctx, cx, cy, size, t, char, rot = -0.1) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(rot);
	ctx.fillStyle = paint(ctx, t.seal_color, -size / 2, -size / 2, size / 2, size / 2);
	rr(ctx, -size / 2, -size / 2, size, size, size * 0.075);
	ctx.fill();
	ctx.strokeStyle = "#f6e9cf";
	ctx.lineWidth = Math.max(3, size * 0.026);
	rr(ctx, -size / 2 + size * 0.063, -size / 2 + size * 0.063, size * 0.874, size * 0.874, size * 0.04);
	ctx.stroke();
	ctx.fillStyle = "#f6e9cf";
	ctx.textAlign = "center";
	if (hasCJK && char && char.length === 1) {
		ctx.font = `${size * 0.63}px ${FONT_STACK}`;
		ctx.fillText(char, 0, size * 0.22);
	}
	else {
		ctx.font = `${size * 0.34}px ${FONT_STACK}`;
		ctx.fillText("SCX", 0, size * 0.12);
	}
	ctx.restore();
}

/** Round rank badge (gold / silver / bronze for the top 3). */
function badge(ctx, n, cx, cy, r, t) {
	const medal = { 1: ["#ffe08a", "#d4a017"], 2: ["#f4f4f4", "#9a9a9a"], 3: ["#f0b27a", "#9c5a2c"] }[n];
	ctx.save();
	if (medal) {
		const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
		g.addColorStop(0, medal[0]);
		g.addColorStop(1, medal[1]);
		ctx.fillStyle = g;
	}
	else ctx.fillStyle = paint(ctx, t.bar_color, cx - r, cy - r, cx + r, cy + r);
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = 3;
	ctx.strokeStyle = medal ? "#fff6d8" : paint(ctx, t.border_color, cx - r, cy, cx + r, cy);
	ctx.stroke();
	ctx.restore();
	const s = String(n);
	txt(ctx, s, cx, cy + r * 0.36, { size: s.length > 2 ? r * 0.8 : r * 1.0, color: medal ? "#3a1500" : t.text_color, align: "center" });
}

/** Centered page title. Returns the y where content can start. */
function drawHeader(base, { zh, en, sub }) {
	const { ctx, W, t, borderPaint } = base;
	let y;
	if (hasCJK && zh) {
		txt(ctx, zh, W / 2, 130, { size: 90, color: t.realm_color, align: "center", maxW: W - 400 });
		txt(ctx, en, W / 2, 182, { size: 38, color: t.name_color, align: "center", maxW: W - 400 });
		y = 182;
	}
	else {
		txt(ctx, en, W / 2, 140, { size: 72, color: t.realm_color, align: "center", maxW: W - 400 });
		y = 140;
	}
	if (sub) {
		txt(ctx, sub, W / 2, y + 46, { size: 28, color: t.exp_text_color, align: "center", maxW: W - 400 });
		y += 46;
	}
	divider(ctx, 120, W - 120, y + 34, borderPaint);
	return y + 34;
}

/* ------------------------------------------------------------------ */
/*  Notice image (help, on/off confirmations, errors, "no data")        */
/* ------------------------------------------------------------------ */
async function renderNotice(t, n) {
	const W = 1500;
	const lines = n.lines || [];
	const cjk = hasCJK && n.zh;
	const start = cjk ? 268 : 220;
	const H = Math.max(320, start + Math.max(0, lines.length - 1) * 50 + 80);
	const base = await createBase(W, H, t);
	const { ctx, borderPaint } = base;

	drawSeal(ctx, 215, Math.min(H / 2, 190), 170, t, n.seal || (n.zh ? n.zh.charAt(0) : "道"));

	const tx = 380;
	if (cjk) {
		txt(ctx, n.zh, tx, 125, { size: 64, color: t.realm_color, maxW: 1000 });
		txt(ctx, n.title, tx, 178, { size: 36, color: t.name_color, maxW: 1000 });
		divider(ctx, tx, W - 110, 212, borderPaint);
	}
	else {
		txt(ctx, n.title, tx, 130, { size: 56, color: t.realm_color, maxW: 1000 });
		divider(ctx, tx, W - 110, 165, borderPaint);
	}
	lines.forEach((l, i) => txt(ctx, l, tx, start + i * 50, { size: 32, color: t.exp_text_color, maxW: W - tx - 110 }));
	return finish(base);
}

function nameStream(stream) {
	stream.path = `scx_${Math.random().toString(36).slice(2, 10)}.png`;
	return stream;
}

async function sendImage(message, stream, body) {
	return message.reply(body ? { body, attachment: nameStream(stream) } : { attachment: nameStream(stream) });
}

/** Send a notice as an image (plain text only if canvas is unavailable). */
async function sendNotice(message, t, n) {
	try { return await sendImage(message, await renderNotice(t, n)); }
	catch (e) { return message.reply([n.title, ...(n.lines || [])].join("\n")); }
}

async function renderLeaderboard(t, entries, { page = 1, pages = 1, title = "Cultivation Ranking", subtitle = "", universal = false, firstRank = 1, getStageInfo } = {}) {
	const W = 1500;
	const rowHeight = 96;
	const H = Math.max(380, 300 + entries.length * rowHeight);
	const base = await createBase(W, H, t, {
		watermark: { char: "榜", x: W / 2, y: H / 2 + 120, size: 430 }
	});
	const { ctx, borderPaint } = base;
	const startY = drawHeader(base, {
		zh: "修仙榜",
		en: title,
		sub: `${subtitle}  ·  Page ${page}/${pages}`
	}) + 24;

	entries.forEach((entry, index) => {
		const y = startY + index * rowHeight;
		const rank = firstRank + index;
		badge(ctx, rank, 145, y + 20, 32, t);
		txt(ctx, entry.name || "Unknown", 205, y + 12, {
			size: 36,
			color: t.name_color,
			maxW: 850
		});

		const info = getStageInfo(entry.exp);
		txt(ctx, `${info.stage.zh}  ·  ${info.stage.name}`, 205, y + 51, {
			size: 27,
			color: t.text_color,
			maxW: 900
		});

		const total = `${Number(entry.exp).toLocaleString()} EXP`;
		const meta = universal ? `${total}  ·  ${entry.groups} groups` : total;
		txt(ctx, meta, W - 130, y + 32, {
			size: 25,
			color: t.exp_text_color,
			align: "right",
			maxW: 380
		});
		divider(ctx, 110, W - 110, y + 70, borderPaint);
	});

	return finish(base);
}

async function renderRealms(t, realms, stages) {
	const W = 1500;
	const rowHeight = 78;
	const H = Math.max(380, 300 + realms.length * rowHeight);
	const base = await createBase(W, H, t, {
		watermark: { char: "境", x: W / 2, y: H / 2 + 120, size: 430 }
	});
	const { ctx, borderPaint } = base;
	const startY = drawHeader(base, {
		zh: "修仙境界",
		en: "Cultivation Realms",
		sub: `${realms.length} realms  ·  ${stages.length} stages`
	}) + 22;

	realms.forEach((realm, index) => {
		const y = startY + index * rowHeight;
		const stageCount = stages.filter(stage => stage.realm === index).length;
		txt(ctx, `${String(index + 1).padStart(2, "0")}  ${realm.zh}`, 130, y + 12, {
			size: 34,
			color: t.realm_color,
			maxW: 370
		});
		txt(ctx, realm.en, 530, y + 12, {
			size: 32,
			color: t.name_color,
			maxW: 670
		});
		txt(ctx, `${stageCount} stages`, W - 130, y + 12, {
			size: 25,
			color: t.exp_text_color,
			align: "right",
			maxW: 250
		});
		txt(ctx, realm.desc || "Cultivation realm", 205, y + 47, {
			size: 21,
			color: t.text_color,
			maxW: W - 335
		});
		divider(ctx, 110, W - 110, y + 58, borderPaint);
	});

	return finish(base);
}

module.exports = {
	isHelper: true,
	isHttp, paint, rr, fit, txt, loadImg, loadAvatar, createBase, finish, divider,
	drawAvatar, drawSeal, badge, drawHeader, renderNotice, sendImage, sendNotice, renderLeaderboard, renderRealms, nameStream
};
