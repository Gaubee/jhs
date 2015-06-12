var Filter = require("../lib/filter").Filter;
f = Filter("*.html");
f.math("asdads.html");
console.log(f.params);

f = Filter("*.:type(\\w+)");
f.math("asdads.html");
console.log(f.params);
f.math("asdads.HTML");
console.log(f.params);
f.math("asdads.htmasdad/sl");
console.log(f.params);
