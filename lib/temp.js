var path = require("path");
var fss = require("./fss");
// require("./global/$.fs");
var tmpdir = path.normalize(require("os").tmpdir() + "/" + "jhs");

var temp = {
	set: co.wrap(function*(namespace, key, data) {
		var folder_path = path.normalize(tmpdir + "/" + namespace);
		var file_path = path.normalize(tmpdir + "/" + namespace + "/" + key);
		if (!(yield fs.existsAsync(folder_path))) {
			fs.smartMkdirSync(folder_path);
		}
		fss.writeFileSync(file_path, data);
	}),
	get: co.wrap(function*(namespace, key) {
		var file_path = path.normalize(tmpdir + "/" + namespace + "/" + key);
		if (!(yield fss.existsAsync(file_path))) {
			return
		}
		return yield fss.readFileAsync(file_path);
	}),
};

module.exports = temp;