/**
 * SCX video: Chinese-style animated announcement.
 * createRenderer() draws frames with node-canvas; encodeVideo() pipes them to ffmpeg.
 * Everything is designed on a 1280x720 logical canvas and scaled to the output size.
 */
const { spawn } = require("child_process");
const core = require("../core");
const ui = require("../ui");
const { ffmpegPath } = require("./voice");

const { Canvas, hasCJK } = core;
const { paint, txt } = ui;

const W = 1280, H = 720;
const GOLD = "247,215,116";
const RED = "224,56,45";

const clamp01 = x => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const even = n => Math.max(2, Math.round(n / 2) * 2);

function rng(seed) {
	let s = seed >>> 0;
	return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const PARTS = (() => {
	const r = rng(77);
	return Array.from({ length: 70 }, () => ({
		x: r() * W, speed: 18 + r() * 55, size: 1.4 + r() * 3.6, phase: r() * 6.28,
		f: 0.6 + r() * 1.4, amp: 8 + r() * 28, off: r() * (H + 60), red: r() < 0.38
	}));
})();

function mist(ctx, T) {
	const blobs = [
		[0.18, 0.30, 520, "150,20,20", 0.18, 0.11], [0.82, 0.72, 600, "120,15,25", 0.17, 0.08],
		[0.50, 0.95, 700, GOLD, 0.06, 0.06], [0.70, 0.18, 460, "170,30,20", 0.12, 0.09]
	];
	blobs.forEach(([bx, by, rad, col, a, sp], i) => {
		const cx = W * (bx + 0.07 * Math.sin(T * sp * 3 + i)), cy = H * (by + 0.05 * Math.cos(T * sp * 2.4 + i * 2));
		const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
		g.addColorStop(0, `rgba(${col},${a})`);
		g.addColorStop(1, `rgba(${col},0)`);
		ctx.fillStyle = g;
		ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
	});
}

function particles(ctx, T) {
	for (const p of PARTS) {
		const y = H + 30 - ((T * p.speed + p.off) % (H + 60));
		const x = p.x + Math.sin(T * p.f + p.phase) * p.amp;
		const a = 0.25 + 0.55 * Math.abs(Math.sin(T * 1.8 + p.phase));
		const col = p.red ? RED : GOLD;
		ctx.fillStyle = `rgba(${col},${a * 0.18})`;
		ctx.beginPath(); ctx.arc(x, y, p.size * 2.6, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = `rgba(${col},${a})`;
		ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
	}
}

function lantern(ctx, x, ropeLen, s, T, phase) {
	const sway = Math.sin(T * 1.3 + phase) * 0.07;
	const flick = 0.85 + 0.15 * Math.sin(T * 7 + phase * 3);
	ctx.save();
	ctx.translate(x, 0);
	ctx.strokeStyle = `rgba(${GOLD},0.6)`;
	ctx.lineWidth = 2;
	ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, ropeLen); ctx.stroke();
	ctx.translate(0, ropeLen);
	ctx.rotate(sway);
	const gl = ctx.createRadialGradient(0, 55 * s, 4, 0, 55 * s, 130 * s);
	gl.addColorStop(0, `rgba(255,120,60,${0.5 * flick})`);
	gl.addColorStop(1, "rgba(255,120,60,0)");
	ctx.fillStyle = gl;
	ctx.fillRect(-140 * s, -80 * s, 280 * s, 280 * s);
	ctx.fillStyle = `rgb(${GOLD})`;
	ctx.fillRect(-20 * s, 0, 40 * s, 10 * s);
	ctx.fillRect(-20 * s, 92 * s, 40 * s, 10 * s);
	const g = ctx.createLinearGradient(-44 * s, 0, 44 * s, 0);
	g.addColorStop(0, "#8f0f14"); g.addColorStop(0.5, "#f0483a"); g.addColorStop(1, "#8f0f14");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.ellipse(0, 51 * s, 44 * s, 42 * s, 0, 0, Math.PI * 2); ctx.fill();
	ctx.strokeStyle = `rgba(${GOLD},0.7)`;
	ctx.lineWidth = 1.5;
	for (const k of [0.45, 0.8]) {
		ctx.beginPath(); ctx.ellipse(0, 51 * s, 44 * s * k, 42 * s, 0, 0, Math.PI * 2); ctx.stroke();
	}
	ctx.strokeStyle = `rgba(${GOLD},0.9)`;
	ctx.lineWidth = 2;
	for (let i = -2; i <= 2; i++) {
		ctx.beginPath(); ctx.moveTo(i * 4 * s, 102 * s); ctx.lineTo(i * 5 * s, (136 + Math.abs(i) * 4) * s); ctx.stroke();
	}
	ctx.restore();
}

function formation(ctx, cx, cy, R, T, alpha, color) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	for (const [r, w] of [[R, 3], [R * 0.93, 1.5], [R * 0.66, 2], [R * 0.36, 1.5]]) {
		ctx.lineWidth = w;
		ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
	}
	ctx.save();
	ctx.rotate(T * 0.15);
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 72; i++) {
		const a = (i / 72) * Math.PI * 2, long = i % 6 === 0;
		const r0 = R * 0.93, r1 = r0 + R * (long ? 0.07 : 0.035);
		ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
	}
	ctx.restore();
	ctx.save();
	ctx.rotate(-T * 0.1);
	for (let i = 0; i < 8; i++) {
		ctx.save();
		ctx.rotate((i * Math.PI) / 4);
		ctx.translate(0, -R * 0.8);
		for (let k = 0; k < 3; k++) {
			const y = (k - 1) * 11, w = R * 0.15;
			if ((i >> k) & 1) ctx.fillRect(-w / 2, y - 2, w, 4);
			else { ctx.fillRect(-w / 2, y - 2, w * 0.42, 4); ctx.fillRect(w * 0.08, y - 2, w * 0.42, 4); }
		}
		ctx.restore();
	}
	ctx.restore();
	ctx.save();
	ctx.rotate(T * 0.07);
	ctx.lineWidth = 1.3;
	ctx.globalAlpha = alpha * 0.8;
	const pr = R * 0.63;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = ((i * 3) % 8) / 8 * Math.PI * 2, x = Math.cos(a) * pr, y = Math.sin(a) * pr;
		if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.stroke();
	ctx.restore();
	ctx.restore();
}

