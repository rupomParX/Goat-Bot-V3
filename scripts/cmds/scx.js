/**
 * SCX - Standard Chinese Xianxia cultivation rank system
 * Command: /scx
 * Independent from the default "rank" system (own exp, own levels, own card).
 * Exp is stored per user at: usersData -> data.scx.exp
 */
const fs = require("fs");
const path = require("path");

let Canvas = null;
try { Canvas = require("canvas"); } catch (e) { Canvas = null; }

const { randomString } = global.utils;
const scxCore = require("./core");
const scxUI = require("./ui");

/* ------------------------------------------------------------------ */
/*  FONTS                                                              */
/*  Chinese glyphs need a CJK font in  <commands folder>/assets/font/  */
/*  (e.g. NotoSerifSC-Bold.otf or NotoSansSC-Bold.ttf). Without one    */
/*  the card automatically falls back to English-only text.            */
/* ------------------------------------------------------------------ */
const FONT_DIR = path.join(__dirname, "assets", "font");
const LATIN_FONT = "SCX-Latin";
const CJK_FONT = "SCX-CJK";
let hasCJK = false;

if (Canvas) {
	const tryRegister = (file, family) => {
		const p = path.join(FONT_DIR, file);
		if (!fs.existsSync(p)) return false;
		Canvas.registerFont(p, { family });
		return true;
	};
	tryRegister("BeVietnamPro-Bold.ttf", LATIN_FONT);
	for (const f of ["NotoSerifSC-Bold.otf", "NotoSerifSC-Bold.ttf", "NotoSansSC-Bold.otf", "NotoSansSC-Bold.ttf", "NotoSansSC-Regular.ttf", "SCX.ttf"]) {
		if (tryRegister(f, CJK_FONT)) { hasCJK = true; break; }
	}
}
const FONT_STACK = `"${LATIN_FONT}", "${CJK_FONT}", sans-serif`;

/* ------------------------------------------------------------------ */
/*  CULTIVATION REALMS                                                 */
/* ------------------------------------------------------------------ */
const NUM_ZH = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const SUB = [
	{ en: "Early", zh: "初期" },
	{ en: "Middle", zh: "中期" },
	{ en: "Late", zh: "后期" },
	{ en: "Peak", zh: "圆满" }
];

const REALMS = [
	{ en: "Qi Refining", zh: "炼气", layers: true, desc: "Gathering external spiritual energy into the body" },
	{ en: "Foundation Establishment", zh: "筑基", desc: "Compressing gaseous energy into a liquid spiritual sea" },
	{ en: "Core Formation", zh: "结丹", desc: "Solidifying liquid energy into a physical spiritual core" },
	{ en: "Golden Core", zh: "金丹", desc: "Achieving a flawless, glowing core of pure power" },
	{ en: "Nascent Soul", zh: "元婴", desc: "Shattering the core to give birth to an immortal miniature self" },
	{ en: "Spirit Transformation", zh: "化神", desc: "Fusing body and Nascent Soul with heaven and earth energy" },
	{ en: "Void Refining", zh: "炼虚", desc: "Shattering spatial barriers and merging with the void" },
	{ en: "Body Fusion", zh: "合体", desc: "Unifying body, soul and void laws into one entity" },
	{ en: "Tribulation", zh: "渡劫", desc: "Enduring Heavenly Lightning to shed mortality" },
	{ en: "Mahayana", zh: "大乘", desc: "Converting mortal Qi into Immortal Qi before ascending" },
	{ en: "Human Immortal", zh: "人仙", immortal: true, desc: "The first step of the Immortal Ladder" },
	{ en: "Earth Immortal", zh: "地仙", immortal: true, desc: "Immortal whose will moves mountains and rivers" },
	{ en: "Heavenly Immortal", zh: "天仙", immortal: true, desc: "Immortal who walks among the heavens" },
	{ en: "Golden Immortal", zh: "金仙", immortal: true, desc: "Mystic Immortal with an indestructible golden body" },
	{ en: "Immortal Monarch", zh: "仙君", immortal: true, desc: "Ruler of an immortal domain" },
	{ en: "Immortal Emperor", zh: "仙帝", immortal: true, desc: "Sovereign above all immortals" },
	{ en: "God / Saint Realm", zh: "神圣", immortal: true, single: true, desc: "The absolute peak of the Xianxia universe" }
];

