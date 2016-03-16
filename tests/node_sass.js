var sass = require("node-sass");
sass.render({
	file: '/path/to/myFile.scss',
	data: 'body{background:blue; a{color:black;}}',
	sourceMap: true,
	sourceComments: true,
	includePaths: ['lib/', 'mod/'],
	outFile: __dirname + '/output.css',
	outputStyle: 'compressed'
}, function(error, result) { // node-style callback from v3.0.0 onwards
	if (error) {
		console.log(error.status); // used to be "code" in v2x and below
		console.log(error.column);
		console.log(error.message);
		console.log(error.line);
	} else {
		console.log(result);
		// console.log(result.css.toString());

		// console.log(result.stats);

		// console.log(result.map.toString());
		// // or better
		// console.log(JSON.stringify(result.map)); // note, JSON.stringify accepts Buffer too
	}
});
