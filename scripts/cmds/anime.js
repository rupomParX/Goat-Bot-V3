const axios = require("axios");
const FormData = require("form-data");

module.exports = {
	config: {
		name: "anime",
		aliases: ["trace"],
		version: "1.0",
		author: "Rupom Par",
		countDown: 10,
		role: 0,
		shortDescription: { en: "Find an anime from a screenshot" },
		category: "anime",
		guide: { en: "Reply to an anime screenshot with {pn}" }
	},

	onStart: async function ({ event, message }) {
		const attachments = [
			...(event.attachments || []),
			...(event.messageReply?.attachments || [])
		];
		const image = attachments.find(({ type }) => ["photo", "image", "animated_image"].includes(type));
		if (!image)
			return message.reply("Reply to an anime screenshot, or attach one with /anime.");

		try {
			const imageStream = await global.utils.getStreamFromURL(image.url);
			const form = new FormData();
			form.append("image", imageStream, { filename: imageStream.path });

			const { data } = await axios.post("https://api.trace.moe/search?anilistInfo", form, {
				headers: form.getHeaders(),
				timeout: 45000,
				maxBodyLength: Infinity,
				maxContentLength: Infinity
			});

			const result = data.result?.[0];
			if (!result)
				return message.reply("I couldn't find a matching anime for that image.");

			const title = result.anilist?.title || {};
			const japaneseTitle = title.native || title.romaji || "Unknown";
			const englishTitle = title.english || title.romaji || title.native || "Unknown";
			const episode = result.episode ? `Episode: ${result.episode}` : "Episode: unknown";
			const confidence = Number.isFinite(result.similarity)
				? `Match: ${Math.round(result.similarity * 100)}%`
				: null;

			return message.reply([
				`Japanese: ${japaneseTitle}`,
				`English: ${englishTitle}`,
				episode,
				confidence
			].filter(Boolean).join("\n"));
		}
		catch (error) {
			console.error("[anime] Image search failed:", error.response?.data || error.message);
			return message.reply("Anime image search failed. Please try again later.");
		}
	}
};