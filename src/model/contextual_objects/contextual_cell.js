/*jslint nomen: true, vars: true */
/*global interstate,esprima,able,uid,console */

(function (ist) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._;

	ist.ContextualCell = function (options) {
		ist.ContextualCell.superclass.constructor.apply(this, arguments);
		this._errors = new cjs.Constraint([]);
		this._type = "cell";
		//if(this.id() == "402") {
			//debugger;
		//}
	};

	(function (My) {
		_.proto_extend(My, ist.ContextualObject);
		var proto = My.prototype;
		proto.initialize = function(options) {
			My.superclass.initialize.apply(this, arguments);
			//if(this.id() == "402") {
				//debugger;
			//}
			this.value_constraint = this.object.constraint_in_context(this.get_pointer());
		};
		proto.destroy = function () {
			//if(this.id() == "402" || this.id() == 260) {
				//debugger;
			//}
			if(this.constructor === My) { this.emit_begin_destroy(); }
			this.value_constraint.destroy(true);
			delete this.value_constraint;
			this.object.remove_constraint_in_context(this.get_pointer());
			My.superclass.destroy.apply(this, arguments);
		};
		proto._getter = function () {
			var value;
			if(ist.__debug) {
				value = cjs.get(this.value_constraint);
			} else {
				try {
					value = cjs.get(this.value_constraint);
				} catch (e) {
					console.error(e);
				}
			}
			return value;
		};
		proto.get_str = function () {
			var cell = this.get_object();
			return cell.get_str();
		};
		proto.get_syntax_errors = function() {
			var cell = this.get_object();
			return cell.get_syntax_errors();
		};
	}(ist.ContextualCell));
}(interstate));
