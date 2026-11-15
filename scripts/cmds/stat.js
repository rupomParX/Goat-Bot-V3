module.exports = {
  config: {
    name: "stats",
    aliases: ["stat","time"],
    version: "1.1",
    author: "Rupom Par",
    role: 0,
    shortDescription: {
      en: "stats",
    },
    longDescription: {
      en: "shows stats of bot.",
    },
    category: "system",
    guide: {
      en: "Use {p}stats to see stats of bot.",
    },
  },

  onStart: async function ({ api, event, args, usersData, threadsData }) {
    try {
      const timeStart = Date.now();
      
      // Safely fetch data with fallbacks if database isn't ready
      let allUsers = [];
      let allThreads = [];
      try {
        allUsers = await usersData.getAll();
        allThreads = await threadsData.getAll();
      } catch (dbErr) {
        console.error("Database fetch warning:", dbErr);
      }

      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${hours}Hrs ${minutes}min ${seconds}sec`;

      const currentDate = new Date();
      const options = { year: "numeric", month: "numeric", day: "numeric" };
      const date = currentDate.toLocaleDateString("en-US", options);
      const time = currentDate.toLocaleTimeString("en-US", {
        timeZone: "Asia/Dhaka", // Updated to match your region (Bangladesh)
        hour12: true,
      });

      const ping = Date.now() - timeStart;

      let pingStatus = "Not smooth throw your router, buddy";
      if (ping < 400) {
        pingStatus = "Smooth like your tiny fingers";
      }

      // Try fetching image safely, skip attachment if it fails
      let attachment = null;
      try {
        const imgURL = "https://i.imgur.com/MEYPUFF.jpg";
        attachment = await global.utils.getStreamFromURL(imgURL);
      } catch (imgErr) {
        console.error("Image fetch failed, sending text-only stats.");
      }

      const messageBody = `👾 | Bot running time\n☞ ${uptimeString}\n\n📅 | Date: ${date}\n\n⏰| Time: ${time}\n\n🐉 | Total Users\n☞ ${allUsers.length}\n\n🌸 | Total threads\n☞ ${allThreads.length}\n\n🌝 | Ping: ${ping}ms\n\nPing status: ${pingStatus}`;

      if (attachment) {
        await api.sendMessage({ body: messageBody, attachment: attachment }, event.threadID);
      } else {
        await api.sendMessage({ body: messageBody }, event.threadID);
      }

    } catch (error) {
      console.error("Fatal stats command error:", error);
      api.sendMessage("An error occurred while retrieving data.", event.threadID);
    }
  }
};