// Flatten into a stage list (71 stages total)
const STAGES = [];
REALMS.forEach((realm, r) => {
	if (realm.layers) {
		for (let i = 0; i < 10; i++) {
			const peak = i === 9;
			STAGES.push({
				realm: r,
				name: `${realm.en} ${peak ? "10th Layer (Great Circle)" : ORD[i] + " Layer"}`,
				zh: peak ? `${realm.zh}大圆满` : `${realm.zh}${NUM_ZH[i]}层`,
				tag: peak ? "Great Circle" : `${ORD[i]} Layer`
			});
		}
	}
	else if (realm.single) {
		STAGES.push({ realm: r, name: realm.en, zh: `${realm.zh}境`, tag: "Absolute Peak" });
	}
	else {
		SUB.forEach((s, i) => {
			STAGES.push({
				realm: r,
				name: i === 3 ? `Peak / Great Circle ${realm.en}` : `${s.en} ${realm.en}`,
				zh: `${realm.zh}${s.zh}`,
				tag: i === 3 ? "Great Circle" : s.en
			});
		});
	}
});

/* ------------------------------------------------------------------ */
/*  EXP CURVE                                                          */
/*  cost to leave stage i = floor(baseExp * (i+1) ^ growth)            */
/* ------------------------------------------------------------------ */
const env = () => global.GoatBot?.configCommands?.envCommands?.scx || {};
let cumCache = { key: null, cum: [] };

function getCum() {
	const e = env();
	const base = Number(e.baseExp) > 0 ? Number(e.baseExp) : 10;
	const growth = Number(e.growth) > 0 ? Number(e.growth) : 1.5;
	const key = `${base}|${growth}`;
	if (cumCache.key === key) return cumCache.cum;
	const cum = [0];
	for (let i = 0; i < STAGES.length - 1; i++)
		cum.push(cum[i] + Math.floor(base * Math.pow(i + 1, growth)));
	cumCache = { key, cum };
	return cum;
}

function getStageInfo(exp) {
	const cum = getCum();
	exp = Math.max(0, Number(exp) || 0);
	let index = 0;
	for (let i = cum.length - 1; i >= 0; i--) {
		if (exp >= cum[i]) { index = i; break; }
	}
	const maxed = index >= STAGES.length - 1;
	const needed = maxed ? 0 : cum[index + 1] - cum[index];
	const current = maxed ? 0 : exp - cum[index];
	return { index, stage: STAGES[index], realm: REALMS[STAGES[index].realm], current, needed, maxed };
}

