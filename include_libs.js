var cp = concat_prefix = function(prefix, strs) {
	var do_it = function(str) {
		if(prefix == "") {
			return str;
		} else {
			return prefix+"/"+str;
		}
	};

	if(typeof strs === "string") {
		return do_it(strs);
	} else {
		return strs.map(do_it);
	}
};
var c = concat = function() {
	var rv = [];
	return rv.concat.apply(rv, arguments);
};

var path = "";
var build_path = cp(path, "build");
var src = cp(path, "src");
var vendor_src = "vendor";
var cjs_path = cp(vendor_src, "cjs");

var cjs_inc = require("./vendor/cjs/include_libs");
console.log(cjs_inc);
console.log("HI");

exports.main_build = cp(build_path, ["red.min.js"]);

exports.main_src = c(
	cp(cjs_path, cjs_inc.main_src)
	, cp(src, [
			])
);

var core_tests_dir = cp(path, "test/core/unit_tests");
exports.core_tests = cp(core_tests_dir, [	"util_tests.js"
											, "primitive_type_tests.js"
											]);

var ends_with = function(str1, str2) {
	return str1.slice(str1.length-str2.length) == str2;
};
exports.include_templates = function(strs) {
	var do_it = function(str) {
		if(ends_with(str, ".js")) {
			return "<script type = 'text/javascript' src = '"+str+"'></script>";
		} else if(ends_with(str, ".css")) {
			return "<link rel = 'stylesheet' href = '"+str+"' media='screen' />";
		}
	};
	if(typeof strs === "string") {
		return do_it(strs);
	} else {
		return strs.map(do_it).join("");
	}
};
