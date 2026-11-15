const googleTTS = require("google-tts-api");

module.exports = {
  config: {
    name: "say",
    version: "1.2",
    author: "Rupom Par",
    countDown: 5,
    role: 0,
    longDescription: "voice",
    category: "ai",
    guide: {
      en: "{pn} text or reply to text"
    }
  },

  onStart: async function ({ api, event, args, getLang, message, usersData }) {
    try {
      const text = event.type === 'message_reply' ? event.messageReply.body : args.join(' ');
      if (!text) {
        return message.reply('Please type text or reply to a text.');
      }

      // Generate audio URL using google-tts-api (supports long text splitting if needed)
      const audioUrl = googleTTS.getAudioUrl(text, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
      });

      const stream = await global.utils.getStreamFromURL(audioUrl);

      return message.reply({
        body: 'Here is your tts:',
        attachment: stream
      });
    } catch (error) {
      console.error(error);
      return message.reply('An error occurred while generating the audio. Please try again later.');
    }
  }
};