module.exports = {
  config: {
    name: "hello",
    aliases: ["hi"],
    version: "1.0",
    author: "Your name",
    countDown: 3,
    role: 0,
    shortDescription: { en: "Says hello" },
    category: "utility",
    guide: { en: "{pn} [name]" }
  },

  onStart: async function ({ message, args }) {
    const name = args.join(" ") || "there";
    return message.reply(`Hello, ${name}!`);
  }
};