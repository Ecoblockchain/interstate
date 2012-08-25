(function(red) {
var cjs = red.cjs, _ = cjs._;

// === SET ===

var SetPropCommand = function(options) {
	SetPropCommand.superclass.constructor.apply(this, arguments);
	this._options = options || {};

	if(!_.has(this._options, "parent")) {
		throw new Error("Must select a parent object");
	}

	this._parent = this._options.parent;
	this._prop_name = this._options.name;
	this._prop_value = this._options.value;
	this._prop_index = this._options.index;
};

(function(my) {
	_.proto_extend(my, red.Command);
	var proto = my.prototype;

	proto._execute = function() {
		var index = undefined;
		if(_.isNumber(this._prop_index)) {
			index = this._prop_index;
		}
		this._old_prop_value = this._parent.get_prop(this._prop_name);

		this._parent.set_prop(this._prop_name, this._prop_value, index);
	};
	proto._unexecute = function() {
		if(!_.isUndefined(this._old_prop_value)) {
			this._parent.set_prop(this._prop_name, this._old_prop_value);
		} else {
			this._parent.unset_prop(this._prop_name);
		}
	};
	proto._do_destroy = function(in_effect) {
		if(in_effect) {
			if(this._old_prop_value) {
				this._old_prop_value.destroy();
			}
		} else {
			if(this._prop_value) {
				this._prop_value.destroy();
			}
		}
	};
}(SetPropCommand));

red._commands["set_prop"] = function(options) {
	return new SetPropCommand(options);
};

// === REMOVE ===

var UnsetPropCommand = function(options) {
	UnsetPropCommand.superclass.constructor.apply(this, arguments);
	this._options = options || {};

	if(!_.has(this._options, "parent")) {
		throw new Error("Must select a parent object");
	}

	this._parent = this._options.parent;
	this._prop_name = this._options.name;
};
(function(my) {
	_.proto_extend(my, red.Command);
	var proto = my.prototype;

	proto._execute = function() {
		this._prop_index = this._parent.prop_index(this._prop_name);
		this._prop_value = this._parent.get_prop(this._prop_name);
		this._parent.unset_prop(this._prop_name);
	};
	proto._unexecute = function() {
		if(!_.isUndefined(this._prop_value)) {
			this._parent.set_prop(this._prop_name, this._prop_value, this._prop_index);
		}
	};
	proto._do_destroy = function(in_effect) {
		if(in_effect) {
			if(this._old_prop_value) {
				this._old_prop_value.destroy();
			}
		} else {
			if(this._prop_value) {
				this._prop_value.destroy();
			}
		}
	};
}(UnsetPropCommand));

red._commands["unset_prop"] = function(options) {
	return new UnsetPropCommand(options);
};

// === RENAME ===

var RenamePropCommand = function(options) {
	RenamePropCommand.superclass.constructor.apply(this, arguments);
	this._options = options || {};

	if(!_.has(this._options, "parent")) {
		throw new Error("Must select a parent object");
	}

	this._parent = this._options.parent;
	this._from_name = this._options.from;
	this._to_name = this._options.to;
};
(function(my) {
	_.proto_extend(my, red.Command);
	var proto = my.prototype;

	proto._execute = function() {
		this._prop_value = this._parent.get_prop(this._to_name);
		if(this._prop_value) {
			this._parent.unset(this._to_name);
		}
		this._parent.rename(this._from_name, this._to_name);
	};
	proto._unexecute = function() {
		this._parent.rename(this._to_name, this._from_name);
		if(!_.isUndefined(this._prop_value)) {
			this._parent.set_prop(this._from_name, this._prop_value);
		}
	};
	proto._do_destroy = function(in_effect) {
		if(in_effect) {
			if(this._prop_value) {
				this._prop_value.destroy();
			}
		}
	};
}(RenamePropCommand));

red._commands["rename_prop"] = function(options) {
	return new RenamePropCommand(options);
};

// === MOVE ===

var MovePropCommand = function(options) {
	MovePropCommand.superclass.constructor.apply(this, arguments);
	this._options = options || {};

	if(!_.has(this._options, "parent")) {
		throw new Error("Must select a parent object");
	}

	this._parent = this._options.parent;
	this._prop_name = this._options.name;
	this._to_index = this._options.to;
};
(function(my) {
	_.proto_extend(my, red.Command);
	var proto = my.prototype;

	proto._execute = function() {
		this._from_index = this._parent.prop_index(this._prop_name);
		this._parent.move_prop(this._prop_name, this._to_index);
	};
	proto._unexecute = function() {
		this._parent.move_prop(this._prop_name, this._from_index);
	};
	proto._do_destroy = function(in_effect) { };
}(MovePropCommand));

red._commands["move_prop"] = function(options) {
	return new MovePropCommand(options);
};
/*

// === STATEFUL PROPS ===

var SetStatefulPropValueCommand = function(options) {
	SetStatefulPropValueCommand.superclass.constructor.apply(this, arguments);
	this._options = options || {};

	if(!_.has(this._options, "stateful_prop")) {
		throw new Error("Must select a stateful_prop object");
	}

	this._stateful_prop = this._options.stateful_prop;
	this._state = this._options.state;
	this._value = this._options.value;
};
(function(my) {
	_.proto_extend(my, red.Command);
	var proto = my.prototype;

	proto._execute = function() {
		this._stateful_prop.set_value(this._state, this._value);
	};
	proto._unexecute = function() {
		this._stateful_prop.unset_value(this._state);
	};
	proto._do_destroy = function(in_effect) {
		if(!in_effect) {
			if(this._value && this._value.destroy) {
				this._value.destroy;
			}
		}
	};
}(SetStatefulPropValueCommand));

red._commands["set_stateful_prop_value"] = function(options) {
	return new SetStatefulPropValueCommand(options);
};

var UnsetStatefulPropValueCommand = function(options) {
	UnsetStatefulPropValueCommand.superclass.constructor.apply(this, arguments);
	this._options = options || {};

	if(!_.has(this._options, "stateful_prop")) {
		throw new Error("Must select a stateful_prop object");
	}

	this._stateful_prop = this._options.stateful_prop;
	this._state = this._options.state;
};
(function(my) {
	_.proto_extend(my, red.Command);
	var proto = my.prototype;

	proto._execute = function() {
		this._value = this._stateful_prop.get_value(this._state);
		this._stateful_prop.unset_value(this._state);
	};
	proto._unexecute = function() {
		this._stateful_prop.set_value(this._state, this._value);
	};
	proto._do_destroy = function(in_effect) {
		if(in_effect) {
			if(this._value && this._value.destroy) {
				this._value.destroy;
			}
		}
	};
}(UnsetStatefulPropValueCommand));

red._commands["unset_stateful_prop_value"] = function(options) {
	return new UnsetStatefulPropValueCommand(options);
};

*/
}(red));
