var is_dev;
var file_key = "product";
process.argv.some(function(key) {
	if (key.indexOf("-dev") === 0) {
		file_key = key.split("-dev:")[1] || "dev";
		return (is_dev = true);
	}
});
console.log(is_dev ? "开发模式" : "部署模式");
var base_config = require("../" + file_key + ".config");
base_config.code_start_reg = "<?js";
base_config.code_end_reg = "?>";

module.exports = base_config;