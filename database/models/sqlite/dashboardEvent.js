module.exports = function (sequelize) {
	const { Model, DataTypes } = require("sequelize");
	class dashboardEventModel extends Model { }
	dashboardEventModel.init({
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		threadID: {
			type: DataTypes.STRING,
			allowNull: false
		},
		userID: DataTypes.STRING,
		userName: DataTypes.STRING,
		messageID: DataTypes.STRING,
		body: DataTypes.TEXT,
		command: DataTypes.STRING,
		kind: {
			type: DataTypes.STRING,
			defaultValue: "message"
		}
	}, {
		sequelize,
		modelName: "dashboardEvent",
		indexes: [
			{ fields: ["threadID", "createdAt"] },
			{ fields: ["command", "createdAt"] }
		]
	});

	return dashboardEventModel;
};