var ejs = require("ejs");
var ec = ejs.compile("<%= user.name %>", {
	user: {
		name: "Gaubee"
	}
});
console.log(ec);