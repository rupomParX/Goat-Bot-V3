const axios = require('axios');

module.exports = {
  config: {
    name: "waifu",
    aliases: ["neko", "shinobu", "megumin"],
    version: "2.0",
    author: "Rupom Par",
    countDown: 3,
    role: 0,
    shortDescription: "Get high-quality anime images and GIFs",
    longDescription: "Fetch gorgeous SFW anime pictures and roleplay GIFs using the nekos.best API.",
    category: "anime",
    guide: "{pn} [category]\nCategories: waifu, neko, shinobu, megumin, bully, cuddle, cry, kiss, hug, pat, smug, bonk, slap, tickle"
  },

  onStart: async function ({ message, args }) {
    const validCategories = [
      "waifu", "neko", "shinobu", "megumin", "bully", "cuddle", 
      "cry", "kiss", "hug", "awoo", "pat", "smug", "bonk", 
      "yeet", "blush", "smile", "wave", "highfive", "handhold", 
      "nom", "bite", "glomp", "slap", "kill", "kick", "happy", 
      "wink", "poke", "dance", "cringe", "tickle", "poke"
    ];

    let category = args[0] ? args[0].toLowerCase() : "waifu";

    if (!validCategories.includes(category)) {
      category = "waifu";
    }

    try {
      // High quality, stable endpoint
      const response = await axios.get(`https://nekos.best/api/v2/${category}`);
      const item = response.data.results[0];
      
      const imgUrl = item.url;
      const animeName = item.anime_name || "Original / Unknown";

      const form = {
        body: `✨ Category: ${category.toUpperCase()}\n🎬 Anime: ${animeName}`,
        attachment: await global.utils.getStreamFromURL(imgUrl)
      };

      message.reply(form);
    } catch (e) {
      console.error(e);
      message.reply(`🥺 Failed to fetch image. Try one of these categories:\n${validCategories.join(", ")}`);
    }
  }
};