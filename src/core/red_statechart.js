(function(red) {
var jsep = red.jsep, cjs = red.cjs, _ = cjs._;

var RedStatechartTransition = function(statechart, from_state, to_state, event) {
	this._statechart = statechart;
	this._from_state = from_state;
	this._to_state = to_state;
	this.do_run = _.bind(this.run, this);
	this._event = event;

	this._event.on_fire(this.do_run);
};

(function(my) {
	var proto = my.prototype;
	proto.run = function(event) {
		var statechart = this._statechart;
		if(statechart.is(this.from())) {
			statechart.set_state(this.to(), event);
		}
	};
	proto.involves = function(state) {
		return this.from() === state || this.to() === state;
	};
	proto.destroy = function() {
		this._event.off_fire(this.do_run);
		this._event.destroy();
	};
	proto.from = function() { return this._from_state; }; 
	proto.to = function() { return this._to_state; };
	proto.get_event = function() { return this._event; };
}(RedStatechartTransition));

var RedStatechart = function(type) {
	this._running = false;
	this.transitions = [];
	this._states = red._create_map();
	
	this._starts_at = undefined;
	this._parent = undefined;
	this._concurrent = false;
	this._active_state = undefined;
	this._listeners = {};
	this._type = _.isUndefined(type) ? "statechart" : type;
	if(this.get_type() !== "pre_init") {
		this.add_state("_pre_init", "pre_init");
		this._active_state = this.get_state_with_name("_pre_init");
	}
};
(function(my) {
	var proto = my.prototype;
	proto.get_type = function() {
		return this._type;
	};
	proto.add_state = function(state_name, type) {
		var state;
		if(type instanceof RedStatechart) {
			state = type;
		} else {
			state = new RedStatechart(type);
		}
		state.set_parent(this);
		this._states.set(state_name, state);
		return this;
	};
	proto.remove_state = function(state) {
		var transitions_involving_state = [];
		var transitions_not_involving_state = [];
		_.forEach(this.transitions, function(transition) {
			if(transition.involves(state)) {
				transitions_involving_state.push(transition);
			} else {
				transitions_not_involving_state.push(transition);
			}
		});
		this.transitions = transitions_not_involving_state;
		this._states.unset(state);
		return this;
	};
	proto.in_state = function(state_name) {
		return this.get_state_with_name(state_name);
	};
	proto.starts_at = function(state_name) {
		var pre_init_state = this._find_state("_pre_init");
		this.add_transition(pre_init_state, state_name, red.create_event("init", this));
		return this;
	};
	proto.remove_transition = function(transition) {
		transition.destroy();
		this.transitions = _.without(this.transitions, transition);
		return this;
	};
	proto.get_initial_state = function() {
		return this.get_state_with_name(this._starts_at);
	};
	proto.up = proto.parent = function() {
		return this._parent;
	};
	proto.set_parent = function(parent) {
		this._parent = parent;
		return this;
	};
	proto.get_state_with_name = function(state_name) {
		return this._states.get(state_name);
	};
	proto.concurrent = function(is_concurrent) {
		this._concurrent = is_concurrent;
		return this;
	};
	proto.is_concurrent = function() {
		return this._concurrent;
	};
	proto._find_state = function(state) {
		if(_.isString(state)) {
			return this.get_state_with_name(state);
		} else {
			return state;
		}
	}
	proto.run = function() {
		this._running = true;
		if(this._concurrent) {
			this._states.forEach(function(state) {
				state.run();
			});
		} else {
			if(!_.isUndefined(this._active_state)) {
				this._active_state.run();
			}
		}
		var event = {
			type: "run"
			, timestamp: (new Date()).getTime()
			, target: this
		};
		this._notify("run", event);
		return this;
	};
	proto.is_running = function() {
		return this._running;
	};
	proto.get_state = function() {
		if(this._concurrent) {
			var active_states = this._states.map(function(state) {
				return state.get_state();
			}).to_obj();
			var rv = [];
			return rv.concat.apply(rv, active_states);
		} else {
			if(this.is_atomic()) {
				return [];
			}

			var active_state = this._active_state;
			if(active_state.get_type() === "pre_init") {
				return [active_state];
			} else {
				var rv = [active_state];
				return rv.concat(active_state.get_state());
			}
		}
	};
	proto.set_state = function(state, event) {
		var states_left = [];
		var states_entered = [];
		var curr_state = this._active_state;

		while(!_.isUndefined(curr_state) && curr_state !== this) {
			states_left.push(curr_state);
			curr_state = curr_state.parent();
		}

		curr_state = this._active_state;

		while(!_.isUndefined(curr_state) && curr_state !== this) {
			states_entered.push(curr_state);
			curr_state = curr_state.parent();
		}

		_.forEach(states_left, function(state) {
			state._notify("exit", event);
		});
		this._active_state = state;
		if(!this._active_state.is_running()) {
			this._active_state.run();
		}
		_.forEach(states_entered, function(state) {
			state._notify("enter", event);
		});

		return this;
	};
	proto.notify_parent = function(left_states, entered_states) {
		var parent = this.parent();
		if(_.isUndefined(parent)) {
		} else {
			this.notify_parent(left_states, entered_states);
		}
	};
	proto.is = function(state) {
		if(this === state) { return true; }

		if(this._concurrent) {
			return this._states.any(function(state) {
				return state.is(state);
			});
		} else {
			if(_.isUndefined(this._active_state)) {
				return false;
			} else {
				return this._active_state.is(state);
			}
		}
	};

	proto._get_transition = function() {
		var from_state, to_state, event;
		if(arguments.length >= 2) {
			from_state = this._find_state(arguments[0]);
			to_state = this._find_state(arguments[1]);
			event = arguments[2];
		} else {
			from_state = this;
			to_state = this._find_state(arguments[0]);
			event = arguments[1];
		}

		var transition = new RedStatechartTransition(this, from_state, to_state, event);
		this.transitions.push(transition);
		return transition;
	};

	proto.add_transition = function() {
		var from_state, to_state, event;
		if(arguments.length >=3)  {
			from_state = arguments[0];
			to_state = arguments[1];
			event = arguments[2];
		} else {
			from_state = this;
			to_state = arguments[0];
			event = arguments[1];
		}

		var transition = this._get_transition(from_state, to_state, event);
		
		return this;
	};
	proto.get_transitions = function() {
		return _.clone(this.transitions);
	};

	proto.name_for_state = function(state) {
		return this._states.key_for_value(state);
	};

	proto.my_name = function() {
		var parent = this.parent();
		if(_.isUndefined(parent)) {
			return undefined;
		}
		return parent.name_for_state(this);
	};

	proto.get_substates = function() {
		var state_names = this._states.get_keys();
		if(state_names.length === 1) {
			return [];
		} else {
			return state_names;
		}
	};

	proto.is_atomic = function() {
		return _.isEmpty(this.get_substates());
	};

	proto.clone = function(context, state_map) {
		if(_.isUndefined(state_map)) {
			state_map = red._create_map();
		}

		var new_statechart = new RedStatechart(this.get_type());
		state_map.set(this, new_statechart);
		var substates_names = this.get_substates();
		for(var i = 0; i<substates_names.length; i++) {
			var substate_name = substates_names[i];
			var substate = this.get_state_with_name(substate_name);
			new_statechart.add_state(substate.clone(context, state_map));
		}

		var transitions = this.get_transitions();
		for(var i = 0; i<transitions.length; i++) {
			var transition = transitions[i];
			var from = state_map.get(transition.from());
			console.log(transition.to());
			var to = state_map.get(transition.to());

			var event = transition.get_event().clone(this);

			new_statechart.add_transition(from, to, event);
		}
		
		return new_statechart;
	};


	proto._on = function(event_type, func) {
		var listeners;
		if(_.has(this._listeners, event_type)) {
			listeners = this._listeners[event_type];
		} else {
			this._listeners[event_type] = listeners = [];
		}
		listeners.push(func);
		return this;
	};
	proto._off = function(event_type, func) {
		var listeners = this._listeners[event_type];
		this._listeners[event_type] = _.without(this._listeners[event_type], func);
		if(_.isEmpty(this._listeners[event_type])) {
			delete this._listeners[event_type];
		}
		return this;
	};
	proto._once = function(event_type, func) {
		var self = this;
		var listener = function() {
			var rv = func.apply(this, arguments);
			self._off(event_type, func);
			return rv;
		};
		this._on(event_type, listener);
		return listener;
	};
	proto._notify = function(event_type, event) {
		var listeners = this._listeners[event_type];
		_.forEach(listeners, function(func) {
			func(event);
		});
		return this;
	};

	var bind = function(func) {
		var bind_args = _.toArray(_.rest(arguments));
		var rv = function() {
			var args = bind_args.concat(_.toArray(arguments));
			return func.apply(this, args);
		};
		return rv;
	};
	proto.on_enter = bind(proto._on, "enter");
	proto.off_enter = bind(proto._off, "enter");
	proto.once_enter = bind(proto._once, "enter");
	proto.on_exit = bind(proto._on, "exit");
	proto.off_exit = bind(proto._off, "exit");
	proto.once_exit = bind(proto._once, "exit");
}(RedStatechart));

red.create_statechart = function() {
	return new RedStatechart();
};

}(red));
