const parseInt = require("./parseInt");
const assert = require("assert");
const assertEquals = assert.deepStrictEqual;
const assertTrue = assert.ok;
/*
 * https://github.com/v8/v8/blob/01590d660d6c8602b616a82816c4aea2a251be63/test/mjsunit/parse-int-float.js
 */
assertEquals(0, parseInt('0'));
assertEquals(0, parseInt(' 0'));
assertEquals(0, parseInt(' 0 '));

assertEquals(77, parseInt('077'));
assertEquals(77, parseInt('  077'));
assertEquals(77, parseInt('  077   '));
assertEquals(-77, parseInt('  -077'));

assertEquals(3, parseInt('11', 2));
assertEquals(4, parseInt('11', 3));
assertEquals(4, parseInt('11', 3.8));

assertEquals(0x12, parseInt('0x12'));
assertEquals(0x12, parseInt('0x12', 16));
assertEquals(0x12, parseInt('0x12', 16.1));
assertEquals(0x12, parseInt('0x12', NaN));
assertTrue(isNaN(parseInt('0x  ')));
assertTrue(isNaN(parseInt('0x')));
assertTrue(isNaN(parseInt('0x  ', 16)));
assertTrue(isNaN(parseInt('0x', 16)));
assertEquals(12, parseInt('12aaa'));

assertEquals(0.1, parseFloat('0.1'));
assertEquals(0.1, parseFloat('0.1aaa'));
assertEquals(0, parseFloat('0aaa'));
assertEquals(0, parseFloat('0x12'));
assertEquals(77, parseFloat('077'));

assertEquals(Infinity, parseInt('1000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '0000000000000'));

assertEquals(Infinity, parseInt('0x10000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '000000000000000000000000000000000000000000000000000000000000000000000000'
    + '0000000000000'));


var i;
var y = 10;

for (i = 1; i < 21; i++) {
  var x = eval("1.2e" + i);
  assertEquals(Math.floor(x), parseInt(x));
  x = eval("1e" + i);
  assertEquals(x, y);
  y *= 10;
  assertEquals(Math.floor(x), parseInt(x));
  x = eval("-1e" + i);
  assertEquals(Math.ceil(x), parseInt(x));
  x = eval("-1.2e" + i);
  assertEquals(Math.ceil(x), parseInt(x));
}

for (i = 21; i < 53; i++) {
  var x = eval("1e" + i);
  assertEquals(1, parseInt(x));
  x = eval("-1e" + i);
  assertEquals(-1, parseInt(x));
}

assertTrue(isNaN(parseInt(0/0)));
assertTrue(isNaN(parseInt(1/0)), "parseInt Infinity");
assertTrue(isNaN(parseInt(-1/0)), "parseInt -Infinity");

assertTrue(isNaN(parseFloat(0/0)));
assertEquals(Infinity, parseFloat(1/0), "parseFloat Infinity");
assertEquals(-Infinity, parseFloat(-1/0), "parseFloat -Infinity");

var state;
var throwingRadix = { valueOf: function() { state = "throwingRadix"; throw null; } };
var throwingString = { toString: function() { state = "throwingString"; throw null; } };
state = null;
try { parseInt('123', throwingRadix); } catch (e) {}
assertEquals(state, "throwingRadix");

state = null;
try { parseInt(throwingString, 10); } catch (e) {}
assertEquals(state, "throwingString");

state = null;
try { parseInt(throwingString, throwingRadix); } catch (e) {}
assertEquals(state, "throwingString");

// And finally, check that the Harmony additions to the Number
// constructor is available:
// assertTrue("parseInt" in Number);
// assertTrue("parseFloat" in Number);
// assertSame( Number.parseInt, parseInt);
// assertSame(Number.parseFloat, parseFloat);
// assertEquals(Number.parseFloat('0.1'), parseFloat('0.1'));
assertEquals(Number.parseInt('0xea'), parseInt('0xEA'));


// var _test_num = 100000;
// const Number_parseInt = Number.parseInt;

// console.time("parseInt")
// for (var _i = 0; _i < _test_num; _i += 1) {
//   parseInt('0xEA')
// }
// console.timeEnd("parseInt")

// console.time("Number.parseInt")
// for (var _i = 0; _i < _test_num; _i += 1) {
//   Number_parseInt('0xEA')
// }
// console.timeEnd("Number.parseInt")