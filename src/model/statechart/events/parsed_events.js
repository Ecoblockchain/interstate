(function(red) {
var cjs = red.cjs, _ = red._;
var event_types = {};
var dom_events = ["click", "dblclick", "mousedown", "mouseup", "mouseover", "mousemove", "mouseout",
					"keydown", "keypress", "keyup", "load", "unload", "abort", "error", "resize",
					"scroll", "select", "change", "submit", "reset", "focus", "blur", "DOMFocusIn",
					"DOMFocusOut", "DOMActivate", "DOMSubtreeModified", "DOMNodeInserted", "DOMNodeRemoved",
					"DOMNodeRemovedFromDocument", "DOMNodeInsertedIntoDocument", "DOMAttrModified",
					"DOMCharacterDataModified", "cut", "copy", "paste", "beforecut", "beforecopy",
					"beforepaste", "afterupdate", "beforeupdate", "cellchange", "dataavailable",
					"datasetchanged", "datasetcomplete", "errorupdate", "rowenter", "rowexit", "rowsdelete",
					"rowinserted", "contextmenu", "drag", "dragstart", "dragenter", "dragover", "dragleave",
					"dragend", "drop", "selectstart", "help", "beforeunload", "stop", "beforeeditfocus",
					"start", "finish", "bounce", "beforeprint", "afterprint", "propertychange",
					"filterchange", "readystatechange", "losecapture", "touchstart", "touchend",
					"touchmove", "touchenter", "touchleave", "touchcancel"];
var esprima = window.esprima;

_.forEach(dom_events, function(dom_event) {
	event_types[dom_event] = function(parent) {
		var context = _.last(arguments);
		if(arguments.length === 0) {
			parent = window; // Ex: mouseup() <-> mouseup(window)
		}

		if(!(context instanceof red.RedContext)) {
			context = red.create("context");
		}


		if(parent) {
			var dom_elem;
			if(_.isElement(parent) || parent === window) {
				dom_elem = parent;
			} else if(parent instanceof red.RedDict) {
				var dom_attachment = parent.get_attachment_instance("dom", context);
				if(dom_attachment) {
					dom_elem = dom_attachment.get_dom_obj();
				}
			}

			if(dom_elem) {
				return red.create_event("dom_event", dom_event, dom_elem);
			}
		}
	};
});

var get_event = function(node, parent, context) {
	if(_.isUndefined(node)) { return undefined; }

	var type = node.type;
	if(type === "ExpressionStatement") {
		return get_event(node.expression, parent, context);
	} else if(type === "CallExpression") {
		var callee = get_event(node.callee, parent, context);
		var args = node.arguments;
		
		var args_got = _.map(args, function(arg) {
			var arg_val = get_event(arg, parent, context);
			return red.get_contextualizable(arg_val, context);
		});
		args_got.push(context);
		var callee_got = red.get_contextualizable(callee, context);
		return callee_got.apply(this, args_got);
	} else if(type === "Identifier") {
		var name = node.name;
		if(_.has(event_types, name)) {
			return event_types[name];
		} else if(name === "window") {
			return window;
		} else {
			//console.log("unfound", type, node, parent);
		}
	} else if(type === "ThisExpression") {
		return parent;
	} else if(type === "XXXXXXX") {
	} else {
		//console.log(type, node, parent);
	}
};

var id  = 0;
(function(proto) {
	proto.on_create = function(str, parent, context) {
		this.id = id++;
		this._parent = cjs(parent);

		this._str = cjs.is_constraint(str) ? str : cjs(str);
		var self = this;
		this._tree = cjs(function() {
			return esprima.parse(self.get_str());
		});

		this.$child_fired = _.bind(this.child_fired, this);

		this._old_event = null;
		this._live_event_creator = cjs.liven(function() {
			if(self._old_event) {
				self._old_event.off_fire(self.$child_fired);
				self._old_event.destroy();
			}

			var tree = self._tree.get();
			var parent = self.get_parent();
			cjs.wait();
			var event = get_event(tree.body[0], parent, context);
			cjs.signal();

			if(event) {
				event.on_fire(self.$child_fired);
				//console.log("re-constituted event", event);
			}

			self._old_event = event;
		});
	};
	proto.child_fired = function() {
		this.fire.apply(this, arguments);
	};
	proto.get_str = function() {
		return this._str.get();
	};
	proto.set_str = function(str) {
		this._str.set(str);
	};
	proto.get_parent = function() {
		return cjs.get(this._parent);
	};
	proto.set_parent = function(parent) {
		this._parent.set(parent);
	};
	proto.create_shadow = function(parent, context) {
		return red.create_event("parsed", this._str, parent, context);
	};
	proto.destroy = function() {
		this._live_event_creator.destroy();
	};
	proto.serialize = function(obj) {
		return { str: this.get_str() };
	};
	proto.deserialize = function(obj) {
		return red.create_event("parsed", obj.str);
	};
}(red._create_event_type("parsed").prototype));
}(red));