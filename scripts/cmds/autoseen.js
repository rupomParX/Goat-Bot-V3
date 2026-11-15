const axios = require("axios");

module.exports = {
  config: {
    name: "autoseen",
    author: "Rupom Par",
    role: 0,
    shortDescription: "Text to image generator",
    guide: "{pn} <query>",
    category: "midjourney"
  },
  onStart: async function ({ message, args }) {
    var prompt = args.join(" ");

    if (!prompt) {
      return message.reply("Please provide a prompt to generate an image!");
    }

    try {
      // Use standard Pollinations.ai image endpoint
      var imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

      message.reply({
        body: `Generated image for: ${prompt}`,
        attachment: await global.utils.getStreamFromURL(imageUrl)
      });
    } catch (error) {
      console.error(error);
      message.reply("Failed to generate image. Please try again later.");
    }
  }
};