/* ------------------------------------------------------------------ */
/*  CARD THEMES (default = imperial). Shared with scxcard.js           */
/* ------------------------------------------------------------------ */
const THEMES = {
	imperial: {
		main_color: ["#1a0505", "#4a0d0d", "#1a0505"], sub_color: "#2b0a0a", alpha_subcard: 0.75,
		border_color: ["#f7d774", "#c9972b", "#f7d774"], bar_color: "#3a1010",
		progress_color: ["#f7d774", "#e8a317"], text_color: "#f5e6c8", name_color: "#ffe9a8",
		realm_color: ["#ffd966", "#e0a526"], exp_text_color: "#f5e6c8", rank_color: "#ffd966", seal_color: "#b3121b"
	},
	jade: {
		main_color: ["#04201a", "#0b4a3a"], sub_color: "#06261f", alpha_subcard: 0.75,
		border_color: ["#9be8c3", "#3fb589"], bar_color: "#0a3328",
		progress_color: ["#5ee0a8", "#b8f5d3"], text_color: "#e6fff3", name_color: "#b8f5d3",
		realm_color: ["#7ff0b8", "#2fbf84"], exp_text_color: "#d4f7e4", rank_color: "#9be8c3", seal_color: "#1f8a5f"
	},
	ink: {
		main_color: ["#f2eee3", "#d8d2c0"], sub_color: "#ffffff", alpha_subcard: 0.55,
		border_color: ["#222222", "#666666"], bar_color: "#c9c3b0",
		progress_color: ["#111111", "#555555"], text_color: "#222222", name_color: "#111111",
		realm_color: ["#111111", "#444444"], exp_text_color: "#333333", rank_color: "#222222", seal_color: "#b3121b"
	},
	cinnabar: {
		main_color: ["#3b0000", "#a3190f"], sub_color: "#2a0000", alpha_subcard: 0.7,
		border_color: ["#ffcf9e", "#ff9a5c"], bar_color: "#4d0b05",
		progress_color: ["#ffcf9e", "#ff7b3d"], text_color: "#ffeede", name_color: "#ffd9b0",
		realm_color: ["#ffe0b8", "#ff9a5c"], exp_text_color: "#ffeede", rank_color: "#ffcf9e", seal_color: "#7a0a0a"
	},
	celestial: {
		main_color: ["#0b0b2e", "#2d1b69", "#5b3fa6"], sub_color: "#10103a", alpha_subcard: 0.7,
		border_color: ["#d9c8ff", "#8f7bd6"], bar_color: "#1e1650",
		progress_color: ["#b69cff", "#6fe3ff"], text_color: "#ece6ff", name_color: "#d9c8ff",
		realm_color: ["#e0d4ff", "#78e0ff"], exp_text_color: "#ece6ff", rank_color: "#78e0ff", seal_color: "#6a3fd1"
	}
};
global.client.scxThemes = THEMES;
global.client.makeScxCard = makeScxCard;

/* ------------------------------------------------------------------ */
/*  COMMAND                                                            */
/* ------------------------------------------------------------------ */
const LANG_EN = {
	notifyOn: "Breakthrough notifications turned ON",
	notifyOff: "Breakthrough notifications turned OFF",
	notifySyntax: "Use: {pn} notify on | off",
	topTitle: "🏆 Cultivation Ranking (page %1/%2)",
	noData: "No cultivators yet.",
	realmsTitle: "📜 Standard Chinese Xianxia realms (%1 stages)",
	breakthrough: "✨ Breakthrough! %1 has advanced to %2",
	newRealm: "⚡ Heavenly aura shakes the sky! %1 has entered the %2 Realm — %3",
	cardError: "Could not build the cultivation card (is the 'canvas' package installed?)"
};

