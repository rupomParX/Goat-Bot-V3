/**
 * SCX announcement: admin-only voiced video announcements.
 *   /scx announcement top [3-15]                -> this group's top cultivators, sent to this group
 *   /scx announcement universal [3-15]          -> universal top, sent to ALL groups
 *   /scx announcement universal here [3-15]     -> universal top, sent only to this group
 * Optional number n = how many cultivators (3-15).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const core = require("../core");
const ui = require("../ui");
const voice = require("./voice");
const video = require("./video");

const cfg = () => global.GoatBot?.configCommands?.envCommands?.scx || {};
const num = (v, d, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d));

const shorten = (s, n = 26) => (String(s).length > n ? String(s).slice(0, n - 1).trimEnd() + "…" : String(s));
const spoken = s => voice.cleanSpeech(s) || "Unknown cultivator";
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(options) {
	const pending = global.scxAnnouncementPending || 0;
	const previous = global.scxAnnouncementQueue || Promise.resolve();
	global.scxAnnouncementPending = pending + 1;

	const task = previous.catch(() => { }).then(() => runAnnouncement(options));
	global.scxAnnouncementQueue = task.catch(() => { }).finally(() => {
		global.scxAnnouncementPending = Math.max(0, (global.scxAnnouncementPending || 1) - 1);
	});

	if (pending > 0) {
		const { message, event, threadsData } = options;
		core.getTheme(threadsData, event.threadID)
			.then(t => ui.sendNotice(message, t, { zh: "排队中", title: "Announcement queued", lines: ["Your announcement will start after the current one finishes."] }))
			.catch(e => console.error("[scx announce] queued notice failed:", e.message || e));
	}
	return task;
}

async function runAnnouncement({ message, event, args, usersData, threadsData, api, role = 0 }) {
	const t = await core.getTheme(threadsData, event.threadID);
	const mode = (args[0] || "").toLowerCase();
	const isUniversal = ["universal", "uni", "global"].includes(mode);

	const usage = () => ui.sendNotice(message, t, {
		zh: "公告", title: "Announcement",
		lines: [
			"/scx announcement top [3-15]  - top cultivators of this group",
			"/scx announcement universal [3-15]  - universal top, sent to all groups",
			"/scx announcement universal here [3-15]  - universal top, this group only",
			"The number sets how many cultivators appear (default: 5)."
		]
	});
	if (!isUniversal && mode !== "top") return usage();

	const flags = args.slice(1).map(a => String(a).toLowerCase());
	const here = flags.includes("here");
	const needed = isUniversal && !here ? 2 : 1;
	if (role < needed) {
		return ui.sendNotice(message, t, {
			zh: "权限不足", title: "Admins only",
			lines: [needed === 2 ? "Only bot admins can broadcast the universal announcement." : "Only group admins can make an announcement.",
				isUniversal ? "Group admins can use: /scx announcement universal here" : ""].filter(Boolean)
		});
	}

	const count = num(flags.find(f => /^\d+$/.test(f)), cfg().announceCount, 3, 15);

	const all = await usersData.getAll();
	const board = isUniversal ? core.universalBoard(all) : core.groupBoard(all, event.threadID);
	if (!board.length) {
		return ui.sendNotice(message, t, { zh: "暂无", title: "No cultivators yet", lines: ["Nobody has any cultivation exp to announce."] });
	}
	const names = isUniversal ? {} : await core.nameMap(threadsData, event.threadID);
	const sect = await core.sectName(threadsData, event.threadID);
	const rows = board.slice(0, count).map((u, i) => ({
		rank: i + 1,
		id: u.id,
		name: shorten(names[u.id] || u.name),
		exp: u.exp,
		info: core.getStageInfo(u.exp),
		extra: isUniversal ? plural(u.groups, "sect") : ""
	}));

	global.scxAnnouncing = true;
	const dir = path.join(os.tmpdir(), `scx_ann_${Date.now()}`);
	try {
		await ui.sendNotice(message, t, {
			zh: "制作中", title: "Rendering announcement",
			lines: ["Building the video and voice-over,", "this can take up to a minute..."]
		});
		fs.mkdirSync(dir, { recursive: true });

		await Promise.all(rows.map(async r => { r.avatar = await ui.loadAvatar(usersData, r.id); }));

		const title = isUniversal ? "UNIVERSAL TOP CULTIVATORS" : "TOP CULTIVATORS";
		const date = new Date().toDateString();
		const footer = isUniversal ? "SCX · Universal Cultivation Announcement" : `SCX · ${sect}`;
		const slides = [];
		slides.push({
			type: "intro", min: 6.5, zhTitle: "凡界", title: "MORTAL WORLD", sub1: title,
			zhSub: isUniversal ? "万界榜" : "宗门榜",
			sub2: isUniversal ? `All sects combined  ·  ${date}` : `${sect}  ·  ${date}`,
			seal: "榜", footer, date,
			say: isUniversal ? "Mortal World. Universal top cultivators." : `Mortal World. ${spoken(sect)}. Top cultivators.`
		});
		for (const r of rows) {
			slides.push({
				type: "rank", min: 7.5, rank: r.rank, totalRanks: rows.length, name: r.name, exp: r.exp, info: r.info,
				avatar: r.avatar, extra: r.extra, footer, date,
				say: `Rank ${r.rank}. ${spoken(r.name)}. Realm, ${r.info.realm.en}. Level, ${r.info.stage.tag}. ${r.exp} experience points.`
			});
		}
		slides.push({ type: "outro", min: 5.5, footer, date, say: "Keep cultivating, and ascend to the immortal realm!" });

		const lang = cfg().ttsLang || "en";
		const VOICE_DELAY = 0.7;
		let voiceOk = true;
		for (const s of slides) {
			s.pcm = null;
			if (!voiceOk) continue;
			try {
				const mp3 = await voice.tts(s.say, lang);
				if (mp3) s.pcm = await voice.decodeToPcm(mp3);
			}
			catch (e) {
				console.error("[scx announce] TTS failed:", e.message);
				voiceOk = false;
				slides.forEach(x => { x.pcm = null; });
			}
		}
		for (const s of slides) {
			const vdur = s.pcm ? s.pcm.length / voice.SR : 0;
			s.dur = Math.max(s.min, VOICE_DELAY + vdur + 1.3);
		}

		let acc = 0;
		const voices = [], gongs = [];
		for (const s of slides) {
			gongs.push(acc);
			if (s.pcm) voices.push({ pcm: s.pcm, at: acc + VOICE_DELAY });
			acc += s.dur;
		}
		const wavPath = path.join(dir, "audio.wav");
		fs.writeFileSync(wavPath, voice.mixToWav(acc + 0.5, voices, gongs));

		const renderer = await video.createRenderer({
			slides, theme: t, fps: num(cfg().videoFps, 24, 12, 30), width: num(cfg().videoWidth, 1280, 640, 1920)
		});
		const outPath = path.join(dir, "announcement.mp4");
		await video.encodeVideo({ renderer, audioPath: wavPath, outPath });

		const body = [
			`📢 ${isUniversal ? "Universal" : sect} - Top Cultivators`,
			...rows.map(r => `${r.rank}. ${r.name} - ${r.info.stage.zh} ${r.info.stage.name} (${r.exp} XP)`),
			voiceOk ? "" : "(voice-over unavailable)"
		].filter(Boolean).join("\n");

		const targets = new Set([String(event.threadID)]);
		if (isUniversal && !here) {
			const threads = await threadsData.getAll();
			const botID = String(api.getCurrentUserID());
			for (const th of threads) {
				if (!th.isGroup || !th.threadID) continue;
				const me = (th.members || []).find(m => String(m.userID) === botID);
				if (!me?.inGroup) continue;
				targets.add(String(th.threadID));
			}
		}

		let ok = 0, fail = 0;
		for (const tid of targets) {
			try {
				const form = { body, attachment: fs.createReadStream(outPath) };
				if (tid === String(event.threadID)) await message.reply(form);
				else await api.sendMessage(form, tid);
				ok++;
			}
			catch (e) {
				fail++;
				console.error(`[scx announce] failed to send to ${tid}:`, e?.message || e);
			}
			if (targets.size > 1) await sleep(3000);
		}

		if (targets.size > 1) {
			await ui.sendNotice(message, t, {
				zh: "已发送", title: "Announcement sent",
				lines: [`Delivered to ${plural(ok, "group")}.`, fail ? `${plural(fail, "group")} failed (see console).` : "No failures."]
			});
		}
	}
	catch (e) {
		console.error("[scx announce]", e);
		await ui.sendNotice(message, t, {
			zh: "失败", title: "Announcement failed",
			lines: [String(e.message || e).slice(0, 110), "Check that ffmpeg and canvas are installed."]
		});
	}
	finally {
		global.scxAnnouncing = false;
		fs.rm(dir, { recursive: true, force: true }, () => { });
	}
}

module.exports = { run };