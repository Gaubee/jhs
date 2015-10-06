var path = require("path");
var Fiber = require("fibers");
require("./global/$.fs");
var tmpdir = path.normalize(require("os").tmpdir() + "/" + "jhs");

var temp = {
	set: function(namespace, key, data) {
		var folder_path = path.normalize(tmpdir + "/" + namespace);
		var file_path = path.normalize(tmpdir + "/" + namespace + "/" + key);
		if (!fs.existsSync(folder_path)) {
			fs.smartMkdirSync(folder_path);
		}
		fs.writeFileSync(file_path, data);
	},
	get: function(namespace, key) {
		var file_path = path.normalize(tmpdir + "/" + namespace + "/" + key);
		if (!fs.existsSync(file_path)) {
			return
		}
		return fs.readFileSync(file_path);
	}
};

module.exports = temp;