var test_map = new Map;
var test_hash = {};

var _short_key = "short";
var _long_key = Array(1000000).join(Math.random());
console.log(_long_key.length)
/*
 * set
 */
console.time("set short map");
for (var i = 0; i < 1000000; i += 1) {
	test_map.set(_short_key, {});
}
console.timeEnd("set short map");

console.time("set short hash");
for (var i = 0; i < 1000000; i += 1) {
	test_hash[_short_key] = {};
}
console.timeEnd("set short hash");

console.time("set long map");
for (var i = 0; i < 1000000; i += 1) {
	test_map.set(_long_key, {});
}
console.timeEnd("set long map");

console.time("set long hash");
for (var i = 0; i < 1000000; i += 1) {
	test_hash[_long_key] = {};
}
console.timeEnd("set long hash");

/*
 * get
 */
var res;
console.time("get short map");
for (var i = 0; i < 1000000; i += 1) {
	res = test_map.get(_short_key);
}
console.timeEnd("get short map");

console.time("get short hash");
for (var i = 0; i < 1000000; i += 1) {
	res = test_hash[_short_key];
}
console.timeEnd("get short hash");

console.time("get long map");
for (var i = 0; i < 1000000; i += 1) {
	res = test_map.get(_long_key);
}
console.timeEnd("get long map");

console.time("get long hash");
for (var i = 0; i < 1000000; i += 1) {
	res = test_hash[_long_key];
}
console.timeEnd("get long hash");

console.log(res);