module.exports = {
	config: {
		name: "scx",
		aliases: ["cultivation", "xianxia"],
		version: "1.0",
		author: "SCX",
		countDown: 5,
		role: 0,
		description: {
			vi: "Hệ thống tu tiên (Standard Chinese Xianxia)",
			en: "Standard Chinese Xianxia cultivation rank system"
		},
		category: "rank",
		guide: {
			vi: "   {pn} [để trống | @tags]: xem thẻ tu vi\n   {pn} top [trang]: bảng xếp hạng\n   {pn} realms: danh sách cảnh giới\n   {pn} notify on | off: bật/tắt thông báo đột phá",
			en: "   {pn} [empty | @tags]: view this group's cultivation card\n   {pn} top [page]: this group's leaderboard image\n   {pn} universal [page]: all-groups leaderboard image\n   {pn} realms: realm catalog image\n   {pn} notify on | off: toggle breakthrough notification\n   {pn} theme <imperial | jade | ink | cinnabar | celestial | reset>: change this group's card theme"
		},
		envConfig: {
			baseExp: 10,
			growth: 1.5,
			expPerMessage: 1,
			cooldown: 3,
			announceCount: 5,
			videoWidth: 1280,
			videoFps: 24,
			ttsLang: "en"
		}
	},

	langs: { en: LANG_EN, vi: LANG_EN },

	onStart: async function ({ message, event, usersData, threadsData, args, getLang, api, role }) {
		const sub = (args[0] || "").toLowerCase();
		if (["announcement", "announcemet", "announce", "ann"].includes(sub))
			return require("./scx/announce").run({ message, event, args: args.slice(1), usersData, threadsData, api, role });
		const theme = await scxCore.getTheme(threadsData, event.threadID);

		// ---- notify on/off
		if (sub === "notify") {
			if (!["on", "off"].includes((args[1] || "").toLowerCase()))
				return scxUI.sendNotice(message, theme, {
					title: "Notification Settings",
					lines: [getLang("notifySyntax").replace("{pn}", "/scx")]
				});
			const on = args[1].toLowerCase() === "on";
			await threadsData.set(event.threadID, on, "settings.sendScxMessage");
			return scxUI.sendNotice(message, theme, {
				title: "Breakthrough Notifications",
				lines: [getLang(on ? "notifyOn" : "notifyOff")]
			});
		}

		// ---- group card theme
		if (sub === "theme") {
			const preset = (args[1] || "").toLowerCase();
			if (preset === "reset") {
				await threadsData.set(event.threadID, {}, "data.customScxCard");
				return scxUI.sendNotice(message, scxCore.DEFAULT_THEME, {
					title: "SCX Theme Reset",
					lines: ["This group's card theme is back to Imperial."]
				});
			}
			if (!scxCore.THEMES[preset])
				return scxUI.sendNotice(message, theme, {
					title: "SCX Themes",
					lines: ["Choose: imperial, jade, ink, cinnabar, celestial, or reset."]
				});
			await threadsData.set(event.threadID, scxCore.THEMES[preset], "data.customScxCard");
			return scxUI.sendNotice(message, scxCore.THEMES[preset], {
				title: `${preset[0].toUpperCase()}${preset.slice(1)} Theme Applied`,
				lines: ["This group's SCX cards and lists will use the selected theme."]
			});
		}

		// ---- list realms
		if (sub === "realms") {
			const image = await scxUI.renderRealms(theme, scxCore.REALMS, scxCore.STAGES);
			image.path = `${randomString(10)}.png`;
			return message.reply({ attachment: image });
		}

		// ---- group leaderboard or all-groups leaderboard
		if (sub === "top" || sub === "universal") {
			const universal = sub === "universal";
			const pageArg = universal && args[1]?.toLowerCase() === "top" ? args[2] : args[1];
			const allUsers = await usersData.getAll();
			let all = universal
				? scxCore.universalBoard(allUsers)
				: scxCore.groupBoard(allUsers, event.threadID);
			if (!universal) {
				const names = await scxCore.nameMap(threadsData, event.threadID);
				all = all.map(user => ({ ...user, name: names[user.id] || user.name }));
			}
			if (!all.length)
				return scxUI.sendNotice(message, theme, {
					title: universal ? "Universal Cultivation" : "Cultivation Ranking",
					lines: [getLang("noData")]
				});

			const perPage = 10;
			const pages = Math.ceil(all.length / perPage);
			const page = Math.min(Math.max(parseInt(pageArg) || 1, 1), pages);
			const entries = all.slice((page - 1) * perPage, page * perPage);
			const groupName = universal ? "All groups combined" : await scxCore.sectName(threadsData, event.threadID);
			const image = await scxUI.renderLeaderboard(theme, entries, {
				page,
				pages,
				title: universal ? "Universal Cultivation" : "Cultivation Ranking",
				subtitle: groupName,
				universal,
				firstRank: (page - 1) * perPage + 1,
				getStageInfo
			});
			image.path = `${randomString(10)}.png`;
			return message.reply({ attachment: image });
		}

		// ---- cultivation card (self or tagged)
		const mentioned = Object.keys(event.mentions || {});
		const targets = mentioned.length ? mentioned : [event.senderID];
		try {
			const cards = await Promise.all(targets.map(async uid => {
				const stream = await makeScxCard(uid, usersData, threadsData, event.threadID);
				stream.path = `${randomString(10)}.png`;
				return stream;
			}));
			return message.reply({ attachment: cards });
		}
		catch (err) {
			console.error("[scx]", err);
			return scxUI.sendNotice(message, theme, {
				title: "SCX Card Error",
				lines: [getLang("cardError")]
			});
		}
	},

	onChat: async function ({ usersData, threadsData, event, message, getLang }) {
		const uid = event.senderID;
		if (!uid || !event.isGroup) return;

		const cfg = env();
		const cooldownMs = (Number(cfg.cooldown) >= 0 ? Number(cfg.cooldown) : 3) * 1000;
		const gain = Number(cfg.expPerMessage) > 0 ? Number(cfg.expPerMessage) : 1;

		const now = Date.now();
		global.scxLastGain = global.scxLastGain || new Map();
		const cooldownKey = `${event.threadID}:${uid}`;
		if (now - (global.scxLastGain.get(cooldownKey) || 0) < cooldownMs) return;
		global.scxLastGain.set(cooldownKey, now);

		try {
			const groups = await usersData.get(uid, "data.scx.groups", null);
			const legacyExp = Number(await usersData.get(uid, "data.scx.exp", 0)) || 0;
			if ((!groups || Object.keys(groups).length === 0) && legacyExp > 0)
				await usersData.set(uid, legacyExp, `data.scx.groups.${scxCore.gKey(event.threadID)}`);
			const expPath = `data.scx.groups.${scxCore.gKey(event.threadID)}`;
			const before = getStageInfo(Number(await usersData.get(uid, expPath, 0)) || 0);
			const { after: newExp } = await scxCore.addExp(usersData, uid, event.threadID, gain);
			const after = getStageInfo(newExp);

			if (after.index <= before.index) return;

			const notify = await threadsData.get(event.threadID, "settings.sendScxMessage", false);
			if (!notify) return;

			const name = await usersData.getName(uid);
			const tag = `@${name}`;
			const body = after.stage.realm !== before.stage.realm
				? getLang("newRealm", tag, after.realm.en, `${after.stage.zh} · ${after.stage.name}`)
				: getLang("breakthrough", tag, `${after.stage.zh} · ${after.stage.name}`);
			message.reply({ body, mentions: [{ tag, id: uid }] });
		}
		catch (e) { /* never break chat flow */ }
	}
};

