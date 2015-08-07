var jhs = require("../index");
var base_config = require("./jhs_options/_base");
var config = {
	base_config: base_config,
	onready: require("./jhs_options/_init"),
	domain: base_config.domain,
	www: require("./jhs_options/www"),
	admin: require("./jhs_options/admin"),
	bus: require("./jhs_options/bus"),
	lib: require("./jhs_options/lib"),
};
module.exports = config;