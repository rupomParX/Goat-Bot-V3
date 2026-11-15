const { getStreamsFromAttachment } = global.utils;

module.exports = {
	config: {
		name: "notification",
		aliases: ["notify", "noti", "announce", "announcement"],
		version: "1.7",
		author: "Rupom Par",
		countDown: 5,
		role: 2,
		description: {
			vi: "Gửi thông báo từ admin đến all box",
			en: "Send notification from admin to all box"
		},
		category: "owner",
		guide: {
			en: "{pn} <tin nhắn>"
		},
		envConfig: {
			delayPerGroup: 250
		}
	},

	langs: {
		vi: {
			missingMessage: "Vui lòng nhập tin nhắn bạn muốn gửi đến tất cả các nhóm",
			notification: "Thông báo từ admin bot đến tất cả nhóm chat (không phản hồi tin nhắn này)",
			sendingNotification: "Bắt đầu gửi thông báo từ admin bot đến %1 nhóm chat",
			sentNotification: "✅ Đã gửi thông báo đến %1 nhóm thành công",
			errorSendingNotification: "Có lỗi xảy ra khi gửi đến %1 nhóm:\n%2"
		},
		en: {
			missingMessage: "Please enter the message you want to send to all groups",
			notification: "Notification from admin bot to all chat groups (do not reply to this message)",
			sendingNotification: "Start sending notification from admin bot to %1 chat groups",
			sentNotification: "✅ Sent notification to %1 groups successfully",
			errorSendingNotification: "An error occurred while sending to %1 groups:\n%2"
		}
	},

	onStart: async function ({ message, api, event, args, commandName, envCommands, threadsData, getLang }) {
		const delayPerGroup = Number(envCommands[commandName]?.delayPerGroup) || 1500;
		if (!args[0])
			return message.reply(getLang("missingMessage"));
		const body = `${getLang("notification")}\n────────────────\n${args.join(" ")}`;
		const attachments = [
			...(event.attachments || []),
			...(event.messageReply?.attachments || [])
		].filter(item => ["photo", "png", "animated_image", "video", "audio"].includes(item.type));

		const allThreadID = (await threadsData.getAll()).filter(t => t.isGroup && t.members.find(m => m.userID == api.getCurrentUserID())?.inGroup);
		await message.reply(getLang("sendingNotification", allThreadID.length));

		let sendSuccess = 0;
		const sendError = [];

		for (let index = 0; index < allThreadID.length; index++) {
			const thread = allThreadID[index];
			const tid = thread.threadID;
			try {
				const formSend = { body };
				if (attachments.length > 0)
					formSend.attachment = await getStreamsFromAttachment(attachments);
				await api.sendMessage(formSend, tid);
				sendSuccess++;
			}
			catch (e) {
				sendError.push({
					threadID: tid,
					threadName: thread.threadName || tid,
					errorDescription: e.errorDescription || e.message || String(e)
				});
			}
			if (index < allThreadID.length - 1)
				await new Promise(resolve => setTimeout(resolve, delayPerGroup));
		}

		let msg = "";
		if (sendSuccess > 0)
			msg += getLang("sentNotification", sendSuccess) + "\n";
		if (sendError.length > 0)
			msg += getLang("errorSendingNotification", sendError.length, sendError.map(({ threadName, threadID, errorDescription }) => `\n - ${threadName} (${threadID}): ${errorDescription}`).join(""));
		message.reply(msg);
	}
};