/* ------------------------------------------------------------------ */
/*  CARD BUILDER                                                       */
/* ------------------------------------------------------------------ */
async function makeScxCard(userID, usersData, threadsData, threadID) {
	if (!Canvas) throw new Error("canvas package is not installed");

	const user = await usersData.get(userID);
	const exp = Math.max(0, scxCore.groupExpOf(user, threadID));
	const info = getStageInfo(exp);

	const all = scxCore.groupBoard(await usersData.getAll(), threadID);
	let pos = all.findIndex(u => u.id === String(userID)) + 1;
	if (pos === 0) pos = all.length + 1;

	const names = await scxCore.nameMap(threadsData, threadID);
	const custom = await scxCore.getTheme(threadsData, threadID);
	const opts = {
		...custom,
		name: names[String(userID)] || user.name || await usersData.getName(userID),
		avatar: await usersData.getAvatarUrl(userID),
		rank: `#${pos}/${Math.max(all.length, pos)}`,
		info
	};
	return drawCard(opts);
}

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
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function fit(ctx, text, maxW, size, min = 18) {
	let s = size;
	do {
		ctx.font = `${s}px ${FONT_STACK}`;
		if (ctx.measureText(text).width <= maxW) break;
		s -= 2;
	} while (s > min);
	return ctx.font;
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

async function drawCard(o) {
	const W = 2000, H = 500, R = 44;
	const { info } = o;
	const canvas = Canvas.createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	ctx.textBaseline = "alphabetic";

	/* ---- background ---- */
	ctx.save();
	rr(ctx, 0, 0, W, H, R);
	ctx.clip();

	let drewImage = false;
	if (isHttp(o.main_color)) {
		try {
			ctx.drawImage(await Canvas.loadImage(o.main_color), 0, 0, W, H);
			drewImage = true;
		} catch (e) { /* fall back to default colours */ }
	}
	if (!drewImage) {
		ctx.fillStyle = paint(ctx, isHttp(o.main_color) ? THEMES.imperial.main_color : o.main_color, 0, 0, W, H);
		ctx.fillRect(0, 0, W, H);
	}

	// watermark character of the current realm
	if (hasCJK) {
		ctx.save();
		ctx.globalAlpha = 0.07;
		ctx.fillStyle = paint(ctx, o.realm_color, 900, 0, 1500, 500);
		ctx.font = `430px ${FONT_STACK}`;
		ctx.textAlign = "center";
		ctx.fillText(info.realm.zh, 1180, 410);
		ctx.restore();
	}

	// auspicious clouds
	ctx.save();
	ctx.globalAlpha = 0.12;
	const cloudColor = Array.isArray(o.border_color) ? o.border_color[0] : o.border_color;
	clouds(ctx, 120, 500, 150, cloudColor);
	clouds(ctx, 1500, 500, 180, cloudColor);
	clouds(ctx, 1900, 60, 110, cloudColor);
	ctx.restore();

	/* ---- panel + borders ---- */
	ctx.save();
	ctx.globalAlpha = o.alpha_subcard;
	ctx.fillStyle = paint(ctx, o.sub_color, 0, 0, W, H);
	rr(ctx, 28, 28, W - 56, H - 56, R - 12);
	ctx.fill();
	ctx.restore();

	const borderPaint = paint(ctx, o.border_color, 0, 0, W, 0);
	ctx.strokeStyle = borderPaint;
	ctx.fillStyle = borderPaint;
	ctx.lineWidth = 5;
	rr(ctx, 28, 28, W - 56, H - 56, R - 12);
	ctx.stroke();
	ctx.lineWidth = 1.5;
	rr(ctx, 44, 44, W - 88, H - 88, R - 20);
	ctx.stroke();

	ctx.lineWidth = 7;
	corner(ctx, 60, 60, 1, 1);
	corner(ctx, W - 60, 60, -1, 1);
	corner(ctx, 60, H - 60, 1, -1);
	corner(ctx, W - 60, H - 60, -1, -1);

	/* ---- avatar ---- */
	const ax = 235, ay = 250, ar = 130;
	ctx.save();
	ctx.beginPath();
	ctx.arc(ax, ay, ar, 0, Math.PI * 2);
	ctx.clip();
	try {
		ctx.drawImage(await Canvas.loadImage(o.avatar), ax - ar, ay - ar, ar * 2, ar * 2);
	} catch (e) {
		ctx.fillStyle = paint(ctx, o.bar_color, 0, 0, 1, 1);
		ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
	}
	ctx.restore();

	ctx.strokeStyle = borderPaint;
	ctx.lineWidth = 12;
	ctx.beginPath();
	ctx.arc(ax, ay, ar + 6, 0, Math.PI * 2);
	ctx.stroke();
	ctx.save();
	ctx.globalAlpha = 0.6;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(ax, ay, ar + 26, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();

	/* ---- text block ---- */
	const tx = 440, maxTextW = 1090;
	ctx.textAlign = "left";

	// name
	ctx.font = fit(ctx, o.name, maxTextW, 64);
	ctx.fillStyle = paint(ctx, o.name_color, tx, 80, tx + 600, 140);
	ctx.fillText(o.name, tx, 135);

	// world tag
	ctx.font = `30px ${FONT_STACK}`;
	ctx.fillStyle = paint(ctx, o.text_color, tx, 150, tx + 400, 190);
	const world = info.realm.immortal ? "Immortal World" : "Mortal World";
	ctx.fillText(hasCJK ? `${info.realm.immortal ? "仙界" : "凡界"}  ·  ${world}` : world, tx, 185);

	// realm / stage title
	if (hasCJK) {
		ctx.font = fit(ctx, info.stage.zh, maxTextW, 92);
		ctx.fillStyle = paint(ctx, o.realm_color, tx, 200, tx + 600, 270);
		ctx.fillText(info.stage.zh, tx, 270);

		ctx.font = fit(ctx, info.stage.name, maxTextW, 40);
		ctx.fillStyle = paint(ctx, o.text_color, tx, 290, tx + 600, 320);
		ctx.fillText(info.stage.name, tx, 322);
	}
	else {
		ctx.font = fit(ctx, info.stage.name, maxTextW, 72);
		ctx.fillStyle = paint(ctx, o.realm_color, tx, 220, tx + 600, 290);
		ctx.fillText(info.stage.name, tx, 285);
	}

	/* ---- exp bar ---- */
	const bx = tx, by = 355, bw = 1100, bh = 34;
	const ratio = info.maxed ? 1 : Math.min(1, info.current / info.needed);
	ctx.fillStyle = paint(ctx, o.bar_color, bx, by, bx + bw, by);
	rr(ctx, bx, by, bw, bh, bh / 2);
	ctx.fill();
	if (ratio > 0) {
		const pw = Math.max(bh, bw * ratio);
		ctx.fillStyle = paint(ctx, o.progress_color, bx, by, bx + bw, by);
		rr(ctx, bx, by, pw, bh, bh / 2);
		ctx.fill();
	}
	ctx.save();
	ctx.globalAlpha = 0.5;
	ctx.strokeStyle = borderPaint;
	ctx.lineWidth = 2;
	rr(ctx, bx, by, bw, bh, bh / 2);
	ctx.stroke();
	ctx.restore();

	// exp text
	const expText = info.maxed ? "Cultivation MAX  —  Absolute Peak" : `Cultivation ${info.current.toLocaleString()} / ${info.needed.toLocaleString()}`;
	ctx.font = `34px ${FONT_STACK}`;
	ctx.fillStyle = paint(ctx, o.exp_text_color, bx, 400, bx + 500, 440);
	ctx.textAlign = "left";
	ctx.fillText(expText, bx, 440);
	ctx.textAlign = "right";
	ctx.fillText(`Stage ${info.index + 1}/${STAGES.length}  ·  ${Math.floor(ratio * 100)}%`, bx + bw, 440);

	/* ---- divider ---- */
	ctx.save();
	ctx.globalAlpha = 0.6;
	ctx.strokeStyle = borderPaint;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(1620, 100);
	ctx.lineTo(1620, 400);
	ctx.stroke();
	ctx.restore();

	/* ---- seal (right zone) ---- */
	const sx = 1790, sy = 165, ss = 190;
	ctx.save();
	ctx.translate(sx, sy);
	ctx.rotate(-0.1);
	ctx.fillStyle = paint(ctx, o.seal_color, -ss / 2, -ss / 2, ss / 2, ss / 2);
	rr(ctx, -ss / 2, -ss / 2, ss, ss, 14);
	ctx.fill();
	ctx.strokeStyle = "#f6e9cf";
	ctx.lineWidth = 5;
	rr(ctx, -ss / 2 + 12, -ss / 2 + 12, ss - 24, ss - 24, 8);
	ctx.stroke();
	ctx.fillStyle = "#f6e9cf";
	ctx.textAlign = "center";
	if (hasCJK) {
		ctx.font = `120px ${FONT_STACK}`;
		ctx.fillText(info.realm.zh.charAt(0), 0, 42);
	}
	else {
		ctx.font = `64px ${FONT_STACK}`;
		ctx.fillText("SCX", 0, 22);
	}
	ctx.restore();

	/* ---- rank ---- */
	ctx.textAlign = "center";
	ctx.font = `30px ${FONT_STACK}`;
	ctx.fillStyle = paint(ctx, o.text_color, 1700, 300, 1900, 330);
	ctx.fillText(hasCJK ? "排名  RANK" : "RANK", sx, 335);
	ctx.font = fit(ctx, o.rank, 330, 78);
	ctx.fillStyle = paint(ctx, o.rank_color, 1650, 350, 1930, 410);
	ctx.fillText(o.rank, sx, 410);

	ctx.restore();
	return canvas.createPNGStream();
}
