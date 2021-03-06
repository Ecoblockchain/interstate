/*jslint nomen: true, vars: true */
/*global interstate,esprima,able,uid,console */

(function (ist) {
    "use strict";
    var cjs = ist.cjs,
        _ = ist._;
    
    ist.StatefulObj = function (options, defer_initialization) {
        ist.StatefulObj.superclass.constructor.apply(this, arguments);
        this.type = "ist_stateful_obj";
    };
    (function (My) {
        _.proto_extend(My, ist.Dict);
        var proto = My.prototype;
    
        proto.initialize = function (options) {
            My.superclass.initialize.apply(this, arguments);
            ist.install_instance_builtins(this, options, My);
        };
    
        My.builtins = {
            "direct_statechart": {
                "default": function () { return new ist.Statechart(); },
                getter_name: "get_own_statechart",
                settable: false,
				destroy: function(me) {
					me.destroy(true);
				}
            }
        };
        ist.install_proto_builtins(proto, My.builtins);

		_.each(["add_state", "add_transition", "starts_at", "find_state"], function(fn_name) {
			proto[fn_name] = function() {
				var statechart = this.get_own_statechart(), rv;
				rv = statechart[fn_name].apply(statechart, arguments);
				if(fn_name === "find_state") {
					return rv;
				} else {
					return this;
				}
			};
		});

        proto.destroy = function () {
			if(this.constructor === My) { this.begin_destroy(); }
            My.superclass.destroy.apply(this, arguments);
			ist.unset_instance_builtins(this, My);
        };

        ist.register_serializable_type("stateful_obj",
            function (x) {
                return x instanceof My;
            },
            My.superclass.serialize,
            function (obj) {
                var rest_args = _.rest(arguments);
                var builtins = _.extend({}, My.builtins, My.superclass.constructor.builtins);

                var serialized_options = {};
                _.each(builtins, function (builtin, name) {
                    serialized_options[name] = obj[name];
                });

                var rv = new My({uid: obj.uid}, true),
					old_initialize = proto.initialize;
                rv.initialize = function () {
                    var options = {};
                    _.each(serialized_options, function (serialized_option, name) {
                        options[name] = ist.deserialize.apply(ist, ([serialized_option]).concat(rest_args));
                    });
					old_initialize.call(this, options);
                };

                return rv;
            });
    }(ist.StatefulObj));
}(interstate));
