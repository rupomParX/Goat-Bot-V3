const axios = require("axios");

module.exports = {
  config: {
    name: "surah",
    aliases: ["surah"],
    version: "4.1",
    author: "Rupom Par (Fixed)",
    countDown: 5,
    role: 0,
    shortDescription: "Get Surah info + audio",
    longDescription: "Fetch Surah information with translation and recitation using Al-Quran Cloud API",
    category: "religion",
    guide: {
      en: "{pn} <surah_number>\nExample: {pn} 103"
    }
  },

  onStart: async function ({ message, args }) {
    try {
      const surahNumber = args[0];

      if (!surahNumber || isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
        return message.reply("📖 | Please provide a valid surah number (1-114).\nExample: .surah 103");
      }

      // Using Al-Quran Cloud API (Surah details + Arabic + English Translation + Mishary Alafasy Audio)
      const apiURL = `https://api.alquran.cloud/v1/surah/${surahNumber}`;
      const translationURL = `https://api.alquran.cloud/v1/surah/${surahNumber}/en.sahih`;
      const audioURL = `https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`;

      // Fetch data concurrently for better speed
      const [surahRes, transRes, audioRes] = await Promise.all([
        axios.get(apiURL),
        axios.get(translationURL),
        axios.get(audioURL)
      ]);

      if (surahRes.data.code !== 200 || transRes.data.code !== 200) {
        return message.reply("⚠️ | Failed to fetch Surah data from the server.");
      }

      const info = surahRes.data.data;
      const transData = transRes.data.data;
      const audioData = audioRes.data.data;

      const firstAyahArabic = info.ayahs[0].text;
      const firstAyahEnglish = transData.ayahs[0].text;
      const fullSurahAudio = audioData.ayahs[0].audio; // Or you can stream specific ayah audio

      const reply = 
`📖 | ${info.englishName} (${info.name})

🔢 Number: ${info.number}
📜 Total Ayahs: ${info.numberOfAyahs}
📌 Revelation: ${info.revelationType}

🕌 First Ayah (Arabic):
${firstAyahArabic}

🌍 First Ayah (English):
${firstAyshEnglish || firstAyahEnglish}

⚡ Powered by Al-Quran Cloud API`;

      await message.reply(reply);

      // ✅ Stream Audio
      if (fullSurahAudio) {
        const audioStream = await global.utils.getStreamFromURL(fullSurahAudio);
        await message.reply({
          attachment: audioStream
        });
      }

    } catch (err) {
      console.error("Quran command error:", err);
      return message.reply("⚠️ | Server error or invalid response. Try again later.");
    }
  }
};