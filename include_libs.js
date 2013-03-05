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
var vendor_src = cp(src, "_vendor");
var cjs_path = cp(vendor_src, "cjs");

var cjs_inc = require("./src/_vendor/cjs/include_libs");

exports.main_build = cp(build_path, ["red.min.js"]);

exports.main_src = c(
	cp(vendor_src, [
				"stopwatch.js"
				, "array_diff.js"
				, "set.js"
				, "map.js"
				, "uid.js"
	])
	, cp(cjs_path, cjs_inc.main_src)
	, cp(vendor_src, [
				"esprima/esprima.js"
				, "ablejs/able.js"
				, "underscore/underscore.js"
				, "underscore/red_underscore_extensions.js"
				, "jquery-ui-1.9.1.custom/js/jquery-1.8.2.js"
				, "jquery-ui-1.9.1.custom/js/jquery-ui-1.9.1.custom.js"
				, "raphael/raphael.js"
			])
	, cp(src, [
				"model/core.js"
				, "model/core/obj_utils.js"
				, "model/core/debug.js"
				, "model/core/special_contexts.js"
				, "model/core/parsed_fn.js"
				, "model/core/parsed_constraint.js"
				, "model/core/pointer.js"
				, "model/statechart/red_statechart.js"
				, "model/statechart/events/event_core.js"
				, "model/statechart/events/red_obj_events.js"
				, "model/statechart/events/manual_event.js"
				, "model/statechart/events/dom_events.js"
				, "model/statechart/events/timer_events.js"
				, "model/statechart/events/statechart_events.js"
				, "model/statechart/events/constraint_events.js"
				, "model/statechart/events/parsed_events.js"
				, "model/statechart/events/combination_event.js"
				, "model/core/cell.js"
				, "model/core/dict.js"
				, "model/core/special_contexts.js"
				, "model/core/stateful_obj.js"
				, "model/core/stateful_prop.js"
				, "model/core/query.js"
				, "model/core/deltas/delta_core.js"
				, "model/core/deltas/program_deltas.js"
				, "model/core/deltas/prop_deltas.js"
				, "model/attachments/attachment_core.js"
				, "model/attachments/dom_attachment.js"
				, "controller/commands/command_core.js"
				, "controller/commands/prop_commands.js"
				, "controller/commands/cell_commands.js"
				, "controller/commands/statechart_commands.js"
				, "controller/commands/combined_commands.js"
				, "model/serialize.js"
				, "controller/environment/command_stack.js"
				, "controller/environment/red_environment.js"
				, "view/environment/dom_output_view.js"
				, "view/environment/command_view.js"
			])
);

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
