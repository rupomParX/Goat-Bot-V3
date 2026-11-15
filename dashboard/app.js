const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { Op } = require("sequelize");
const scxCore = require("../scripts/cmds/core");

const MAIN_CARD_KEYS = new Set([
	"main_color", "sub_color", "alpha_subcard", "exp_color", "expNextLevel_color",
	"text_color", "name_color", "level_color", "rank_color", "line_color", "exp_text_color"
]);

const asPlain = value => value?.get ? value.get({ plain: true }) : value;
const validId = value => /^\d+$/.test(String(value || ""));
const isLocalHost = host => ["127.0.0.1", "::1", "localhost"].includes(String(host).toLowerCase());

function safeColor(value) {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function configPath() {
	return global.client?.dirConfigCommands || path.join(process.cwd(), "configCommands.json");
}

function requireDatabase(res) {
	const db = global.db;
	if (!db?.threadsData || !db?.usersData || !db?.sequelize || !db?.dashboardEventModel) {
		res.status(503).json({ error: "SQLite dashboard data is not ready." });
		return null;
	}
	return db;
}

function createApp(botApi) {
	const app = express();
	const sessionTokens = new Map();
	const config = global.GoatBot?.config || {};
	const dashboardConfig = config.dashBoard || {};
	const host = process.env.DASHBOARD_HOST || dashboardConfig.host || "127.0.0.1";
	const password = process.env.DASHBOARD_PASSWORD || "";
	const port = Number(dashboardConfig.port) || 3001;

	if (!password)
		throw new Error("Set DASHBOARD_PASSWORD before starting the dashboard.");
	if (!isLocalHost(host) && !password)
		throw new Error("Set DASHBOARD_PASSWORD before exposing the dashboard beyond localhost.");

	app.disable("x-powered-by");
	app.use(express.json({ limit: "32kb" }));
	app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "dashboard.html")));

	app.get("/api/session", (req, res) => {
		const token = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
		const expires = sessionTokens.get(token);
		if (expires && expires > Date.now()) return res.json({ passwordRequired: Boolean(password), authenticated: true });
		if (token) sessionTokens.delete(token);
		return res.json({ passwordRequired: Boolean(password), authenticated: !password });
	});

	app.post("/api/login", (req, res) => {
		if (!password) return res.status(400).json({ error: "Dashboard password is not configured." });
		const supplied = Buffer.from(String(req.body?.password || ""));
		const expected = Buffer.from(password);
		if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))
			return res.status(401).json({ error: "Incorrect password." });
		const token = crypto.randomBytes(32).toString("base64url");
		sessionTokens.set(token, Date.now() + 8 * 60 * 60 * 1000);
		return res.json({ token });
	});

	app.use("/api", (req, res, next) => {
		if (!password) return next();
		const token = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
		const expires = sessionTokens.get(token);
		if (expires && expires > Date.now()) return next();
		sessionTokens.delete(token);
		return res.status(401).json({ error: "Sign in to access the dashboard." });
	});

	app.get("/api/state", async (req, res) => {
		try {
			const db = requireDatabase(res);
			if (!db) return;
			const threads = (await db.threadsData.getAll()).filter(thread => thread.isGroup);
			const users = await db.usersData.getAll();
			const now = Date.now();
			const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
			const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
			const [weeklyCounts, dailyTotal, commandRows, recentRows] = await Promise.all([
				db.dashboardEventModel.findAll({
					attributes: ["threadID", [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"]],
					where: { createdAt: { [Op.gte]: weekAgo }, kind: "message" },
					group: ["threadID"], raw: true
				}),
				db.dashboardEventModel.count({ where: { createdAt: { [Op.gte]: dayAgo }, kind: "message" } }),
				db.dashboardEventModel.findAll({
					attributes: ["threadID", "command", [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"]],
					where: { createdAt: { [Op.gte]: weekAgo }, command: { [Op.ne]: null } },
					group: ["threadID", "command"], raw: true
				}),
				db.dashboardEventModel.findAll({ order: [["createdAt", "DESC"]], limit: 120 })
			]);
			const messageCount = new Map(weeklyCounts.map(row => [String(row.threadID), Number(row.count)]));
			const groupCommands = new Map();
			const allCommands = new Map();
			for (const row of commandRows) {
				const command = String(row.command);
				const amount = Number(row.count);
				allCommands.set(command, (allCommands.get(command) || 0) + amount);
				if (!groupCommands.has(String(row.threadID))) groupCommands.set(String(row.threadID), []);
				groupCommands.get(String(row.threadID)).push({ name: command, count: amount });
			}
			const groupList = threads.map(thread => ({
				threadID: String(thread.threadID),
				name: thread.threadName || `Group ${thread.threadID}`,
				members: Array.isArray(thread.members) ? thread.members.filter(member => member.inGroup !== false).length : 0,
				paused: Boolean(thread.data?.dashboardPaused),
				messages7d: messageCount.get(String(thread.threadID)) || 0,
				commands: (groupCommands.get(String(thread.threadID)) || []).sort((a, b) => b.count - a.count).slice(0, 5)
			})).sort((a, b) => b.messages7d - a.messages7d);
			const requestedGroup = String(req.query.threadID || "");
			const selectedGroup = groupList.find(group => group.threadID === requestedGroup) || groupList[0] || null;
			const selectedThread = selectedGroup && threads.find(thread => String(thread.threadID) === selectedGroup.threadID);
			const plainRecent = recentRows.map(asPlain);
			const nameById = new Map(users.map(user => [String(user.userID), user.name || `User ${user.userID}`]));
			const mainDelta = Math.max(1, Number(global.GoatBot?.configCommands?.envCommands?.rank?.deltaNext) || 5);
			const mainRanks = [...users].sort((a, b) => Number(b.exp) - Number(a.exp)).slice(0, 30).map((user, index) => ({
				rank: index + 1,
				userID: String(user.userID),
				name: user.name || `User ${user.userID}`,
				exp: Number(user.exp) || 0,
				level: Math.floor((1 + Math.sqrt(1 + 8 * (Number(user.exp) || 0) / mainDelta)) / 2)
			}));
			let scxRanks = [];
			let mainCard = {};
			let scxCard = {};
			if (selectedGroup) {
				const rawThread = threads.find(thread => String(thread.threadID) === selectedGroup.threadID);
				const names = await scxCore.nameMap(db.threadsData, selectedGroup.threadID);
				scxRanks = scxCore.groupBoard(users, selectedGroup.threadID).slice(0, 30).map((user, index) => ({
					rank: index + 1,
					userID: String(user.id),
					name: names[String(user.id)] || nameById.get(String(user.id)) || user.name,
					exp: user.exp,
					stage: scxCore.getStageInfo(user.exp).stage.name
				}));
				mainCard = rawThread?.data?.customRankCard || {};
				scxCard = rawThread?.data?.customScxCard || {};
			}
			let globalAnalytics = {};
			try { globalAnalytics = await db.globalData.get("analytics", "data", {}); } catch (error) { }
			const analyticsCommands = Object.entries(globalAnalytics || {}).map(([name, count]) => ({ name, count: Number(count) || 0 }));
			const combinedCommands = new Map(analyticsCommands.map(item => [item.name, item.count]));
			for (const [name, count] of allCommands) combinedCommands.set(name, Math.max(combinedCommands.get(name) || 0, count));
			const totalMessages7d = [...messageCount.values()].reduce((sum, count) => sum + count, 0);
			const commandCalls = [...combinedCommands.values()].reduce((sum, count) => sum + count, 0);
			return res.json({
				storage: "SQLite",
				summary: { groups: groupList.length, users: users.length, messages7d: totalMessages7d, messages24h: dailyTotal, commandCalls },
				groups: groupList,
				selectedGroupID: selectedGroup?.threadID || "",
				groupMemberIDs: (selectedThread?.members || []).filter(member => member.inGroup !== false).map(member => String(member.userID)),
				activity: plainRecent.map(row => ({
					id: row.id,
					threadID: String(row.threadID),
					group: threads.find(thread => String(thread.threadID) === String(row.threadID))?.threadName || String(row.threadID),
					userID: String(row.userID || ""),
					userName: row.userName || "Unknown",
					body: String(row.body || "").slice(0, 2000),
					command: row.command || "",
					kind: row.kind || "message",
					createdAt: row.createdAt
				})),
				commands: [...combinedCommands].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
				ranks: { main: mainRanks, scx: scxRanks },
				rankSettings: { deltaNext: mainDelta, mainCard, scxCard, scxPresets: Object.keys(scxCore.THEMES) },
				users: users.map(user => ({ userID: String(user.userID), name: user.name || `User ${user.userID}`, exp: Number(user.exp) || 0, money: Number(user.money) || 0 }))
			});
		}
		catch (error) {
			console.error("[dashboard] state request failed:", error);
			return res.status(500).json({ error: "Could not load dashboard data." });
		}
	});

	app.post("/api/banking/balance", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		const userID = String(req.body?.userID || "");
		const money = Number(req.body?.money);
		if (!validId(userID) || !Number.isSafeInteger(money) || money < 0)
			return res.status(400).json({ error: "Choose a valid user and a non-negative whole-number balance." });
		try {
			const user = (await db.usersData.getAll()).find(item => String(item.userID) === userID);
			if (!user) return res.status(404).json({ error: "User not found." });
			const previous = Number(user.money) || 0;
			await db.usersData.set(userID, money, "money");
			try {
				await db.dashboardEventModel.create({
					threadID: "0",
					userID,
					userName: user.name || userID,
					body: `Wallet balance changed from ${previous} to ${money} by dashboard.`,
					kind: "balance"
				});
			}
			catch (auditError) { console.error("[dashboard] balance audit failed:", auditError.message); }
			return res.json({ userID, money });
		}
		catch (error) {
			console.error("[dashboard] balance update failed:", error);
			return res.status(500).json({ error: "Could not update the wallet balance." });
		}
	});

	app.get("/api/banking/users", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		try {
			const search = String(req.query.search || "").trim().toLocaleLowerCase().slice(0, 100);
			const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
			const pageSize = Math.min(50, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 50));
			const scope = req.query.scope === "group" ? "group" : "all";
			let memberIDs = null;
			if (scope === "group") {
				const threadID = String(req.query.threadID || "");
				if (!validId(threadID)) return res.status(400).json({ error: "Choose a valid group for this search." });
				const thread = await db.threadsData.get(threadID);
				if (!thread?.isGroup) return res.status(404).json({ error: "Group not found." });
				memberIDs = new Set((thread.members || []).filter(member => member.inGroup !== false).map(member => String(member.userID)));
			}
			const matches = (await db.usersData.getAll())
				.filter(user => (!memberIDs || memberIDs.has(String(user.userID))) && (!search || String(user.userID).includes(search) || String(user.name || "").toLocaleLowerCase().includes(search)))
				.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")) || String(a.userID).localeCompare(String(b.userID)));
			const start = (page - 1) * pageSize;
			return res.json({
				users: matches.slice(start, start + pageSize).map(user => ({ userID: String(user.userID), name: user.name || `User ${user.userID}`, money: Number(user.money) || 0 })),
				total: matches.length,
				page,
				pageSize
			});
		}
		catch (error) {
			console.error("[dashboard] banking search failed:", error);
			return res.status(500).json({ error: "Could not search users." });
		}
	});

	app.post("/api/banking/reward", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		if (!db.userModel) return res.status(503).json({ error: "SQLite user model is not ready." });
		const amount = Number(req.body?.amount);
		const scope = req.body?.scope === "group" ? "group" : req.body?.scope === "all" ? "all" : "";
		const threadID = String(req.body?.threadID || "");
		const announcement = String(req.body?.announcement || "").trim();
		if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000 || !scope)
			return res.status(400).json({ error: "Choose a reward from 1 to 1000000000 and a valid recipient scope." });
		if (scope === "group" && !validId(threadID)) return res.status(400).json({ error: "Choose a valid group." });
		if (announcement.length > 1000) return res.status(400).json({ error: "Announcement must be 1000 characters or fewer." });
		if (announcement && typeof botApi?.sendMessage !== "function") return res.status(503).json({ error: "The bot messaging API is not ready; reward was not applied." });
		try {
			const users = await db.usersData.getAll();
			let thread = null;
			if (scope === "group") {
				thread = await db.threadsData.get(threadID);
				if (!thread?.isGroup) return res.status(404).json({ error: "Group not found." });
			}
			const memberIDs = scope === "group"
				? new Set((thread.members || []).filter(member => member.inGroup !== false).map(member => String(member.userID)))
				: null;
			const recipients = users.filter(user => !memberIDs || memberIDs.has(String(user.userID)));
			if (!recipients.length) return res.status(404).json({ error: "No registered users found in this recipient scope." });
			if (recipients.some(user => !Number.isSafeInteger(Number(user.money) || 0) || (Number(user.money) || 0) + amount > Number.MAX_SAFE_INTEGER))
				return res.status(400).json({ error: "The reward would exceed the safe wallet balance for at least one recipient." });
			const recipientIDs = recipients.map(user => String(user.userID));
			await db.sequelize.transaction(async transaction => {
				await db.userModel.update(
					{ money: db.sequelize.literal(`COALESCE(money, 0) + ${amount}`) },
					{ where: { userID: { [Op.in]: recipientIDs } }, transaction }
				);
			});
			for (const recipient of recipients) {
				const cached = global.db.allUserData?.find(user => String(user.userID) === String(recipient.userID));
				if (cached) cached.money = (Number(cached.money) || 0) + amount;
			}
			try {
				await db.dashboardEventModel.create({
					threadID: scope === "group" ? threadID : "0",
					userID: "dashboard",
					userName: "Dashboard",
					body: `Bulk wallet reward +${amount} to ${recipients.length} ${scope === "group" ? `members of ${thread.threadName || threadID}` : "registered users"}.`,
					kind: "balance"
				});
			}
			catch (auditError) { console.error("[dashboard] reward audit failed:", auditError.message); }

			let sent = 0, failed = 0;
			if (announcement) {
				let targetThreads = scope === "group" ? [thread] : (await db.threadsData.getAll()).filter(item => item.isGroup);
				if (scope === "all") {
					const botID = String(botApi.getCurrentUserID());
					targetThreads = targetThreads.filter(item => (item.members || []).some(member => String(member.userID) === botID && member.inGroup !== false));
				}
				const body = `${announcement}\n\nA special reward of ${amount.toLocaleString()} coins has been added to eligible wallets.`;
				for (const target of targetThreads) {
					try { await botApi.sendMessage({ body }, target.threadID); sent++; }
					catch (error) { failed++; console.error(`[dashboard] reward announcement failed for ${target.threadID}:`, error.message || error); }
				}
			}
			return res.json({ recipients: recipients.length, amount, announcementSent: sent, announcementFailed: failed });
		}
		catch (error) {
			console.error("[dashboard] bulk reward failed:", error);
			return res.status(500).json({ error: "Could not apply the bulk reward." });
		}
	});

	app.get("/api/messages", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		const threadID = String(req.query.threadID || "");
		if (!validId(threadID)) return res.status(400).json({ error: "Choose a valid group." });
		try {
			const rows = await db.dashboardEventModel.findAll({
				where: { threadID }, order: [["createdAt", "DESC"]], limit: 200
			});
			return res.json(rows.map(asPlain).reverse());
		}
		catch (error) { return res.status(500).json({ error: "Could not load group activity." }); }
	});

	app.post("/api/groups/:threadID/pause", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		const threadID = String(req.params.threadID);
		if (!validId(threadID) || typeof req.body?.paused !== "boolean") return res.status(400).json({ error: "Invalid group or pause state." });
		try {
			const thread = (await db.threadsData.get(threadID));
			if (!thread?.isGroup) return res.status(404).json({ error: "Group not found." });
			await db.threadsData.set(threadID, req.body.paused, "data.dashboardPaused");
			return res.json({ threadID, paused: req.body.paused });
		}
		catch (error) { return res.status(500).json({ error: "Could not update group status." }); }
	});

	app.post("/api/ranks/promote", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		const { threadID, userID, system, xp, reason = "" } = req.body || {};
		const amount = Number(xp);
		if (!validId(threadID) || !validId(userID) || !["main", "scx"].includes(system) || !Number.isSafeInteger(amount) || amount < 1 || amount > 10000000)
			return res.status(400).json({ error: "Choose a group, member, rank system, and XP amount from 1 to 10000000." });
		if (typeof reason !== "string" || reason.length > 200) return res.status(400).json({ error: "Reason must be 200 characters or fewer." });
		try {
			const thread = await db.threadsData.get(threadID);
			const user = (await db.usersData.getAll()).find(item => String(item.userID) === String(userID));
			if (!thread?.isGroup || !user) return res.status(404).json({ error: "Group or member not found." });
			if (system === "scx" && !(thread.members || []).some(member => String(member.userID) === String(userID) && member.inGroup !== false))
				return res.status(400).json({ error: "SCX promotions are limited to current members of the selected group." });
			const field = system === "main" ? "exp" : `data.scx.groups.${scxCore.gKey(threadID)}`;
			const current = system === "main" ? Number(user.exp) || 0 : scxCore.groupExpOf(user, threadID);
			const total = current + amount;
			await db.usersData.set(userID, total, field);
			await db.dashboardEventModel.create({
				threadID,
				userID,
				userName: user.name || String(userID),
				body: `${system.toUpperCase()} promotion +${amount} XP${reason ? `: ${reason.trim()}` : ""}`.slice(0, 2000),
				kind: "promotion"
			});
			return res.json({ system, userID, xp: total });
		}
		catch (error) {
			console.error("[dashboard] promotion failed:", error);
			return res.status(500).json({ error: "Could not apply the promotion." });
		}
	});

	app.post("/api/ranks/settings", async (req, res) => {
		const db = requireDatabase(res);
		if (!db) return;
		const { threadID, system } = req.body || {};
		if (!validId(threadID) || !["main", "scx"].includes(system)) return res.status(400).json({ error: "Choose a valid group and rank system." });
		try {
			const thread = await db.threadsData.get(threadID);
			if (!thread?.isGroup) return res.status(404).json({ error: "Group not found." });
			if (system === "scx") {
				const preset = String(req.body.preset || "");
				if (!Object.prototype.hasOwnProperty.call(scxCore.THEMES, preset)) return res.status(400).json({ error: "Choose a valid SCX theme." });
				await db.threadsData.set(threadID, scxCore.THEMES[preset], "data.customScxCard");
				return res.json({ system, preset });
			}
			const design = req.body.design || {};
			const nextDesign = {};
			for (const [key, value] of Object.entries(design)) {
				if (!MAIN_CARD_KEYS.has(key)) continue;
				if (key === "alpha_subcard") {
					const alpha = Number(value);
					if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return res.status(400).json({ error: "Card opacity must be between 0 and 1." });
					nextDesign[key] = alpha;
				}
				else if (safeColor(value)) nextDesign[key] = value;
				else return res.status(400).json({ error: `Invalid color for ${key}.` });
			}
			if (Object.keys(nextDesign).length) {
				const existing = thread.data?.customRankCard || {};
				await db.threadsData.set(threadID, { ...existing, ...nextDesign }, "data.customRankCard");
			}
			if (req.body.deltaNext !== undefined) {
				const deltaNext = Number(req.body.deltaNext);
				if (!Number.isFinite(deltaNext) || deltaNext < 1 || deltaNext > 100000) return res.status(400).json({ error: "XP per rank step must be from 1 to 100000." });
				const commands = global.GoatBot.configCommands;
				commands.envCommands = commands.envCommands || {};
				commands.envCommands.rank = { ...(commands.envCommands.rank || {}), deltaNext };
				fs.writeFileSync(configPath(), JSON.stringify(commands, null, 2));
			}
			return res.json({ system, saved: true });
		}
		catch (error) {
			console.error("[dashboard] rank settings failed:", error);
			return res.status(500).json({ error: "Could not save rank settings." });
		}
	});

	return { app, host, port };
}

module.exports = function startDashboard(api) {
	if (global.dashboardServer?.listening) return global.dashboardServer;
	const { app, host, port } = createApp(api);
	const server = app.listen(port, host);
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.once("listening", () => {
			global.dashboardServer = server;
			const activityModel = global.db?.dashboardEventModel;
			if (activityModel) {
				const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
				activityModel.destroy({ where: { createdAt: { [Op.lt]: cutoff } } }).catch(error => console.error("[dashboard] activity cleanup failed:", error.message));
				const cleanupTimer = setInterval(() => {
					const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
					activityModel.destroy({ where: { createdAt: { [Op.lt]: old } } }).catch(error => console.error("[dashboard] activity cleanup failed:", error.message));
				}, 24 * 60 * 60 * 1000);
				cleanupTimer.unref();
			}
			console.log(`[dashboard] listening at http://${host}:${port}`);
			resolve(server);
		});
	});
};