(function(red) {
var cjs = red.cjs, _ = cjs._;

var pad = function(str, len) {
	if(str.length > len) {
		return str.substring(0, len);
	} else if(str.length < len) {
		var rv = str;
		while(rv.length < len) {
			rv += " ";
		}
		return rv;
	} else {
		return str;
	}
};

var print_table = function(table, max_width) {
	if(!max_width) {
		max_width = -1;
	}

	var column_widths = [];
	_.forEach(table, function(cells, row) {
		_.forEach(cells, function(cell, col) {
			if(!_.isString(cell)) {
				cell = cell + "";
			}
			var len = cell.length;
			column_widths[col] = _.isNumber(column_widths[col]) ? Math.max(len, column_widths[col]) : len;
		});
	});

	if(max_width > 0) {
		column_widths = _.map(column_widths, function(column_width) {
			return Math.min(column_width, max_width);
		});
	}

	var row_divider_length = 0;
	_.forEach(column_widths, function(column_width) {
		row_divider_length += column_width + 3;
	});
	var row_divider = "";
	while(row_divider.length < row_divider_length) {
		row_divider += "-";
	}

	var table_str= "";
	_.forEach(table, function(cells, row) {
		var row_str = "";
		_.forEach(cells, function(cell, col) {
			if(!_.isString(cell)) {
				cell = cell+"";
			}
			row_str += pad(cell, column_widths[col]);
			if(col < cells.length-1) {
				row_str += " | ";
			}
		});
		table_str += row_str;
		if(row < table.length-1) {
			table_str += "\n" + row_divider + "\n";
		}
	});
	return table_str;
};

var command_stack_factory = function() {
	var stack = [];
	var index = -1; // Points at the next thing to undo

	var can_undo = function() {
		return index >= 0;
	};
	var can_redo = function() {
		return index < stack.length - 1;
	};

	return {
		_do: function(command) {
			var discarded_commands = stack.splice(index + 1, stack.length - index);

			command._do();
			_.forEach(discarded_commands, function(discarded_command) {
				if(cjs.is_constraint(discarded_command)) {
					discarded_command.destroy();
				}
			});

			stack.push(command);
			index++;
		}
		, _undo: function() {
			if(can_undo()) {
				var last_command = stack[index];
				last_command._undo();
				index--;
			}
		}
		, _redo: function() {
			if(can_redo()) {
				var last_command = stack[index+1];
				last_command._do()
				index++;
			}
		}
		, print: function() {
			console.log(stack, index);
		}
		, can_undo: can_undo
		, can_redo: can_redo
	};
};

var pointer_factory = function(initial_pointer) {
	var pointer = initial_pointer;

	return {
		parent: function() {
		}
		, prop: function() {
		}
		, get_pointer: function() {
			return pointer;
		}
		, set_pointer: function(p) {
			pointer = p;
		}
	};
};

var Env = function(dom_container_parent) {
	this.root = cjs.create("red_dict");

	// Undo stack
	this._command_stack = command_stack_factory();

	//Context tracking
	this._pointer = pointer_factory(this.root);

	this.initialize_props();
};

(function(my) {
	var proto = my.prototype;

	proto.initialize_props = function() {
	//	this.set("dom", this._dom_obj_blueprint);
	//	this.set("children", "dict");
	};

	proto._do = function(command) { this._command_stack._do(command); };
	proto.undo = function() { this._command_stack._undo(); return this.print(); };
	proto.redo = function() { this._command_stack._redo(); return this.print(); };

	proto.in_prop = function(prop_name) {
		prop_name = prop_name || "";
		var pointer = this.get_pointer();

		_.forEach(prop_name.split("."), function(name) {
			if(pointer) {
				pointer = pointer.get_prop(name);
			}
		});
		this._pointer.set_pointer(pointer);

		return this.print();
	};
	proto.top = function() {
		this._pointer.set_pointer(this.root);

		return this.print();
	};
	proto.get_pointer = function() {
		return this._pointer.get_pointer();
	};

	proto._get_set_prop_command = function(prop_name, value, index) {
		var parent_obj = this.get_pointer();
		if(!_.isString(prop_name)) {
			var parent_direct_props = parent_obj._get_direct_props();
			prop_name = "prop_" + parent_direct_props.length;

			var original_prop_name = prop_name;
			var prop_try = 0;
			while(parent_obj.has_prop(prop_name)) {
				prop_name = original_prop_name + "_" + prop_try;
				prop_try++;
			}
		}

		if(_.isString(value)) {
			if(value === "dict") {
				value = cjs.create("red_dict");
			} else if(value === "stateful") {
				value = cjs.create("red_stateful_obj", {implicit_protos: [this._proto_prop_blueprint]});
				value.run();
			} else {
				value = cjs.create("red_cell", {str: value});
			}
		}

		var command = red.command("set_prop", {
			parent: parent_obj
			, name: prop_name
			, value: value
			, index: index
		});
		return command;
	};
	proto.add = proto.set = function() {
		var command = this._get_set_prop_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto.print = function() {
		var pointer = this.get_pointer();

		var value_to_value_str = function(val) {
			if(_.isUndefined(val)) {
				return "(undefined)";
			} else if(_.isNull(val)) {
				return "(null)";
			} else if(_.isNumber(val)) {
				return val + "";
			} else if(_.isString(val)) {
				return '"' + val + '"';
			} else if(val instanceof red.RedDict) {
				return "(dict)";
			} else if(val instanceof red.RedCell) {
				return "(cell)";
			} else if(_.isArray(val)) {
				return "[" + _.map(val, function(v) { return value_to_value_str(v);}).join(", ") + "]";
			} else {
				return "{ " + _.map(val, function(v, k) {
					return k + ": " + value_to_value_str(v);
				}).join(", ") + " }";
			}
		};

		var value_to_source_str = function(val) {
			if(_.isUndefined(val)) {
				return "(undefined)";
			} else if(_.isNull(val)) {
				return "(null)";
			} else if(_.isString(val)) {
				return '"' + val + '"';
			} else if(_.isNumber(val)) {
				return val + "";
			} else if(val instanceof red.RedDict) {
				return "";
			} else if(val instanceof red.RedCell) {
				return "= " + val.get_str();
			} else {
				return val + "";
			}
		};

		var tablify_dict = function(dict, indentation_level, context) {
			if(!_.isNumber(indentation_level)) { indentation_level = 0; }
			if(_.isUndefined(context)) { context = cjs.create("red_context"); }

			var indent = "";
			while(indent.length < indentation_level) {
				indent += " ";
			}
			var rows = [];
			var prop_names = dict.get_prop_names();
			_.forEach(prop_names, function(prop_name) {
				var value = dict.get_prop(prop_name);
				var is_inherited = dict.is_inherited(prop_name);
				prop_name = indent + prop_name;
				if(is_inherited) { prop_name += " i" }
				if(value === pointer) { prop_name = "> " + prop_name; }
				else { prop_name = "  " + prop_name; }

				var value_got = red.get_contextualizable(value, context);

				if(value instanceof red.RedDict) {
					var row = [prop_name, value_to_value_str(value_got), value_to_source_str(value)];
					rows.push(row);

					var tablified_values = tablify_dict(value, indentation_level + 2, context.push(value));
					rows.push.apply(rows, tablified_values);
				} else {
					var row = [prop_name, value_to_value_str(value_got), value_to_source_str(value)];
					rows.push(row);
				}
			});
			return rows;
		};

		var to_print_statecharts = [];

		var table = tablify_dict(this.root);
		var str = print_table(table);
		str += "\n\n====\n";
		_.forEach(to_print_statecharts, function(statechart) {
			str += "\n"
			str += statechart.stringify();
			str += "\n"
		});
		return "\n" + str;
	};

	proto._get_set_prop_command = function(prop_name, value, index) {
		var parent_obj = this.get_pointer();
		if(!_.isString(prop_name)) {
			var parent_direct_props = parent_obj._get_direct_props();
			prop_name = "prop_" + parent_direct_props.length;

			var original_prop_name = prop_name;
			var prop_try = 0;
			while(parent_obj.has_prop(prop_name)) {
				prop_name = original_prop_name + "_" + prop_try;
				prop_try++;
			}
		}

		if(_.isUndefined(value)) {
			if(parent_obj instanceof red.RedDict) {
				value = cjs.create("red_cell", {str: ""});
			}
		} else if(_.isString(value)) {
			if(value === "dict") {
				value = cjs.create("red_dict");
			} else if(value === "stateful") {
				value = cjs.create("red_stateful_obj");
				value.run();
			} else {
				value = cjs.create("red_cell", {str: value});
			}
		}

		var command = red.command("set_prop", {
			parent: parent_obj
			, name: prop_name
			, value: value
			, index: index
		});
		return command;
	};
	proto.set = function() {
		var command = this._get_set_prop_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};
	proto._get_unset_prop_command = function(prop_name) {
		var parent_obj = this.get_context();
		if(!_.isString(prop_name)) {
			console.error("No name given");
			return;
		}
		var command = red.command("unset_prop", {
			parent: parent_obj
			, name: prop_name
		});
		return command;
	};
	proto.unset = function() {
		var command = this._get_unset_prop_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_rename_prop_command = function(from_name, to_name) {
		var parent_obj = this.get_pointer();
		var command = red.command("rename_prop", {
			parent: parent_obj
			, from: from_name
			, to: to_name
		});
		return command;
	};
	proto.rename = function() {
		var command = this._get_rename_prop_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};
	proto._get_move_prop_command = function(prop_name, index) {
		var parent_obj = this.get_pointer();
		var command = red.command("move_prop", {
			parent: parent_obj
			, name: prop_name
			, to: index
		});
		return command;
	};
	proto.move = function() {
		var command = this._get_move_prop_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};
	/*

	proto.get_statechart_context = function() {
		var context = this.get_context();
		var statechart;
		
		if(cjs.is_statechart(context)) {
			statechart = context;
		} else if(context instanceof red.RedStatefulObj) {
			statechart = context.get_own_statechart();
		}
		return statechart;
	};


	proto._get_set_cell_command = function(arg0, arg1, arg2) {
		var combine_command = false;
		var cell, str, for_state;
		if(arguments.length === 1) {
			cell = this.get_context();
			str = arg0;
		} else if(arguments.length === 2) {
			cell = this.root;
			_.forEach(arg0.split("."), function(name) {
				cell = cell.get_prop(name);
			});
			str = arg1;
		} else {
			prop = this.get_context();
			_.forEach(arg0.split("."), function(name) {
				prop = prop.get_prop(name);
			});

			for_state = arg1;
			str = arg2;

			var context = this.get_context();
			var context_states = context.get_states();
			if(_.isNumber(for_state)) {
				for(var i = 0; i<context_states.length; i++) {
					if(context_states[i].id === for_state) {
						for_state = context_states[i];
						break;
					}
				}
			} else if(_.isString(for_state)) {
				var statechart = this.get_statechart_context();
				for_state = get_state(context, statechart, for_state);
			}
			cell = cjs.create("red_cell", {str: ""});
			combine_command = this._get_stateful_prop_set_value_command(prop, for_state, cell);
		}
		var command;
		var change_cell_command = red.command("change_cell", {
			cell: cell
			, str: str
		});
		if(combine_command) {
			command = red.command("combined", {
				commands: [combine_command, change_cell_command]
			});
		} else {
			command = change_cell_command;
		}
		return command;
	};

	proto.set_cell = function() {
		var command = this._get_set_cell_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_add_state_command = function(state_name, index) {
		var statechart = this.get_statechart_context();

		if(_.isNumber(index)) { index++; } // Because of the pre_init state

		var command = red.command("add_state", {
			state_name: state_name
			, statechart: statechart
			, index: index
		});
		return command;
	};

	proto.add_state = function() {
		var command = this._get_add_state_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_remove_state_command = function(state_name) {
		var statechart = this.get_statechart_context();

		var command = red.command("remove_state", {
			state_name: state_name
			, statechart: statechart
		});
		return command;
	};
	proto.remove_state = function() {
		var command = this._get_remove_state_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_move_state_command = function(state_name, index) {
		var statechart = this.get_statechart_context().get_state_with_name("running.own");

		if(_.isNumber(index)) { index++; } // Because of the pre_init state
		var command = red.command("move_state", {
			state_name: state_name
			, statechart: statechart
			, index: index
		});
		return command;
	};

	proto.move_state = function() {
		var command = this._get_move_state_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};


	proto._get_rename_state_command = function(from_state_name, to_state_name) {
		var statechart = this.get_statechart_context();

		var command = red.command("rename_state", {
			from: from_state_name
			, to: to_state_name
			, statechart: statechart
		});
		return command;
	};
	proto.rename_state = function() {
		var command = this._get_rename_state_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	var get_state = function(parent, statechart, state_name) {
		return parent.find_state(state_name);
	};

	proto._get_add_transition_command = function(from_state_name, to_state_name, event) {
		var statechart = this.get_statechart_context();
		var parent = this.get_context();

		var from_state = get_state(parent, statechart, from_state_name);
		var to_state = get_state(parent, statechart, to_state_name);

		var command = red.command("add_transition", {
			statechart: statechart
			, parent: parent
			, event: event
			, from: from_state
			, to: to_state
		});
		return command;
	};
	proto.add_transition = function() {
		var command = this._get_add_transition_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_remove_transition_command = function(transition_id) {
		var statechart = this.get_statechart_context();

		var command = red.command("remove_transition", {
			statechart: statechart
			, id: transition_id
		});
		return command;
	};
	proto.remove_transition = function() {
		var command = this._get_remove_transition_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_set_event_command = function(transition_id, event) {
		var statechart = this.get_statechart_context();

		var command = red.command("set_transition_event", {
			statechart: statechart
			, id: transition_id
			, event: event
		});
		return command
	};
	proto.set_event = function() {
		var command = this._get_set_event_command.apply(this, arguments);
		this._do(command);
		return this.print();
	};

	proto._get_stateful_prop_set_value_command = function(stateful_prop, state, value) {
		var command = red.command("set_stateful_prop_value", {
			stateful_prop: stateful_prop
			, state: state
			, value: value
		});
		return command;
	};

	proto._get_stateful_prop_unset_value_command = function(stateful_prop, state) {
		var command = red.command("unset_stateful_prop_value", {
			stateful_prop: stateful_prop
			, state: state
		});
		return command;
	};
	*/
}(Env));

red.create_environment = function(dom_container_parent) {
	var env = new Env(dom_container_parent);
	return env;
};
}(red));