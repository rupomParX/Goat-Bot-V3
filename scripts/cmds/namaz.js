/**
 * ============================================================================
 * NAMAZ (PRAYER TIMES) COMMAND & AUTO-NOTIFY
 * ============================================================================
 * 
 * COMMANDS:
 * 1. /namaz <city> (or /namaj <city>)
 *    - Anyone can use this to check prayer times for a city.
 * 
 * 2. /namaj auto notify to all group on
 *    /namaj auto notify to all group off
 *    - [BOT ADMIN ONLY] Turns global auto-notification ON or OFF for all groups.
 *    - Sends daily prayer times automatically at 04:30 AM (server time).
 * 
 * 3. /namaj auto notify off
 *    /namaj auto notify on
 *    - [GROUP ADMIN ONLY] Turns auto-notification OFF or ON for THIS group only.
 *    - Does not affect any other groups.
 * ============================================================================
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "namaz_settings.json");
const DEFAULT_CITY = "Dhaka"; // Default city for auto-notifications

// Load or initialize settings
function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      const defaultData = {
        globalEnabled: false,
        city: DEFAULT_CITY,
        disabledGroups: [],
        lastSentDate: ""
      };
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch (err) {
    console.error("Error loading namaz settings:", err);
    return { globalEnabled: false, city: DEFAULT_CITY, disabledGroups: [], lastSentDate: "" };
  }
}

function saveSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving namaz settings:", err);
  }
}

// Check if user is a Bot Admin
function isBotAdmin(senderID) {
  const adminLists = [
    global.config?.ADMINBOT,
    global.GoatBot?.config?.adminBot,
    global.config?.adminBot
  ];
  return adminLists.some((list) => Array.isArray(list) && list.includes(senderID));
}

// Check if user is a Group Admin
async function isGroupAdmin(api, threadID, senderID) {
  if (isBotAdmin(senderID)) return true;
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    return threadInfo.adminIDs.some((admin) => admin.id === senderID);
  } catch (err) {
    console.error("Error checking group admin:", err);
    return false;
  }
}

// Fetch formatted prayer times from Al-Adhan API
async function fetchPrayerTimes(cityName) {
  const apiUrl = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=&method=2`;
  const response = await axios.get(apiUrl);

  if (response.data.code !== 200 || !response.data.data) {
    return null;
  }

  const timings = response.data.data.timings;
  const dateMeta = response.data.data.date;

  return (
    "🕋🌙 𝙿𝚛𝚊𝚢𝚎𝚛 𝚝𝚒𝚖𝚎𝚜 🕋🌙\n" +
    `🏙️ 𝙲𝚒𝚝𝚢 𝙽𝚊𝚖𝚎: ${cityName}\n` +
    `📅 𝙳𝚊𝚝𝚎: ${dateMeta.readable}\n\n` +
    `🕌 𝙵𝚊𝚓𝚛: ${timings.Fajr}\n` +
    `🕌 𝚂𝚞𝚗𝚛𝚒𝚜𝚎: ${timings.Sunrise}\n` +
    `🕌 𝙳𝚑𝚞𝚑𝚛: ${timings.Dhuhr}\n\n` +
    `🕌 𝙰𝚜𝚛: ${timings.Asr}\n` +
    `🕌 𝙼𝚊𝚐𝚑𝚛𝚒𝚋: ${timings.Maghrib}\n` +
    `🕌 𝙸𝚜𝚑𝚊: ${timings.Isha}\n\n` +
    "⚡ Powered by Al-Adhan API"
  );
}

// Background scheduler
let schedulerStarted = false;
function startScheduler(api) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    const settings = loadSettings();
    if (!settings.globalEnabled) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const todayStr = now.toISOString().split("T")[0];

    // Send daily at 04:30 AM (change "04:30" if you want a different time)
    if (`${hours}:${minutes}` === "04:30" && settings.lastSentDate !== todayStr) {
      settings.lastSentDate = todayStr;
      saveSettings(settings);

      try {
        const message = await fetchPrayerTimes(settings.city);
        if (!message) return;

        // Get all group threads the bot is in
        const threads = await api.getThreadList(100, null, ["INBOX"]);
        for (const thread of threads) {
          if (thread.isGroup && !settings.disabledGroups.includes(thread.threadID)) {
            api.sendMessage(message, thread.threadID);
          }
        }
      } catch (err) {
        console.error("Auto-notify error:", err);
      }
    }
  }, 60 * 1000); // Check every 1 minute
}

module.exports.config = {
  name: "namaz",
  aliases: ["namaj", "prayer"],
  version: "3.0",
  credits: "Mesbah Bb'e (Updated)",
  usePrefix: true,
  cooldowns: 5,
  role: 0,
  description: "View Prayer time & manage auto-notifications",
  category: "𝗜𝗦𝗟𝗔𝗠",
  usages: "{pn} <city name> | {pn} auto notify off | {pn} auto notify to all group on/off",
};

// Automatically starts the scheduler when the bot boots up
module.exports.onLoad = function ({ api }) {
  startScheduler(api);
};

module.exports.onStart = async function ({ api, args, event }) {
  // Ensure scheduler is running even if onLoad wasn't triggered
  startScheduler(api);

  try {
    const input = args.join(" ").trim();
    const lowerInput = input.toLowerCase();

    // 1. BOT ADMIN COMMAND: /namaj auto notify to all group on/off
    if (lowerInput.startsWith("auto notify to all group")) {
      if (!isBotAdmin(event.senderID)) {
        return api.sendMessage("⛔ | Only Bot Admins can use this command.", event.threadID);
      }

      const settings = loadSettings();
      if (lowerInput.endsWith("on")) {
        settings.globalEnabled = true;
        saveSettings(settings);
        return api.sendMessage(
          `✅ | Global Namaz auto-notifications turned ON for all groups (City: ${settings.city}).`,
          event.threadID
        );
      } else if (lowerInput.endsWith("off")) {
        settings.globalEnabled = false;
        saveSettings(settings);
        return api.sendMessage("❌ | Global Namaz auto-notifications turned OFF.", event.threadID);
      } else {
        return api.sendMessage("⚠️ | Usage: /namaj auto notify to all group on/off", event.threadID);
      }
    }

    // 2. GROUP ADMIN COMMAND: /namaj auto notify on/off (for this group only)
    if (lowerInput === "auto notify off" || lowerInput === "auto notify on") {
      if (!event.isGroup) {
        return api.sendMessage("⚠️ | This command can only be used inside a group.", event.threadID);
      }

      const isAdmin = await isGroupAdmin(api, event.threadID, event.senderID);
      if (!isAdmin) {
        return api.sendMessage("⛔ | Only Group Admins can turn auto-notifications on or off for this group.", event.threadID);
      }

      const settings = loadSettings();
      if (lowerInput === "auto notify off") {
        if (!settings.disabledGroups.includes(event.threadID)) {
          settings.disabledGroups.push(event.threadID);
          saveSettings(settings);
        }
        return api.sendMessage("🔕 | Namaz auto-notifications have been turned OFF for this group only.", event.threadID);
      } else {
        settings.disabledGroups = settings.disabledGroups.filter((id) => id !== event.threadID);
        saveSettings(settings);
        return api.sendMessage("🔔 | Namaz auto-notifications have been turned ON for this group.", event.threadID);
      }
    }

    // 3. STANDARD COMMAND: /namaj <city name>
    if (!input) {
      return api.sendMessage("⚠️ | Please provide a city name.\nExample: /namaj Dhaka", event.threadID);
    }

    const prayerTimes = await fetchPrayerTimes(input);
    if (!prayerTimes) {
      return api.sendMessage(`⚠️ | Could not find prayer times for "${input}". Please check the spelling.`, event.threadID);
    }

    api.sendMessage(prayerTimes, event.threadID);
  } catch (e) {
    console.error(e);
    api.sendMessage("⚠️ | Error fetching prayer times. Please try again later.", event.threadID);
  }
};