var fs = require("fs");
var fss = Object.create(fs);
fss.existsSync = function(file_paths) {
	if (Array.isArray(file_paths)) {
		return file_paths.some(function(filepath) {
			return fs.existsSync(filepath)
		});
	} else {
		return fs.existsSync(file_paths)
	}
};
fss.existsFileInPathsSync = function(file_paths, filename) {
	return file_paths.some(function(filepath) {
		return fs.existsSync(filepath + "/" + filename)
	});
};
fss.lstatSync = function function_name(file_paths) {
	if (Array.isArray(file_paths)) {
		return file_paths.map(function(filepath) {
			return fs.lstatSync(filepath)
		});
	} else {
		return fs.lstatSync(file_paths)
	}
};

function _mix_file(file_paths, index) {
	index = ~~index;
	return fs.readFileSync(file_paths[_index]).replace("__IN_COMMENT__", "\n").replace("__SUPER_FILE_CONTENT__", function() {
		return _mix_file(file_paths, index + 1)
	});
};
fss.readFileSync = function function_name(file_paths) {
	if (Array.isArray(file_paths)) {
		var _index = 0;
		var res = _mix_file(file_paths)
	} else {
		return fs.readFileSync(file_paths)
	}
}
module.exports = fss;