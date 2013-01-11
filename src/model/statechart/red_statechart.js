(function(red) {
var cjs = red.cjs, _ = red._;

var find_equivalent_state = function(to_state, in_tree) {
	var in_tree_basis = in_tree.basis();
	var in_tree_basis_lineage = in_tree_basis.get_lineage();
	var to_state_lineage = to_state.get_lineage();

	var in_tree_basis_lineage_len = in_tree_basis_lineage.length;
	var to_state_lineage_len = to_state_lineage.length;
	
	var in_tree_basis_index = in_tree_basis_lineage_len - 1;
	var to_state_index;
	outer_loop:
	while(in_tree_basis_index < in_tree_basis_lineage_len) {
		for(var i = to_state_lineage_len; i>=0; i--) {
			if(to_state_lineage[i] === in_tree_basis_lineage[in_tree_basis_index]) {
				to_state_index = i;
				break outer_loop;
			}
		}
		in_tree_basis_index--;
	}
	var search_item = in_tree;
	var parentage_level = in_tree_basis_lineage_len - 1 - in_tree_basis_index;
	_.times(parentage_level, function() {
		search_item = search_item.parent();
	});

	for(var i = to_state_index+1; i < to_state_lineage_len; i++) {
		var name = to_state_lineage[i].get_name(to_state_lineage[i-1]);
		search_item = search_item.get_substate_with_name(name);
	}
	if(search_item.basis() !== to_state) { throw new Error("Could not find correct equivalent item"); }
	return search_item;
};

var StatechartTransition = function(options, defer_initialization) {
	able.make_this_listenable(this);
	this.$remove = _.bind(this.remove, this);
	this.$destroy = _.bind(this.destroy, this);
	this.$updateTo = _.bind(function(event) {
		var state = event.state;
		var old_to = this.to();
		var new_to = find_equivalent_state(state, my_to);
		this.setTo(new_to);
	}, this);
	this.$updateFrom = _.bind(function(event) {
		var state = event.state;
		var old_from = this.from();
		var new_from = find_equivalent_state(state, my_from);
		this.setFrom(new_from);
	}, this);
	if(defer_initialization !== true) {
		this.do_initialize(options);
	}
};
(function(my) {
	var proto = my.prototype;
	able.make_proto_listenable(proto);
	proto.do_initialize = function(options) {
		this._from_state = options.from;
		this._to_state = options.to;
		this.set_basis(options.basis);
		this._id = _.uniqueId();
		this.do_fire = _.bind(this.fire, this);
		this.set_event(options.event);
	};
	proto.basis = function() { return this._basis; };
	proto.set_basis = function(basis) {
		if(this._basis) {
			this._basis.off("setTo", this.$updateTo);
			this._basis.off("setFrom", this.$updateFrom);
			this._basis.off("remove", this.$remove);
			this._basis.off("destroy", this.$destroy);
		}
		this._basis = basis;
		if(this._basis) {
			this._basis.on("setTo", this.$updateTo);
			this._basis.on("setFrom", this.$updateFrom);
			this._basis.on("remove", this.$remove);
			this._basis.on("destroy", this.$destroy);
		}
		return this;
	};
	proto.id = function() { return this._id; }
	proto.from = function() { return this._from_state; }; 
	proto.to = function() { return this._to_state; };
	proto.setFrom = function(state) {
		this._from_state._remove_direct_outgoing_transition(this);
		this._from_state = state;
		this._from_state._add_direct_incoming_transition(this);
		this._emit("setFrom", {target: this, state: state});
		return this;
	};
	proto.setTo = function(state) {
		this._to_state._remove_direct_outgoing_transition(this);
		this._to_state = state;
		this._to_state._add_direct_incoming_transition(this);
		this._emit("setTo", {target: this, state: state});
		return this;
	};
	proto.set_event = function(event) {
		if(this._event) {
			this._event.off_fire(this.do_fire);
			this._event.destroy();
		}
		this._event = event;
		if(this._event) {
			this._event.set_transition(this);
			this._event.on_fire(this.do_fire);
		}
	};
	proto.event = function() { return this._event; };
	proto.involves = function(state) { return this.from() === state || this.to() === state; };
	proto.destroy = function() {
		this._emit("destroy", {target: this});
		this.set_basis(undefined);
		this._event.off_fire(this.do_fire);
		this._event.destroy();
	};
	proto.fire = function(event) {
		if(this.from().on_outgoing_transition_fire(this, event)) {
			this._emit("fire", {target: this, event: event});
		}
	};
	proto.create_shadow = function(from_state, to_state, parent_statechart, context) {
		var my_event = this.event()
			, shadow_event = my_event.create_shadow(parent_statechart, context);
		var shadow_transition = new StatechartTransition({from: from_state, to: to_state, event: shadow_event, basis: this});
		return shadow_transition;
	};
	proto.stringify = function() {
		var event = this.event();
		var stringified_event = event ? ","+event.stringify() : "";
		return "" + this.id() + stringified_event;
	};
	proto.remove = function() {
		var from = this.from();
		var to = this.to();
		cjs.wait();
		from._remove_direct_outgoing_transition(this);
		to._remove_direct_incoming_transition(this);
		cjs.signal();
		this._emit("remove", {transition: this});
	};

	proto.serialize = function() {
		return {
			from: red.serialize(this.from())
			, to: red.serialize(this.to())
			, event: red.serialize(this.event())
		};
	};
	my.deserialize = function(obj) {
		var rv = new StatechartTransition(undefined, true);
		rv.initialize = function() {
			this.do_initialize({from: red.deserialize(obj.from), to: red.deserialize(obj.to), event: red.deserialize(obj.event)});
		};
		return rv;
	};
}(StatechartTransition));
red.StatechartTransition = StatechartTransition;

var State = function(options, defer_initialization) {
	options = options || {};
	able.make_this_listenable(this);
	this._id = _.uniqueId();

	this.$onBasisAddTransition = _.bind(function(event) {
		var transition = event.target;
		var new_from = find_equivalent_state(transition.from(), this);
		var new_to = find_equivalent_state(transition.to(), this);
		this.add_transition(transition.create_shadow(new_from, new_to, this, this.context()));
	}, this);
	this.$onBasisAddSubstate = _.bind(function(event) {
		var state_name = event.state_name,
			state = event.state,
			index = event.index;
		this.add_substate(state_name, state.create_shadow(), index); 
	}, this);
	this.$onBasisRemoveSubstate = _.bind(function(event) {
		var substate = event.state;
		this.remove_substate(substate, false);
	}, this);
	this.$onBasisRenameSubstate = _.bind(function(event) {
		var from_name = event.from,
			to_name = event.to;
		this.rename_substate(from_name, to_name);
	}, this);
	this.$onBasisMoveSubstate = _.bind(function(event) {
		var state_name = event.state_name,
			index = event.index;
		this.move_state(state_name, index);
	}, this);
	this.$onBasisDestroy = _.bind(function(event) {
		this.destroy();
	}, this);

	if(defer_initialization !== true) {
		this.do_initialize(options);
	}
};

(function(my) {
	var proto = my.prototype;
	able.make_proto_listenable(proto);

	proto.set_basis = function(basis) {
		if(this._basis) {
			this._basis.off("add_transition", this.$onBasisAddTransition);
			this._basis.off("add_substate", this.$onBasisAddSubstate);
			this._basis.off("remove_substate", this.$onBasisRemoveSubstate);
			this._basis.off("rename_substate", this.$onBasisRenameSubstate);
			this._basis.off("move_substate", this.$onBasisMoveSubstate);
			this._basis.off("destroy", this.$onBasisDestroy);
		}
		this._basis = basis;
		if(this._basis) {
			this._basis.on("add_transition", this.$onBasisAddTransition);
			this._basis.on("add_substate", this.$onBasisAddSubstate);
			this._basis.on("remove_substate", this.$onBasisRemoveSubstate);
			this._basis.on("rename_substate", this.$onBasisRenameSubstate);
			this._basis.on("move_substate", this.$onBasisMoveSubstate);
			this._basis.on("destroy", this.$onBasisDestroy);
		}
		return this;
	};

	proto.do_initialize = function(options) {
		this._parent = options.parent;
		this.set_basis(options.basis);
		this._context = options.context;
	};
	proto.get_name = function(relative_to) {
		var parent = this.parent();
		if(!relative_to) {
			relative_to = this.root();
		}

		var my_name = parent ? parent.get_name_for_substate(this) : "";
		if(parent === relative_to) {
			return my_name;
		} else {
			var parent_name = parent ? parent.get_name(relative_to) : "";
			if(parent_name === "") {
				return my_name;
			} else {
				return parent_name + "." + my_name;
			}
		}
	};
	proto.id = proto.hash = function() { return this._id; };
	proto.basis = function() { return this._basis; };
	proto.parent = function() { return this._parent; };
	proto.context = function() { return this._context; };
	proto.set_parent = function(parent) { this._parent = parent; return this; };
	proto.set_context = function(context) { this._context = context; return this; };

	proto.is_based_on = function(state) {
		return this.basis() === state;
	};

	proto.is_child_of = function(node) {
		var curr_parent = this.parent();
		while(curr_parent) {
			if(curr_parent === node) {
				return true;
			}
			curr_parent = curr_parent.parent();
		}
		return false;
	};

	proto.get_lineage = function(until_state) {
		var curr_node = this;
		var parentage = [];
		var i = 0;
		do {
			parentage[i++] = curr_node;
			curr_node = curr_node.parent();
			if(curr_node === until_state) { break; }
		} while(curr_node);
		return parentage.reverse();
	};

	proto.root = function() {
		var parent = this.parent();
		if(parent) { return parent.root(); }
		else { return this; }
	};

	proto.on_outgoing_transition_fire = function(transition, event) {
		if(this.is_running()) {
			var to = transition.to();
			var to_lineage = to.get_lineage();
			var to_len = to_lineage.length;
			var my_lineage = this.get_lineage();

			var min_len = Math.min(to_len, my_lineage.length);

			for(var i = 0; i<min_len; i++) {
				if(to_lineage[i] !== from_lineage[i]) {
					break;
				}
			}
			cjs.wait();
			for(; i<to_len-1; i++) {
				var parent = to_lineage[i];
				var active_substate = to_lineage[i+1];
				if(!active_substate.is_running()) {
					active_substate.run();
				}
				parent.set_active_substate(active_substate, transition, event);
			}
			cjs.signal();
		}
		return false;
	};

	proto.stringify = function(tab_level, punctuation) {
		var name_spacing = 15;
		var rv = "";
		if(!_.isString(punctuation)) { punctuation = ""; }
		if(!_.isNumber(tab_level)) { tab_level = 0; }
		_.times(tab_level, function() {
			rv += "    ";
		});
		var name = punctuation + this.id() + ": " + this.get_name(this.parent());
		rv += name;
		_.times(Math.max(1, name_spacing - name.length), function() {
			rv += " ";
		});
		rv += _.map(this.get_outgoing_transitions(), function(transition) {
			var to = transition.to().get_name();
			return " -(" + transition.stringify() + ")-> " + to;
		}).join(", ");
		var substates = this.get_substates(true);
		if(substates.length > 1) { // move than the start state
			_.each(substates, function(substate) {
				rv += "\n";
				var punctuation = "";
				if(this.is_concurrent()) {
					punctuation = "| ";
				} else if(this.is(substate)) {
					punctuation = "* ";
				}
				rv += substate.stringify(tab_level + 1, punctuation);
			}, this);
		}
		return rv;
	};
}(State));
red.State = State;

var StartState = function(options) {
	StartState.superclass.constructor.apply(this, arguments);
};
(function(my) {
	_.proto_extend(my, State);
	var proto = my.prototype;
	proto.do_initialize = function(options) {
		my.superclass.do_initialize.apply(this, arguments);
		var to = options.to || this;
		this.outgoingTransition = options.outgoing_transition || new StatechartTransition({
			from: this,
			to: to,
			event: red.create_event("statechart", this.parent(), "run")
		});
		to._add_direct_incoming_transition(this.outgoingTransition);
	};
	proto.setTo = function(toNode) {
		var transition = this.outgoingTransition;
		if(toNode.is_child_of(this.parent())) {
			transition.setTo(toNode);
		}
	};
	proto.getTo = function() {
		var transition = this.outgoingTransition;
		return transition.to();
	};
	proto.get_substates = function() { return []; };
	proto.get_active_states = function() { return []; };
	proto.get_outgoing_transitions = function() { return [this.outgoingTransition]; };
	proto.get_incoming_transitions = function() { 
		return this.outgoingTransition.to() === this ? [this.outgoingTransition] : [];
	};
	proto._add_direct_incoming_transition = function() {};
	proto._remove_direct_incoming_transition = function() {};
	proto._add_direct_outgoing_transition = function() {};
	proto._remove_direct_outgoing_transition = function() {};
	proto.is_running = function() { return false; };
	proto.run = function() {};
	proto.hash = function() { return this.id(); };
	proto.destroy = function() {
		this.outgoingTransition.destroy();
	};
	proto.create_shadow = function(parent, context) {
		var shadow = new StartState({
			parent: parent,
			basis: this,
		});
		return shadow;
	};
	proto.serialize = function() {
		return {
			outgoing_transition: red.serialize(this.outgoingTransition)
			, parent: red.serialize(this.parent())
		};
	};
	my.deserialize = function(obj) {
		var rv = new StartState(undefined, true);
		rv.initialize = function() {
			var options = {
				outgoing_transition: red.deserialize(obj.outgoing_transition)
				, parent: red.deserialize(obj.parent)
			};
			this.do_initialize(options);
		};

		return rv;
	};
}(StartState));
red.StartState = StartState;

var Statechart = function(options, defer_initialization) {
	Statechart.superclass.constructor.apply(this, arguments);
};
(function(my) {
	_.proto_extend(my, State);
	var proto = my.prototype;

	proto.do_initialize = function(options) {
		my.superclass.do_initialize.apply(this, arguments);
		this._start_state = options.start_state || new StartState({
			parent: this,
			to: options.start_at
		});
		this.$substates = cjs.map({
			valuehash: "hash"
		});
		this.$local_state = cjs.$(this._start_state);
		this.$concurrent = cjs.$(false);
		this._running = false;
		this._parent = options.parent;
		this.$incoming_transitions = cjs.array();
		this.$outgoing_transitions = cjs.array();
	};

	proto.is_concurrent = function() { return this.$concurrent.get(); };
	proto.make_concurrent = function(is_concurrent) { this.$concurrent.set(is_concurrent===true); return this; };
	proto.get_substates = function(include_start) {
		var substates = this.$substates.values();
		if(include_start) {
			return ([this.get_start_state()]).concat(substates);
		} else {
			return substates;
		}
	};
	proto.get_start_state = function() { return this._start_state; };
	proto.get_incoming_transitions = function() { return this.$incoming_transitions.toArray(); };
	proto.get_outgoing_transitions = function() { return this.$outgoing_transitions.toArray(); };
	proto.get_active_substate = function(substate) { return this.$local_state.get(); };
	proto.is_running = function() { return this._running; };

	proto.flatten_substates = function(include_start) {
		return ([this]).concat(_.flatten(_.map(this.get_substates(include_start), function(substate) {
			return substate.flatten_substates(include_start);
		})));
	};

/*
	var get_state_regex = function(state_name) { 
		var valid_chars = "[^\\-<>a-zA-Z0-9]*";
		return valid_chars + "\\*|("+state_name+")" + valid_chars;
	};
	*/
	proto.set_active_substate = function(state, transition, event) {
		/*
		var old_state = this.get_active_substate();
		var old_state_name = old_state ? old_state.get_name() : "";
		var new_state_name = state ? state.get_name() : "";
		var pre_transition_listeners = [];
		var post_transition_listeners = [];
		var old_state_regex = get_state_regex(old_state_name);
		var new_state_regex = get_state_regex(new_state_name);
		_.each(this._listeners, function(listeners, spec) {
			if(spec.match(new RegExp("^"+new_state_regex+"$"))) {
				post_transition_listeners.push.apply(post_transition_listeners, listeners);
			} else if(spec.match(new RegExp("^" + old_state_regex + "(->|<->)" + new_state_regex+"$"))) {
				post_transition_listeners.push.apply(post_transition_listeners, listeners);
			} else if(spec.match(new RegExp("^" + old_state_regex + "(>-|>-<)" + new_state_regex+"$"))) {
				pre_transition_listeners.push.apply(pre_transition_listeners, listeners);
			}
		});
		var fsm = this;

		_.each(pre_transition_listeners, function(listener) { listener(event, new_state_name, old_state_name, transition, fsm); });
		*/

		red.event_queue.once("end_event_queue", function() {
			this.$local_state.set(state);
		//	_.each(post_transition_listeners, function(listener) { listener(event, new_state_name, old_state_name, transition, fsm); });
		}, this);
	};
	proto.run = function() {
		if(!this.is_running()) {
			red.event_queue.wait();
			this._running = true;
			_.forEach(this.get_substates(), function(substate) {
				substate.run();
			});
			this._emit("run", {
				target: this
			});
			red.event_queue.signal();
		}
		return this;
	};
	proto.stop = function() {
		red.event_queue.wait();
		this._running = false;
		this.$local_state.set(this._start_state);
		_.forEach(this.get_substates(), function(substate) {
			substate.stop();
		});
		this._emit("stop", {
			target: this
		});
		red.event_queue.signal();
		return this;
	};
	proto.reset = function() {
		if(this.is_running()) {
			this.stop();
			this.run();
		}
		return this;
	};
	proto.get_name_for_substate = function(substate) {
		return substate === this.get_start_state() ? "(start)" : this.$substates.keyForValue(substate);
	};
	proto.get_active_direct_substates = function() {
		if(this.is_concurrent()) {
			return this.get_substates();
		} else {
			var local_state = this.$local_state.get();
			return [local_state];
		}
	};
	proto.get_active_states = function() {
		return _.chain(this.get_active_direct_substates())
				.map(function(substate) {
					return ([substate]).concat(substate.get_active_states());
				})
				.flatten(true)
				.value();
	};
	proto.get_substate_with_name = function(name) { return this.$substates.get(name); };
	proto.has_substate_with_name = function(name) { return this.$substates.has(name); };
	proto.find_state = function(state_name, create_superstates, state_value, index) {
		if(state_name instanceof State) {
			return state_name;
		} else if(_.isArray(state_name)) {
			if(_.isEmpty(state_name)) {
				return this;
			} else {
				var first_state_name = _.first(state_name);
				if(_.size(state_name) === 1) {
					if(!this.has_substate_with_name(first_state_name) && create_superstates === true) {
						this.add_substate(first_state_name, state_value, index);
					}
					var state = this.get_substate_with_name(first_state_name);
					return state || undefined;
				} else {
					if(create_superstates===true && !this.has_substate_with_name(first_state_name)) {
						this.add_substate(first_state_name);
					}
					var state = this.get_substate_with_name(first_state_name);
					if(!state) {
						return undefined;
					} else {
						return state.find_state(_.rest(state_name), create_superstates, state_value, index);
					}
				}
			}
		} else if(_.isString(state_name)) {
			return this.find_state(state_name.split("."), create_superstates, state_value, index);
		} else {
			return undefined;
		}
	};
	proto.get_substate_index = function(substate) {
		return this.$substates.values().indexOf(this.find_state(substate));
	};
	proto.add_substate = function(state_name, state, index) {
		if(state instanceof Statechart) {
			state.set_parent(this);
		} else {
			state = new Statechart({parent: this});
		}
		this.$substates.put(state_name, state, index);
		this._emit("add_substate", {
			state_name: state_name,
			state: state,
			index: index
		});
	};
	proto.remove_substate = function(substate, also_destroy) {
		var name = this.$substates.keyForValue(substate);
		if(name) {
			cjs.wait();
			if(this.get_active_substate() === substate) {
				this.set_active_substate(undefined);
			}
			this.$substates.remove(name);
			cjs.signal();

			this._emit("remove_substate", {
				state: substate,
				name: name
			});

			if(also_destroy !== false) {
				substate.destroy();
			}
		}
	};
	proto.rename_substate = function(from_name, to_name) {
		var keyIndex = this.$substates.indexOf(from_name);
		if(keyIndex >= 0) {
			var substate = this.$substates.get(from_name);
			cjs.wait();
			this.$substates	.wait()
							.remove(from_name)
							.put(to_name, substate, keyIndex)
							.signal();
			cjs.signal();
			this._emit("rename_substate", {
				state: substate,
				from: from_name,
				to: to_name
			});
		}
	};
	proto.move_substate = function(state_name, index) {
		this.$substates.move(state_name, index);
		this._emit("move_substate", {
			state_name: state_name,
			index: index
		});
	};
	proto.add_state = function(state_name, state, index) {
		if(this.find_state(state_name)) {
			throw new Error("State with name '" + state_name + "' already exists.");
		}
		this.find_state(state_name, true, state, index);
		return this;
	};
	proto.remove_state = function(state_name, also_destroy) {
		var state = this.find_state(state_name);
		if(!_.isUndefined(state)) {
			var parent = state.parent();
			if(!_.isUndefined(parent)) {
				parent.remove_substate(state, also_destroy);
			}
		}
		return this;
	};
	proto.rename_state = function(from_name, to_name) {
		var from_state = this.find_state(from_name);
		if(from_state) {
			var from_state_parent = from_state.parent();
			if(parent) {
				var to_name_arr = to_name.split(".");
				var to_state_parent = this.find_state(_.initial(to_name_arr), true);
				var to_state_name = _.last(to_name_arr);
				if(from_state_parent === to_state_parent) {
					var from_name_arr = from_name.split(".");
					var from_state_name = _.last(from_name_arr);
					from_state_parent.rename_substate(from_state_name, to_state_name);
				} else {
					cjs.wait();
					from_state_parent.remove_state(from_state, false);
					to_state_parent.add_state(to_state_name, from_state);
					cjs.signal();
				}
			}
		}
		return this;
	};
	proto.move_state = function(state_name, index) {
		var state = this.find_state(state_name);
		if(state) {
			var parent = state.parent();
			if(parent) {
				var state_name = parent.get_name_for_substate(state);
				parent.move_substate(state_name, index);
			}
		}
		return this;
	};
	proto.destroy = function() {
		this._emit("destroy", {
			target: this
		});

		cjs.wait();
		_.forEach(this.get_incoming_transitions(), function(transition) {
			transition.remove().destroy();
		});
		_.forEach(this.get_outgoing_transitions(), function(transition) {
			transition.remove().destroy();
		});
		_.forEach(this.get_substates(), function(substate) {
			substate.destroy();
		});
		this.$substates.destroy();
		this.$local_state.destroy();
		this.$concurrent.destroy();
		this.$incoming_transitions.destroy();
		this.$outgoing_transitions.destroy();
		this.get_start_state().destroy();
		cjs.signal();
	};
	proto.get_substate_names = function() {
		return this.$substates.keys();
	};
	proto.is = function(state) {
		state = this.find_state(state);
		if(state) {
			var to_check_lineage = state.get_lineage(this);
			if(to_check_lineage[0] !== this) { //It has a different root
				return false;
			} else {
				var len = to_check_lineage.length-1;
				for(var i = 0; i<len; i++) {
					var s = to_check_lineage[i];
					if(!s.is_concurrent() && s.get_active_substate() !== to_check_lineage[i+1] ) {
						return false;
					}
				}
				return true;
			}
		} else {
			return false;
		}
	};
	proto.contains = function(state, direct) {
		direct = direct !== false;
		var state = this.find_state(state);
		if(this === state) { return true; }
		else {
			var substates = this.get_substates(true);
			return _.any(substates, function(substate) {
				return substate.contains(state);
			});
		}
	};
	proto.add_transition = function(arg0, arg1, arg2) {
		var from_state, to_state, transition;
		if(arguments.length === 1) {
			if(arg0 instanceof StatechartTransition) {
				transition = arg0;
				from_state = transition.from();
				to_state = transition.to();
			}
		} else {
			from_state = this.find_state(arg0);
			if(!from_state) { throw new Error("No state '" + arg0 + "'"); }
			to_state = this.find_state(arg1);
			if(!to_state) { throw new Error("No state '" + arg1 + "'"); }
			var event = arg2;
			transition = new StatechartTransition({from: from_state, to: to_state, event: event});
			this._last_transition  = transition;
		}
		from_state._add_direct_outgoing_transition(transition);
		to_state._add_direct_incoming_transition(transition);

		this.emit("add_transition", {
			target: this,
			transition: transition
		});

		return this;
	};
	proto.get_transitions_to = function(to) {
		return this.$outgoing_transitions.filter(function(transition) {
			return transition.to() === to;
		});
	};
	proto.get_transitions_from = function(from) {
		return this.$incoming_transitions.filter(function(transition) {
			return transition.from() === from;
		});
	};
	proto._add_direct_outgoing_transition = function(transition, index) {
		if(_.isNumber(index)) {
			this.$outgoing_transitions.splice(index, 0, transition);
		} else {
			this.$outgoing_transitions.push(transition);
		}
	};
	proto._add_direct_incoming_transition = function(transition, index) {
		if(_.isNumber(index)) {
			this.$incoming_transitions.splice(index, 0, transition);
		} else {
			this.$incoming_transitions.push(transition);
		}
	};
	proto._remove_direct_outgoing_transition = function(transition) {
		var index = this.$outgoing_transitions.indexOf(transition);
		if(index >= 0) {
			this.$outgoing_transitions.splice(index, 1);
		}
	};
	proto._remove_direct_incoming_transition = function(transition) {
		var index = this.$incoming_transitions.indexOf(transition);
		if(index >= 0) {
			this.$incoming_transitions.splice(index, 1);
		}
	};
	proto.starts_at = function(state) {
		var start_at_state = this.find_state(state, false);
		var start_state = this.get_start_state();
		start_state.setTo(start_at_state);
		if(this.is_running() && this.get_active_substate() === start_state) {
			this.set_active_substate(start_at_state);
		}
		return this;
	};

	proto.create_shadow = function(options) {
		return new Statechart(_.extend({
			basis: this
		}, options));
	};
	/*

	proto.find_substate_with_basis = function(state) {
		var substates = this.get_substates(true);
		for(var i = 0; i<substates.length; i++) {
			var substate = substates[i];
			if(substate.is_based_on(state)) { return substate; }
		}
	};
	proto.find_state_with_basis = function(state) {
		var parent = this;
		while(parent) {
			var s = parent.find_substate_with_basis(state);
			if(s != null) { return s; }
			parent = parent.parent();
		}
	};
	proto.create_shadow = function(context) {
		var create_transition_shadow = _.memoize(function(transition) {
			var to = shadow.find_state_with_basis(transition.to());
			var from = shadow.find_state_with_basis(transition.from());
			var parent_statechart = shadow;
			return transition.create_shadow(from, to, parent_statechart, context);
		}, function(transition) {
			return transition.id();
		});
		var create_substate_shadow = _.memoize(function(substate, shadow_transitions) {
			cjs.wait();
			var substate_shadow = substate.shadow_substates(context, create_substate_shadow, create_transition_shadow);
			if(shadow_transitions) { substate_shadow.shadow_transitions(create_transition_shadow); }
			cjs.signal();
			return substate_shadow;
		}, function(substate) {
			return substate.id();
		});
		cjs.wait();
		var shadow = this.shadow_substates(context, create_substate_shadow, create_transition_shadow);
		shadow.shadow_transitions(create_transition_shadow);
		cjs.signal();
		return shadow;
	};

	proto.shadow_substates = function(context, create_substate_shadow, create_transition_shadow) {
		cjs.wait();
		var shadow = red.create("statechart", {}, false);
		var my_start_state = this.get_start_state();
		var shadow_start_state = my_start_state.create_shadow(shadow, context);
		shadow.do_initialize({
			basis: this,
			start_state: shadow_start_state
		});
		this.$substates.each(function(val, key, i) {
			var shadow_val = create_substate_shadow(val, false);
			shadow.add_state(key, shadow_val, i);
		});

		var my_start_state_to = my_start_state.getTo();
		if(my_start_state_to !== my_start_state) {
			shadow_start_state.setTo(create_substate_shadow(my_start_state_to, true));
		}

		this.on("--starts_at--", function(state) {
			var shadow_state = create_substate_shadow(state, true);
			shadow.starts_at(shadow_state);
		});

		this.$substates.onPut(function(state, name, index) {
			var shadow_val = create_substate_shadow(state, true); shadow.add_state(name, shadow_val, index);
		});
		this.$substates.onRemove(function(state, name, index) {
			shadow.remove_state(name);
		});
		this.$substates.onValueChange(function(new_val, key, old_val, index) {
			var shadow_val = new_val.create_shadow(context, create_substate_shadow, create_transition_shadow);
			shadow.add_state(shadow_val, name, index);
		});
		this.$substates.onMove(function(value, key, to_index, from_index) {
			shadow.move_state(key, to_index);
		});

		cjs.signal();
		return shadow;
	};

	proto.shadow_transitions = function(create_transition_shadow) {
		var shadow = this;
		var basis = shadow.basis();
		var shadow_incoming = _.map(basis.$incoming_transitions.toArray(), function(transition) {
			var shadow_transition = create_transition_shadow(transition);
			shadow_transition.setTo(shadow);
			return shadow_transition;
		});
		basis.$incoming_transitions.onRemove(function(transition, index) {
			var shadow_transition = shadow_incoming[index];
			shadow_incoming.splice(index, 1);
			shadow_transition.setTo(shadow);
			shadow_transition.remove();
		});
		basis.$incoming_transitions.onAdd(function(transition, index) {
			var shadow_transition = create_transition_shadow(transition);
			shadow_incoming.splice(index, 0, shadow_transition);
			shadow._add_direct_incoming_transition(shadow_transition);
		});
		var shadow_outgoing = _.map(basis.$outgoing_transitions.toArray(), function(transition) {
			var shadow_transition = create_transition_shadow(transition);
			shadow_transition.setFrom(shadow);
			shadow._add_direct_outgoing_transition(shadow_transition);
			return shadow_transition;
		});
		basis.$outgoing_transitions.onRemove(function(transition, index) {
			var shadow_transition = shadow_outgoing[index];
			shadow_outgoing.splice(index, 1);
			shadow_transition.setFrom(shadow);
			//shadow_transition.remove(); already removed by incoming
		});
		basis.$outgoing_transitions.onAdd(function(transition, index) {
			var shadow_transition = create_transition_shadow(transition);
			shadow_outgoing.splice(index, 0, shadow_transition);
			shadow._add_direct_outgoing_transition(shadow_transition);
		});

		_.forEach(shadow.get_substates(), function(shadow_substate) {
			shadow_substate.shadow_transitions(create_transition_shadow);
		});
	};
	*/
	proto.get_transitions = function() {
		return (this.get_incoming_transitions()).concat(this.get_outgoing_transitions());
	};

	proto.get_substate_transitions = function() {
		var my_transitions = this.get_transitions();
		return _.uniq(
			_.flatten(
				my_transitions.concat(_.map(this.get_substates(), function(substate) {
					return substate.get_substate_transitions();
				})),
				true
			)
		);
	};

	proto.serialize = function() {
		return {
			substates: red.serialize(this.$substates)
			, concurrent: this.is_concurrent()
			, start_state: red.serialize(this.get_start_state())
			, outgoing_transitions: red.serialize(this.$outgoing_transitions.get())
			, incoming_transitions: red.serialize(this.$incoming_transitions.get())
			, parent: red.serialize(this.parent())
		};
	};
	my.deserialize = function(obj) {
		var rv = new Statechart(undefined, true);
		rv.initialize = function() {
			var options = {
				substates: red.deserialize(obj.substates)
				, concurrent: obj.concurrent
				, start_state: red.deserialize(obj.start_state)
				, outgoing_transitions: red.deserialize(obj.outgoing_transitions)
				, incoming_transitions: red.deserialize(obj.incoming_transitions)
				, parent: red.deserialize(obj.parent)
			};
			this.do_initialize(options);
		};

		return rv;
	};
}(Statechart));
red.Statechart = Statechart;

red.define("statechart", function(options) {
	return new Statechart(options);
});
red.is_statechart = function(obj) {
	return obj instanceof Statechart;
};

}(red));
