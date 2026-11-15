/**
 * SCX core: fonts, realms/stages, exp curve, themes and data access.
 * This folder is NOT loaded as a command by GoatBot (only .js files directly
 * inside the commands folder are), so these are safe helper modules.
 *
 * DATA MODEL
 *   Every group (sect) has its OWN cultivation for each person:
 *     usersData -> data.scx.groups.g<threadID> = exp in that group
 *   - /scx, /scx top, /scx realms   -> use only the exp of the current group
 *   - /scx universal                -> sums the exp of every group the person is in
 */
const fs = require("fs");
const path = require("path");

let Canvas = null;
try { Canvas = require("canvas"); } catch (e) { Canvas = null; }

/* ------------------------------------------------------------------ */
/*  FONTS  (put them in <commands folder>/assets/font/)                */
/*  Latin: BeVietnamPro-Bold.ttf (already used by your rank card)      */
/*  Chinese: NotoSerifSC-Bold.otf / NotoSansSC-Bold.ttf / SCX.ttf      */
/* ------------------------------------------------------------------ */
const FONT_DIR = path.join(__dirname, "..", "assets", "font");
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
/*  REALMS + STAGES (17 realms, 71 stages)                             */
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
	{ en: "Core Formation", zh: "结丹", desc: "Solidifying liquid energy into a spiritual core" },
	{ en: "Golden Core", zh: "金丹", desc: "A flawless, glowing core of pure power" },
	{ en: "Nascent Soul", zh: "元婴", desc: "Shattering the core to birth an immortal miniature self" },
	{ en: "Spirit Transformation", zh: "化神", desc: "Fusing body and soul with heaven and earth energy" },
	{ en: "Void Refining", zh: "炼虚", desc: "Shattering spatial barriers, merging with the void" },
	{ en: "Body Fusion", zh: "合体", desc: "Unifying body, soul and void laws into one entity" },
	{ en: "Tribulation", zh: "渡劫", desc: "Enduring Heavenly Lightning to shed mortality" },
	{ en: "Mahayana", zh: "大乘", desc: "Converting mortal Qi into Immortal Qi before ascending" },
	{ en: "Human Immortal", zh: "人仙", immortal: true, desc: "The first step of the Immortal Ladder" },
	{ en: "Earth Immortal", zh: "地仙", immortal: true, desc: "An immortal whose will moves mountains and rivers" },
	{ en: "Heavenly Immortal", zh: "天仙", immortal: true, desc: "An immortal who walks among the heavens" },
	{ en: "Golden Immortal", zh: "金仙", immortal: true, desc: "Mystic Immortal with an indestructible golden body" },
	{ en: "Immortal Monarch", zh: "仙君", immortal: true, desc: "Ruler of an entire immortal domain" },
	{ en: "Immortal Emperor", zh: "仙帝", immortal: true, desc: "Sovereign standing above all immortals" },
	{ en: "God / Saint Realm", zh: "神圣", immortal: true, single: true, desc: "The absolute peak of the Xianxia universe" }
];

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
REALMS.forEach((realm, r) => {
	realm.index = r;
	realm.firstStage = STAGES.findIndex(s => s.realm === r);
	realm.count = STAGES.filter(s => s.realm === r).length;
});

/* ------------------------------------------------------------------ */
/*  EXP CURVE: cost to leave stage i = floor(baseExp * (i+1)^growth)   */
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
	return { exp, index, stage: STAGES[index], realm: REALMS[STAGES[index].realm], current, needed, maxed };
}

const realmReqExp = r => getCum()[REALMS[r].firstStage];

/* ------------------------------------------------------------------ */
/*  THEMES (red & black imperial by default)                           */
/* ------------------------------------------------------------------ */
const THEMES = {
	imperial: {
		main_color: ["#120303", "#4a0d0d", "#120303"], sub_color: "#240808", alpha_subcard: 0.78,
		border_color: ["#f7d774", "#c9972b", "#f7d774"], bar_color: "#3a1010",
		progress_color: ["#e0382d", "#f7d774"], text_color: "#f5e6c8", name_color: "#ffe9a8",
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
const DEFAULT_THEME = THEMES.imperial;

/** Theme of the current group (every image of every /scx command uses it). */
async function getTheme(threadsData, threadID) {
	let custom = {};
	try { custom = (await threadsData.get(threadID, "data.customScxCard", {})) || {}; } catch (e) { /* ignore */ }
	return { ...DEFAULT_THEME, ...custom };
}

/* ------------------------------------------------------------------ */
/*  DATA ACCESS                                                        */
/* ------------------------------------------------------------------ */
// "g" prefix keeps lodash from treating a numeric thread id as an array index
const gKey = tid => `g${tid}`;

const groupExpOf = (u, tid) => Number(u?.data?.scx?.groups?.[gKey(tid)]) || 0;

function totalExpOf(u) {
	const g = u?.data?.scx?.groups;
	if (!g || typeof g !== "object") return 0;
	return Object.values(g).reduce((a, v) => a + (Number(v) || 0), 0);
}
function groupCountOf(u) {
	const g = u?.data?.scx?.groups;
	if (!g || typeof g !== "object") return 0;
	return Object.values(g).filter(v => Number(v) > 0).length;
}

/** Add exp for a person inside one group. Returns { before, after } (group exp). */
async function addExp(usersData, uid, tid, gain) {
	const p = `data.scx.groups.${gKey(tid)}`;
	const before = Number(await usersData.get(uid, p, 0)) || 0;
	const after = before + gain;
	await usersData.set(uid, after, p);
	return { before, after };
}

/** Leaderboard of ONE group (only people who cultivated in it). */
const groupBoard = (all, tid) => all
	.map(u => ({ id: String(u.userID), name: u.name || "Unknown", exp: groupExpOf(u, tid) }))
	.filter(u => u.exp > 0)
	.sort((a, b) => b.exp - a.exp);

/** Universal leaderboard (exp of every group added together). */
const universalBoard = all => all
	.map(u => ({ id: String(u.userID), name: u.name || "Unknown", exp: totalExpOf(u), groups: groupCountOf(u) }))
	.filter(u => u.exp > 0)
	.sort((a, b) => b.exp - a.exp);

/** Per-group display names (group nicknames if the bot stores them). */
async function nameMap(threadsData, tid) {
	const map = {};
	try {
		const members = await threadsData.get(tid, "members", []);
		for (const m of members || []) {
			const n = m.nickname || m.name;
			if (n) map[String(m.userID)] = n;
		}
	} catch (e) { /* ignore */ }
	return map;
}

async function sectName(threadsData, tid) {
	try { return (await threadsData.get(tid, "threadName", "")) || "Unnamed Sect"; }
	catch (e) { return "Unnamed Sect"; }
}

module.exports = {
	isHelper: true,
	Canvas, hasCJK, FONT_STACK,
	REALMS, STAGES, getStageInfo, realmReqExp,
	THEMES, DEFAULT_THEME, getTheme,
	gKey, groupExpOf, totalExpOf, groupCountOf, addExp,
	groupBoard, universalBoard, nameMap, sectName
};