function stamp(ctx, cx, cy, size, lt, t0, th, char) {
	const p = seg(lt, t0, t0 + 0.28);
	if (p <= 0) return;
	const k = easeOut(p);
	const q = seg(lt, t0 + 0.26, t0 + 1.0);
	if (q > 0 && q < 1) {
		ctx.save();
		ctx.globalAlpha = (1 - q) * 0.6;
		ctx.strokeStyle = `rgb(${GOLD})`;
		ctx.lineWidth = 4;
		ctx.beginPath(); ctx.arc(cx, cy, size * 0.6 + q * size * 0.9, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
	}
	ctx.save();
	ctx.globalAlpha = clamp01(p * 1.6);
	ctx.translate(cx, cy);
	ctx.scale(1 + (1 - k) * 1.6, 1 + (1 - k) * 1.6);
	ui.drawSeal(ctx, 0, 0, size, th, char, -0.1 + (1 - k) * 0.35);
	ctx.restore();
}

function sweep(ctx, lt) {
	const p = seg(lt, 0.15, 0.95);
	if (p <= 0 || p >= 1) return;
	ctx.save();
	ctx.translate(-300 + (W + 600) * easeInOut(p), H / 2);
	ctx.rotate(0.35);
	const g = ctx.createLinearGradient(-90, 0, 90, 0);
	g.addColorStop(0, `rgba(${GOLD},0)`); g.addColorStop(0.5, `rgba(${GOLD},0.22)`); g.addColorStop(1, `rgba(${GOLD},0)`);
	ctx.fillStyle = g;
	ctx.fillRect(-90, -800, 180, 1600);
	ctx.restore();
}

function fadeTxt(ctx, lt, a, b, dx, str, x, y, opt) {
	const p = easeOut(seg(lt, a, b));
	if (p <= 0) return;
	ctx.save();
	ctx.globalAlpha = p;
	ctx.translate(dx * (1 - p), 0);
	txt(ctx, str, x, y, opt);
	ctx.restore();
}

function drawIntro(ctx, s, lt, th) {
	const cx = W / 2;
	const p = easeOut(seg(lt, 0.2, 1.4));
	if (hasCJK) {
		if (p > 0) {
			ctx.save();
			ctx.beginPath(); ctx.rect(cx - 520 * p, 0, 1040 * p, H); ctx.clip();
			txt(ctx, s.zhTitle, cx, 320, { size: 200, color: th.realm_color, align: "center" });
			ctx.restore();
		}
		fadeTxt(ctx, lt, 1.0, 1.7, 0, s.title, cx, 392, { size: 46, color: th.name_color, align: "center", maxW: 1000 });
	}
	else if (p > 0) {
		ctx.save();
		ctx.beginPath(); ctx.rect(cx - 560 * p, 0, 1120 * p, H); ctx.clip();
		txt(ctx, s.title, cx, 340, { size: 100, color: th.realm_color, align: "center", maxW: 1060 });
		ctx.restore();
	}
	const lp = easeOut(seg(lt, 1.2, 2.0));
	if (lp > 0) {
		ctx.save();
		ctx.strokeStyle = paint(ctx, th.border_color, cx - 380, 0, cx + 380, 0);
		ctx.lineWidth = 5; ctx.lineCap = "round";
		ctx.beginPath(); ctx.moveTo(cx - 380 * lp, 425); ctx.lineTo(cx + 380 * lp, 425); ctx.stroke();
		ctx.restore();
	}
	fadeTxt(ctx, lt, 1.5, 2.2, 0, s.sub1, cx, 492, { size: hasCJK ? 52 : 56, color: th.name_color, align: "center", maxW: 1000 });
	if (hasCJK && s.zhSub) fadeTxt(ctx, lt, 1.8, 2.5, 0, s.zhSub, cx, 560, { size: 54, color: th.realm_color, align: "center" });
	fadeTxt(ctx, lt, 2.1, 2.8, 0, s.sub2, cx, hasCJK ? 618 : 560, { size: 28, color: th.exp_text_color, align: "center", maxW: 1000 });
	stamp(ctx, 1010, 215, 110, lt, 2.2, th, s.seal);
}

function drawRank(ctx, s, lt, th) {
	const cx = 330, cy = 360, r = 125;
	const info = s.info;
	const pa = seg(lt, 0.1, 0.9);
	if (pa > 0) {
		const pulse = 0.5 + 0.5 * Math.sin(lt * 2.2);
		const g = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.9);
		g.addColorStop(0, `rgba(${GOLD},${0.28 + 0.12 * pulse})`);
		g.addColorStop(1, `rgba(${GOLD},0)`);
		ctx.save();
		ctx.globalAlpha = pa;
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
		ctx.save();
		ctx.translate(cx, cy);
		const sc = Math.max(0.01, easeBack(pa));
		ctx.scale(sc, sc);
		ctx.globalAlpha = clamp01(pa * 2.5);
		ui.drawAvatar(ctx, s.avatar, 0, 0, r, th, paint(ctx, th.border_color, -r, 0, r, 0), 10);
		ctx.restore();
	}
	const pb = seg(lt, 0.55, 1.05);
	if (pb > 0) {
		ctx.save();
		ctx.translate(cx - 100, cy - 108);
		const sc = Math.max(0.01, easeBack(pb));
		ctx.scale(sc, sc);
		ui.badge(ctx, s.rank, 0, 0, 56, th);
		ctx.restore();
	}
	const x0 = 650, mw = 540;
	const world = info.realm.immortal ? "IMMORTAL WORLD" : "MORTAL WORLD";
	fadeTxt(ctx, lt, 0.3, 0.8, 50, `${hasCJK ? (info.realm.immortal ? "仙界" : "凡界") + "  ·  " : ""}${world}`, x0, 150, { size: 26, color: th.text_color, maxW: mw });
	fadeTxt(ctx, lt, 0.5, 1.1, 60, s.name, x0, 240, { size: 62, color: th.name_color, maxW: mw, min: 18 });
	if (hasCJK) {
		fadeTxt(ctx, lt, 0.8, 1.4, 60, info.stage.zh, x0, 325, { size: 72, color: th.realm_color, maxW: mw });
		fadeTxt(ctx, lt, 0.95, 1.5, 60, info.stage.name, x0, 375, { size: 32, color: th.text_color, maxW: mw });
	}
	else fadeTxt(ctx, lt, 0.8, 1.4, 60, info.stage.name, x0, 325, { size: 50, color: th.realm_color, maxW: mw });
	fadeTxt(ctx, lt, 1.1, 1.7, 60, `Realm: ${info.realm.en}   ·   Level: ${info.stage.tag}`, x0, 428, { size: 26, color: th.exp_text_color, maxW: mw });
	const bx = x0, by = 458, bw = mw, bh = 26;
	const ba = easeOut(seg(lt, 1.2, 1.7));
	if (ba > 0) {
		const ratio = (info.maxed ? 1 : clamp01(info.current / info.needed)) * easeOut(seg(lt, 1.4, 2.8));
		ctx.save();
		ctx.globalAlpha = ba;
		ctx.fillStyle = paint(ctx, th.bar_color, bx, by, bx + bw, by);
		ui.rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
		if (ratio > 0) {
			ctx.fillStyle = paint(ctx, th.progress_color, bx, by, bx + bw, by);
			ui.rr(ctx, bx, by, Math.max(bh, bw * ratio), bh, bh / 2); ctx.fill();
			const hx = bx + Math.max(bh, bw * ratio) - bh / 2;
			const hg = ctx.createRadialGradient(hx, by + bh / 2, 0, hx, by + bh / 2, 26);
			hg.addColorStop(0, "rgba(255,240,200,0.9)"); hg.addColorStop(1, "rgba(255,240,200,0)");
			ctx.fillStyle = hg;
			ctx.fillRect(hx - 26, by - 20, 52, bh + 40);
		}
		ctx.globalAlpha = ba * 0.5;
		ctx.strokeStyle = paint(ctx, th.border_color, bx, 0, bx + bw, 0);
		ctx.lineWidth = 2;
		ui.rr(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
		ctx.restore();
		ctx.save();
		ctx.globalAlpha = ba;
		txt(ctx, `Stage ${info.index + 1}/${core.STAGES.length}`, bx, by + 56, { size: 22, color: th.exp_text_color });
		txt(ctx, info.maxed ? "MAX" : `${Math.floor((info.current / info.needed) * 100)}% to next`, bx + bw, by + 56, { size: 22, color: th.exp_text_color, align: "right" });
		ctx.restore();
	}
	const xa = easeOut(seg(lt, 1.1, 1.6));
	if (xa > 0) {
		const shown = Math.floor(s.exp * easeOut(seg(lt, 1.2, 2.7)));
		ctx.save();
		ctx.globalAlpha = xa;
		txt(ctx, `${hasCJK ? "修为  " : ""}CULTIVATION XP${s.extra ? "   ·   " + s.extra : ""}`, x0, 578, { size: 22, color: th.text_color, maxW: 440 });
		txt(ctx, `${shown.toLocaleString()} XP`, x0, 645, { size: 76, color: th.rank_color, maxW: 440 });
		ctx.restore();
	}
	stamp(ctx, 1135, 592, 100, lt, 2.2, th, hasCJK ? info.realm.zh.charAt(0) : "SCX");
	if (s.totalRanks > 1) {
		const gap = 24, start = 330 - ((s.totalRanks - 1) * gap) / 2;
		for (let i = 0; i < s.totalRanks; i++) {
			const cur = i === s.rank - 1;
			ctx.fillStyle = `rgba(${GOLD},${cur ? 1 : 0.35})`;
			ctx.beginPath(); ctx.arc(start + i * gap, 641, cur ? 8 : 5, 0, Math.PI * 2); ctx.fill();
		}
	}
}

function drawOutro(ctx, s, lt, th) {
	const cx = W / 2;
	const p = easeOut(seg(lt, 0.2, 1.3));
	if (hasCJK) {
		if (p > 0) {
			ctx.save();
			ctx.beginPath(); ctx.rect(cx - 520 * p, 0, 1040 * p, H); ctx.clip();
			txt(ctx, "修炼不止", cx, 330, { size: 190, color: th.realm_color, align: "center" });
			ctx.restore();
		}
		fadeTxt(ctx, lt, 1.0, 1.7, 0, "KEEP CULTIVATING", cx, 405, { size: 52, color: th.name_color, align: "center" });
	}
	else if (p > 0) {
		ctx.save();
		ctx.beginPath(); ctx.rect(cx - 560 * p, 0, 1120 * p, H); ctx.clip();
		txt(ctx, "KEEP CULTIVATING", cx, 350, { size: 110, color: th.realm_color, align: "center", maxW: 1060 });
		ctx.restore();
	}
	fadeTxt(ctx, lt, 1.6, 2.3, 0, "May the heavens bless your path to immortality", cx, hasCJK ? 490 : 440, { size: 32, color: th.exp_text_color, align: "center", maxW: 1000 });
	stamp(ctx, cx, hasCJK ? 580 : 540, 110, lt, 2.0, th, hasCJK ? "道" : "SCX");
}

async function createRenderer({ slides, theme, width = 1280, fps = 24 }) {
	if (!Canvas) throw new Error("canvas package is not installed");
	const scale = width / W;
	const cw = even(width), ch = even(Math.round(H * scale));
	const canvas = Canvas.createCanvas(cw, ch);
	const ctx = canvas.getContext("2d");
	ctx.textBaseline = "alphabetic";
	const base = await ui.createBase(W, H, theme, { radius: 18 });
	base.ctx.restore();
	const bg = base.canvas;
	let acc = 0;
	for (const s of slides) { s.start = acc; acc += s.dur; }
	const total = acc;
	const frames = Math.ceil(total * fps);

	function drawFrame(T) {
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
		ctx.globalAlpha = 1;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, W, H);
		ctx.drawImage(bg, 0, 0);
		let s = slides[slides.length - 1];
		for (const sl of slides) if (T >= sl.start && T < sl.start + sl.dur) { s = sl; break; }
		const lt = T - s.start;
		mist(ctx, T);
		const f = s.type === "rank" ? { x: 330, y: 360, R: 268, a: 0.5 } : { x: W / 2, y: 360, R: 300, a: 0.3 };
		formation(ctx, f.x, f.y, f.R, T, f.a, `rgb(${GOLD})`);
		particles(ctx, T);
		lantern(ctx, 70, 100, 0.8, T, 0);
		lantern(ctx, W - 70, 120, 0.9, T, 2);
		lantern(ctx, W - 175, 70, 0.6, T, 4);
		if (s.type === "intro") drawIntro(ctx, s, lt, theme);
		else if (s.type === "rank") drawRank(ctx, s, lt, theme);
		else drawOutro(ctx, s, lt, theme);
		sweep(ctx, lt);
		ctx.save();
		ctx.globalAlpha = 0.65;
		txt(ctx, s.footer || "SCX · Cultivation Announcement", 165, 666, { size: 18, color: theme.text_color, maxW: 520 });
		txt(ctx, s.date || "", W - 165, 666, { size: 18, color: theme.text_color, align: "right" });
		ctx.restore();
		const a = Math.max(1 - easeOut(seg(lt, 0, 0.5)), seg(lt, s.dur - 0.4, s.dur));
		if (a > 0) {
			ctx.fillStyle = `rgba(10,2,2,${a})`;
			ctx.fillRect(0, 0, W, H);
		}
	}
	return { canvas, drawFrame, frames, total, fps, width: cw, height: ch };
}

