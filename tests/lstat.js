require('gq-core');
co(function*() {
	var i;

	i = 100;
	do {
		fs.lstatSync("./test_tsc.js") // ~8ms
	} while (--i);


	const T1 = console.T("async");
	var i1 = 100;
	const run_cb = () => {
		if (--i1 === 0) {
			return T1.end("async"); //16+
		}
		fs.lstat("./test_tsc.js", run_cb)
	};
	run_cb();

	const T2 = console.T("promise");
	var i2 = 100;
	do {
		yield new Promise((y, n) => { // ~18ms
			fs.lstat("./test_tsc.js", e => y(!e))
		});
	} while (--i2);
	T2.end();

	const T3 = console.T("sync");
	var i3 = 100;
	do {
		fs.lstatSync("./test_tsc.js") // ~8ms
	} while (--i3);
	T3.end();


}, console.log.bind(console));