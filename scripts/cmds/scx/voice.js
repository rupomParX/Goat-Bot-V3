/**
 * SCX voice: free Google Translate TTS + procedural pentatonic background music.
 * No audio assets or API key are needed.
 */
const { spawn, spawnSync } = require("child_process");
const axios = require("axios");

const SR = 44100;

function ffmpegPath() {
	if (global.scxFfmpeg) return global.scxFfmpeg;
	let p = "ffmpeg";
	try { p = require("ffmpeg-static") || "ffmpeg"; } catch (e) { /* use system ffmpeg */ }
	const ok = spawnSync(p, ["-version"], { stdio: "ignore" });
	if (ok.error || ok.status !== 0) {
		throw new Error("ffmpeg not found. Install it (apt install ffmpeg) or run: npm i ffmpeg-static");
	}
	global.scxFfmpeg = p;
	return p;
}

function cleanSpeech(s) {
	return String(s)
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N}\s.,'-]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function splitText(text, max = 180) {
	const parts = [];
	let cur = "";
	for (const word of text.split(" ")) {
		if ((cur + " " + word).trim().length > max) { parts.push(cur.trim()); cur = word; }
		else cur = (cur + " " + word).trim();
	}
	if (cur) parts.push(cur.trim());
	return parts;
}

async function ttsChunk(text, lang) {
	let lastErr;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await axios.get("https://translate.google.com/translate_tts", {
				params: { ie: "UTF-8", q: text, tl: lang, client: "tw-ob", ttsspeed: 1 },
				responseType: "arraybuffer",
				timeout: 20000,
				headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" }
			});
			const buf = Buffer.from(res.data);
			if (buf.length < 200) throw new Error("empty audio");
			return buf;
		}
		catch (e) {
			lastErr = e;
			await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
		}
	}
	throw lastErr;
}

async function tts(text, lang = "en") {
	const clean = cleanSpeech(text);
	if (!clean) return null;
	const bufs = [];
	for (const part of splitText(clean)) bufs.push(await ttsChunk(part, lang));
	return Buffer.concat(bufs);
}

function decodeToPcm(mp3) {
	return new Promise((resolve, reject) => {
		const p = spawn(ffmpegPath(), ["-v", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", String(SR), "pipe:1"]);
		const out = [];
		let err = "";
		p.stdout.on("data", d => out.push(d));
		p.stderr.on("data", d => { err += d; });
		p.stdin.on("error", () => { });
		p.on("error", reject);
		p.on("close", code => {
			if (code !== 0) return reject(new Error("ffmpeg decode failed: " + err.slice(-300)));
			const b = Buffer.concat(out);
			const copy = b.buffer.slice(b.byteOffset, b.byteOffset + b.length - (b.length % 2));
			resolve(new Int16Array(copy));
		});
		p.stdin.end(mp3);
	});
}

function rng(seed) {
	let s = seed >>> 0;
	return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function addPluck(out, startSample, freq, dur, amp, rand) {
	const N = Math.max(2, Math.round(SR / freq));
	const buf = new Float32Array(N);
	for (let i = 0; i < N; i++) buf[i] = rand() * 2 - 1;
	const len = Math.min(Math.floor(dur * SR), out.length - startSample);
	let idx = 0;
	for (let i = 0; i < len; i++) {
		const a = buf[idx], b = buf[(idx + 1) % N];
		buf[idx] = 0.4992 * (a + b);
		const fade = i > len - 2000 ? (len - i) / 2000 : 1;
		out[startSample + i] += a * amp * fade;
		idx = (idx + 1) % N;
	}
}

function addGong(out, startSample, amp) {
	const partials = [[1, 1], [1.58, 0.6], [2.14, 0.45], [2.65, 0.3], [3.2, 0.2]];
	const base = 92;
	const len = Math.min(5 * SR, out.length - startSample);
	for (let i = 0; i < len; i++) {
		const t = i / SR;
		let v = 0;
		for (const [m, a] of partials) v += Math.sin(2 * Math.PI * base * m * t) * a * Math.exp(-t * (0.9 + m * 0.5));
		out[startSample + i] += v * amp * Math.min(1, t * 60);
	}
}

function synthMusic(totalSec, gongTimes = []) {
	const n = Math.ceil(totalSec * SR);
	const out = new Float32Array(n);
	const rand = rng(20240607);
	const scale = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
	const step = 0.52;
	let idx = 4;
	for (let k = 0, t = 0.3; t < totalSec - 0.5; k++, t += step) {
		idx = Math.max(0, Math.min(scale.length - 1, idx + Math.round((rand() - 0.5) * 4)));
		if (rand() < 0.86) addPluck(out, Math.floor(t * SR), scale[idx], 1.9, 0.5 + rand() * 0.25, rand);
		if (k % 8 === 0) addPluck(out, Math.floor(t * SR), k % 16 === 0 ? 65.41 : 98.0, 3.2, 0.7, rand);
	}
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		const trem = 0.65 + 0.35 * Math.sin(t * 0.7);
		out[i] += (Math.sin(2 * Math.PI * 65.41 * t) * 0.07 + Math.sin(2 * Math.PI * 98 * t) * 0.045) * trem;
	}
	for (const g of gongTimes) addGong(out, Math.floor(g * SR), 0.5);
	return out;
}

function mixToWav(totalSec, voices, gongTimes, musicGain = 0.24) {
	const music = synthMusic(totalSec, gongTimes);
	const n = music.length;
	const mix = new Float32Array(n);
	for (let i = 0; i < n; i++) mix[i] = music[i] * musicGain;
	for (const v of voices) {
		if (!v.pcm) continue;
		const off = Math.floor(v.at * SR);
		for (let i = 0; i < v.pcm.length && off + i < n; i++) mix[off + i] += (v.pcm[i] / 32768) * 1.0;
	}
	const pcm = Buffer.alloc(n * 2);
	for (let i = 0; i < n; i++) {
		const x = Math.tanh(mix[i] * 1.15);
		pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x * 32767))), i * 2);
	}
	const header = Buffer.alloc(44);
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write("WAVEfmt ", 8);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(SR, 24);
	header.writeUInt32LE(SR * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, pcm]);
}

module.exports = { SR, ffmpegPath, cleanSpeech, tts, decodeToPcm, synthMusic, mixToWav };