async function encodeVideo({ renderer, audioPath, outPath, onProgress }) {
	const { canvas, drawFrame, frames, fps, width, height } = renderer;
	const args = [
		"-y", "-v", "error",
		"-f", "rawvideo", "-pix_fmt", "bgra", "-s", `${width}x${height}`, "-r", String(fps), "-i", "pipe:0",
		"-i", audioPath,
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", outPath
	];
	const proc = spawn(ffmpegPath(), args, { stdio: ["pipe", "ignore", "pipe"] });
	let stderr = "";
	proc.stderr.on("data", d => { stderr = (stderr + d).slice(-1500); });
	let procErr = null;
	proc.stdin.on("error", e => { procErr = e; });
	const done = new Promise((resolve, reject) => {
		proc.on("error", reject);
		proc.on("close", code => (code === 0 ? resolve() : reject(new Error("ffmpeg failed: " + stderr))));
	});
	done.catch(() => { });
	for (let i = 0; i < frames; i++) {
		if (procErr) break;
		drawFrame(i / fps);
		const buf = canvas.toBuffer("raw");
		if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once("drain", r));
		if (i % 8 === 0) await new Promise(r => setImmediate(r));
		if (onProgress && i % 24 === 0) onProgress(i / frames);
	}
	proc.stdin.end();
	await done;
}

module.exports = { createRenderer, encodeVideo, W, H };