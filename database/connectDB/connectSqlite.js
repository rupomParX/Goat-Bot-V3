const path = require("path");

module.exports = async function () {
	const { Sequelize } = require("sequelize");
	const storage = path.join(__dirname, "..", "data", "data.sqlite");
	const sequelize = new Sequelize({
		dialect: "sqlite",
		storage,
		logging: false
	});

	const threadModel = require("../models/sqlite/thread.js")(sequelize);
	const userModel = require("../models/sqlite/user.js")(sequelize);
	const dashBoardModel = require("../models/sqlite/userDashBoard.js")(sequelize);
	const globalModel = require("../models/sqlite/global.js")(sequelize);
	const dashboardEventModel = require("../models/sqlite/dashboardEvent.js")(sequelize);

	await sequelize.sync({ force: false });

	return {
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		dashboardEventModel,
		sequelize
	};
};