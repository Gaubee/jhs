const path = require("path");
const tmpdir = path.normalize(require("os").tmpdir() + "/" + "jhs");
fs.lstat(tmpdir, (err, st) => {
	if (err) {
		fs.smartMkdirSync(tmpdir);
	}
});

const temp = {
	set: function(namespace, key, data) {
		var file_path = path.normalize(tmpdir + "/" + key + "." + namespace);
		return fss.writeFileAsync(file_path, data);
	},
	get: function(namespace, key) {
		var file_path = path.normalize(tmpdir + "/" + key + "." + namespace);
		return fss.readFileAsync(file_path);
	},
	getStream: function(namespace, key) {
		var file_path = path.normalize(tmpdir + "/" + key + "." + namespace);
		return Promise.try((resolve, reject) => {
			const st = fss.createReadStream(file_path);
			st.on("error", reject);
			st.on("readable", () => resolve(st));
			st.getContextAsync = () => Promise.readStream(st);
		});
	}
};

module.exports = temp;

const fss = require("./fss");