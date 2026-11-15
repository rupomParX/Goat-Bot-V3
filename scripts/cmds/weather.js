const axios = require("axios");
const moment = require("moment-timezone");
const fs = require("fs-extra");
const path = require("path");

let Canvas;
try {
	Canvas = require("canvas");
} catch (e) {
	Canvas = {
		createCanvas: () => ({ getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: [] }), fillRect: () => {}, fillText: () => {} }), toBuffer: () => Buffer.from([]) }),
		loadImage: async () => ({ width: 100, height: 100 }),
		registerFont: () => {}
	};
}

// Safely register fonts if files exist
try {
	const fontSemiBold = path.join(__dirname, "/assets/font/BeVietnamPro-SemiBold.ttf");
	const fontRegular = path.join(__dirname, "/assets/font/BeVietnamPro-Regular.ttf");
	if (fs.existsSync(fontSemiBold)) {
		Canvas.registerFont(fontSemiBold, { family: "BeVietnamPro-SemiBold" });
	}
	if (fs.existsSync(fontRegular)) {
		Canvas.registerFont(fontRegular, { family: "BeVietnamPro-Regular" });
	}
} catch (err) {
	console.log("Font registration warning:", err.message);
}

function convertFtoC(F) {
	return Math.floor((F - 32) / 1.8);
}
function formatHours(hours) {
	return moment(hours).tz("Asia/Dhaka").format("HH[h]mm[p]");
}

module.exports = {
	config: {
		name: "weather",
		version: "1.3",
		author: "Rupom Par",
		countDown: 5,
		role: 0,
		description: {
			vi: "xem dự báo thời tiết hiện tại và 5 ngày sau",
			en: "view the current and next 5 days weather forecast"
		},
		category: "other",
		guide: {
			vi: "{pn} <địa điểm>",
			en: "{pn} <location>"
		},
		envGlobal: {
			weatherApiKey: "d7e795ae6a0d44aaa8abb1a0a7ac19e4"
		}
	},

	langs: {
		vi: {
			syntaxError: "Vui lòng nhập địa điểm",
			notFound: "Không thể tìm thấy địa điểm: %1",
			error: "Đã xảy ra lỗi: %1",
			today: "Thời tiết hôm nay: %1\n%2\n🌡 Nhiệt độ thấp nhất - cao nhất %3°C - %4°C\n🌡 Nhiệt độ cảm nhận được %5°C - %6°C\n🌅 Mặt trời mọc %7\n🌄 Mặt trời lặn %8\n🌃 Mặt trăng mọc %9\n🏙️ Mặt trăng lặn %10\n🌞 Ban ngày: %11\n🌙 Ban đêm: %12"
		},
		en: {
			syntaxError: "Please enter a location",
			notFound: "Location not found: %1",
			error: "An error has occurred: %1",
			today: "Today's weather: %1\n%2\n🌡 Low - high temperature %3°C - %4°C\n🌡 Feels like %5°C - %6°C\n🌅 Sunrise %7\n🌄 Sunset %8\n🌃 Moonrise %9\n🏙️ Moonset %10\n🌞 Day: %11\n🌙 Night: %12"
		}
	},

	onStart: async function ({ args, message, envGlobal, getLang }) {
		const apikey = envGlobal.weatherApiKey;
		const area = args.join(" ");
		if (!area)
			return message.reply(getLang("syntaxError"));
		
		let areaKey, dataWeather, areaName;

		try {
			// Changed to HTTPS
			const response = (await axios.get(`https://api.accuweather.com/locations/v1/cities/search.json`, {
				params: {
					q: area,
					apikey: apikey,
					language: "en-us"
				}
			})).data;

			if (!response || response.length === 0)
				return message.reply(getLang("notFound", area));
			
			const data = response[0];
			areaKey = data.Key;
			areaName = data.LocalizedName || data.EnglishName;
		}
		catch (err) {
			const errorMsg = err.response && err.response.data && err.response.data.Message 
				? err.response.data.Message 
				: err.message;
			return message.reply(getLang("error", errorMsg));
		}

		try {
			// Changed to HTTPS
			dataWeather = (await axios.get(`https://api.accuweather.com/forecasts/v1/daily/10day/${areaKey}`, {
				params: {
					apikey: apikey,
					details: true,
					language: "en-us",
					metric: false // AccuWeather returns Fahrenheit by default, handled by convertFtoC
				}
			})).data;
		}
		catch (err) {
			const errorMsg = err.response && err.response.data && err.response.data.Message 
				? err.response.data.Message 
				: err.message;
			return message.reply(`❌ Đã xảy ra lỗi: ${errorMsg}`);
		}

		const dataWeatherDaily = dataWeather.DailyForecasts;
		const dataWeatherToday = dataWeatherDaily[0];
		const msg = getLang("today", areaName, dataWeather.Headline.Text, convertFtoC(dataWeatherToday.Temperature.Minimum.Value), convertFtoC(dataWeatherToday.Temperature.Maximum.Value), convertFtoC(dataWeatherToday.RealFeelTemperature.Minimum.Value), convertFtoC(dataWeatherToday.RealFeelTemperature.Maximum.Value), formatHours(dataWeatherToday.Sun.Rise), formatHours(dataWeatherToday.Sun.Set), formatHours(dataWeatherToday.Moon.Rise), formatHours(dataWeatherToday.Moon.Set), dataWeatherToday.Day.LongPhrase, dataWeatherToday.Night.LongPhrase);

		const bgPath = path.join(__dirname, "/assets/image/bgWeather.jpg");
		let width = 800, height = 600;
		let bg;
		
		if (fs.existsSync(bgPath)) {
			bg = await Canvas.loadImage(bgPath);
			width = bg.width;
			height = bg.height;
		}

		const canvas = Canvas.createCanvas(width, height);
		const ctx = canvas.getContext("2d");
		
		if (bg) {
			ctx.drawImage(bg, 0, 0, width, height);
		}

		let X = 100;
		ctx.fillStyle = "#ffffff";
		const data = dataWeather.DailyForecasts.slice(0, 7);
		
		for (const item of data) {
			try {
				const iconUrl = `https://developer.accuweather.com/sites/default/files/${String(item.Day.Icon).padStart(2, '0')}-s.png`;
				const icon = await Canvas.loadImage(iconUrl);
				ctx.drawImage(icon, X, 210, 80, 80);
			} catch (e) {
				// Fallback if icon fails to load
			}

			ctx.font = "30px BeVietnamPro-SemiBold";
			const maxC = `${convertFtoC(item.Temperature.Maximum.Value)}°C `;
			ctx.fillText(maxC, X, 366);

			ctx.font = "30px BeVietnamPro-Regular";
			const minC = String(`${convertFtoC(item.Temperature.Minimum.Value)}°C`);
			const day = moment(item.Date).format("DD");
			ctx.fillText(minC, X, 445);
			ctx.fillText(day, X + 20, 140);

			X += 135;
		}

		await fs.ensureDir(`${__dirname}/tmp`);
		const pathSaveImg = `${__dirname}/tmp/weather_${areaKey}.jpg`;
		fs.writeFileSync(pathSaveImg, canvas.toBuffer());

		return message.reply({
			body: msg,
			attachment: fs.createReadStream(pathSaveImg)
		}, () => fs.unlinkSync(pathSaveImg));
	}
};