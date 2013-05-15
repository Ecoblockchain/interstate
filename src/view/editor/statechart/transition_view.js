/*jslint nomen: true, vars: true */
/*global red,esprima,able,uid,console,RedMap,jQuery,window */

(function (red, $) {
	"use strict";
	var cjs = red.cjs,
		_ = red._;

	var get_arrow_paths = function (from, to, self_pointing_theta, radius, arrowLength, arrowAngleRadians) {
		var fromX = from.x,
			fromY = from.y,
			toX = to.x,
			toY = to.y;

		var xDiff = toX - fromX,
			yDiff = toY - fromY;

		var line_path_str;
		var lineStartX, lineStartY, lineEndX, lineEndY, theta, arrow_theta;

		if (Math.pow(xDiff, 2) + Math.pow(yDiff, 2) <= Math.pow(radius + arrowLength, 2)) {
			var curve_radius = 2 * radius * radius + arrowLength + 2;

			theta = self_pointing_theta * Math.PI / 180;
			arrow_theta = theta - (90 * Math.PI / 180);

			lineStartX = fromX + radius * Math.cos(theta);
			lineStartY = fromY + radius * Math.sin(theta);
			lineEndX = (fromX + (radius + arrowLength) * Math.cos(theta));
			lineEndY = (fromY - (radius + arrowLength) * Math.sin(theta));

			line_path_str = "M" + lineStartX + "," + lineStartY +
							"C" + (fromX + curve_radius * Math.cos(theta)) +
							"," + (fromY + curve_radius * Math.sin(theta)) +
							"," + (fromX + (curve_radius + arrowLength) * Math.cos(theta)) +
							"," + (fromY - (curve_radius + arrowLength) * Math.sin(theta)) +
							"," + lineEndX +
							"," + lineEndY;

			toX = (toX + radius * Math.cos(theta));
			toY = (toY - radius * Math.sin(theta));
		} else {
			theta = arrow_theta = Math.atan2(yDiff, xDiff);
			lineStartX = fromX + Math.cos(theta) * radius;
			lineStartY = fromY + Math.sin(theta) * radius;
			lineEndX = toX - Math.cos(theta) * arrowLength;
			lineEndY = toY - Math.sin(theta) * arrowLength;

			line_path_str = "M" + lineStartX + "," + lineStartY + "L" + lineEndX + "," + lineEndY;
		}

		var off_line = arrowLength * Math.tan(arrowAngleRadians);
		var arrow_path = [
			{ x: toX, y: toY},
			{ x: lineEndX + off_line * Math.cos(arrow_theta - Math.PI / 2),
				y: lineEndY + off_line * Math.sin(arrow_theta - Math.PI / 2)
				},
			{ x: lineEndX + off_line * Math.cos(arrow_theta + Math.PI / 2),
				y: lineEndY + off_line * Math.sin(arrow_theta + Math.PI / 2)
				}
		];
		var arrow_path_str = "M" + _.map(arrow_path, function (point) {
			return point.x + "," + point.y;
		}).join("L") + "Z";

		return {
			line: { path: line_path_str },
			arrow: { path: arrow_path_str },
			circle: { cx: fromX, cy: fromY, r: radius }
		};
	};

	var center = function (p1, p2) {
		return { x: (p1.x + p2.x) / 2,
					y: (p1.y + p2.y) / 2 };
	};

	red.TransitionView = function (options) {
		able.make_this_listenable(this);
		able.make_this_optionable(this, {
			transition: null,
			paper: null,
			from: {x: 0, y: 0},
			to: {x: 0, y: 0},
			arrowLength: 8,
			radius: 1,
			arrowAngle: 20,
			self_pointing_theta: 40,
			color: "black",
			active_color: "red",
			text_background: "white",
			text_foreground: "black",
			font_family: "Sourse Sans Pro",
			font_size: "13px",
			padding_top: 0
		}, options);
		var paper = this.option("paper");
		var paths = this.get_paths();

		this.line_path = paper.path(paths.line.path);
		this.line_path.attr({
			stroke: this.option("color")
		});
		this.arrow_path = paper.path(paths.arrow.path);
		this.arrow_path.attr({
			fill: this.option("color"),
			stroke: "none"
		});
		this.circle = paper.circle(paths.circle.cx, paths.circle.cy, paths.circle.r);
		this.circle.attr({
			fill: this.option("color"),
			stroke: "none"
		});
		var transition = this.option("transition");
		var event = transition.event();
		var str = "";
		if (event instanceof red.ParsedEvent) {
			str = event.get_str();
		}
		var c = center(this.option("from"), this.option("to"));
		this.label = new red.EditableText(paper, {x: c.x, y: c.y + 8, text: str, fill: this.option("text_background"), color: this.option("text_foreground"), edit_on_click: false});
		this.label.option({
			"font-size": this.option("font_size"),
			"font-family": this.option("font_family")
		});
		
		this.$flash = _.bind(this.flash, this);
		transition.on("fire", this.$flash);
		this.label.on("change", this.forward);
		var from = this.option("from");

		if (event instanceof red.ParsedEvent) {
			event.on("setString", function (e) {
				var str = e.to;
				this.label.option("text", str);
			}, this);
			str = event.get_str();
		} else {
			str = "";
		}
		this.label.option("text", str);
	};

	(function (My) {
		var proto = My.prototype;
		able.make_proto_listenable(proto);
		able.make_proto_optionable(proto);
		proto._on_options_set = function (values) {
			var transition = this.option("transition");
			var paths = this.get_paths();
			this.line_path.attr("path", paths.line.path);
			this.arrow_path.attr("path", paths.arrow.path);
			var event = transition.event();
			var c = center(this.option("from"), this.option("to"));
			this.label.option({
				x: c.x,
				y: c.y + 8
			});
			this.circle.attr({
				cx: paths.circle.cx,
				cy: paths.circle.cy,
				r: paths.circle.r
			});
			this.update_dropdown_position();
		};

		proto.get_str = function() {
			var transition = this.option("transition");
			var event = transition.event();
			var str = "";
			if (event instanceof red.ParsedEvent) {
				str = event.get_str();
			} else {
				str = "(start)";
			}
			return str;
		};

		proto.get_paths = function () {
			var from = this.option("from"),
				to = this.option("to"),
				self_pointing_theta = this.option("self_pointing_theta"),
				radius = this.option("radius"),
				arrowLength = this.option("arrowLength"),
				arrowAngleRadians = this.option("arrowAngle") * Math.PI / 180;
			
			return get_arrow_paths(from, to, self_pointing_theta, radius, arrowLength, arrowAngleRadians);
		};

		proto.flash = function () {
			var paper = this.option("paper");
			var line_elem = this.line_path;
			var arrow = this.arrow_path;
			var len = line_elem.getTotalLength();

			var the_flash = paper.path(line_elem.getSubpath(0, 0));
			the_flash.attr({
				stroke: this.option("active_color"),
				"stroke-width": 3,
				guide: line_elem,
				along: [0, 0]
			});
			the_flash.animate({
				path: line_elem.getSubpath(0, len)
			}, 200, "ease-in", $.proxy(function () {
				the_flash.animate({
					path: line_elem.getSubpath(4 * len / 4.1, len)
				}, 200, "ease-out", function () {
					the_flash.remove();
				});
				arrow.attr({"fill": this.option("active_color")});
				window.setTimeout($.proxy(function () {
					arrow.animate({
						fill: this.option("color")
					}, 200, "ease-out");
				}, this), 200);
			}, this));
		};

		proto.begin_editing = function() {
			var paper = this.option("paper");
			var transition = this.option("transition");
			var parentElement = paper.canvas.parentNode;
			this.edit_event = $("<div />").addClass("menu_item")
											.text("Change event")
											.pressable()
											.on("pressed", $.proxy(function() {
												this.edit_dropdown.dropdown("collapse");
												this.begin_rename();
											}, this));
			this.change_from = $("<div />")	.addClass("menu_item")
												.text("Change from")
												.pressable()
												.on("pressed", $.proxy(function() {
													this.edit_dropdown.dropdown("collapse");
													var root = transition.root();
													var selectable_substates = _.rest(root.flatten_substates()); // the first element is the major statechart itself
													this._emit("awaiting_state_selection", {
														states: selectable_substates,
														on_select: $.proxy(function(from_state) {
															this._emit("set_from", {
																transition: transition,
																from: from_state
															});
														}, this)
													});
												}, this));
			this.change_to = $("<div />").addClass("menu_item")
											.text("Change to")
											.pressable()
											.on("pressed", $.proxy(function() {
												this.edit_dropdown.dropdown("collapse");
												var root = transition.root();
												var selectable_substates = _.rest(root.flatten_substates()); // the first element is the major statechart itself
												this._emit("awaiting_state_selection", {
													states: selectable_substates,
													on_select: $.proxy(function(to_state) {
														this._emit("set_to", {
															transition: transition,
															to: to_state
														});
													}, this)
												});
											}, this));
			this.edit_actions = $("<div />").addClass("menu_item")
											.text("Edit Actions")
											.pressable()
											.on("pressed", function() {
												console.log("edit actions");
											});
			this.remove_item = $("<div />")	.addClass("menu_item")
											.text("Remove")
											.pressable()
											.on("pressed", $.proxy(function() {
												this.edit_dropdown.dropdown("collapse");
												this._emit("remove_transition", {
													transition: this.option("transition")
												});
											}, this));
			var from = this.option("from"),
				to = this.option("to");
			var min_x = Math.min(from.x, to.x);
			var max_x = Math.max(from.x, to.x);
			var PADDING = 1;
			var HEIGHT = 10;
			var width = Math.max((max_x-min_x) - 2*PADDING, 100);
			var cx = (max_x + min_x)/2;
			var x = cx - width/2;
			var y = from.y;

			var items;
			if(transition.from() instanceof red.StartState) {
				items = [this.change_to/*, this.edit_actions*/];
			} else {
				items = [this.edit_event, this.change_from, this.change_to/*, this.edit_actions, this.remove_item*/];
			}

			this.edit_dropdown = $("<div />")	.dropdown({
													text: this.get_str(),
													items: items
												})
												.addClass("transition")
												.appendTo(parentElement)
												.css({
													position: "absolute",
													left: x + "px",
													top: y + "px",
													width: width + "px"
												});
			this.label.hide();
		};

		proto.update_dropdown_position = function() {
			if(this.edit_dropdown) {
				var from = this.option("from"),
					to = this.option("to");
				var min_x = Math.min(from.x, to.x);
				var max_x = Math.max(from.x, to.x);
				var PADDING = 1;
				var HEIGHT = 10;
				var width = Math.max((max_x-min_x) - 2*PADDING, 100);
				var cx = (max_x + min_x)/2;
				var x = cx - width/2;
				var y = from.y;

				this.edit_dropdown.dropdown("option", "text", this.get_str());
				this.edit_dropdown.css({
										position: "absolute",
										left: x + "px",
										top: y + "px",
										width: width + "px"
									});
			}
		};
		proto.begin_rename = function() {
			this.$on_cancel_rename = $.proxy(this.on_cancel_rename, this);
			this.$on_confirm_rename = $.proxy(this.on_confirm_rename, this);
			this.label	.show()
						.edit()
						.focus()
						.select()
						.on("cancel", this.$on_cancel_rename)
						.on("change", this.$on_confirm_rename);
			this.edit_dropdown.hide();
		};

		proto.on_cancel_rename = function(event) {
			this.end_rename();
		};

		proto.on_confirm_rename = function(event) {
			var value = event.value;
			this.end_rename();
			this._emit("set_str", {
				str: value,
				transition: this.option("transition")
			});
		};

		proto.end_rename = function() {
			this.edit_dropdown.show();
			this.label	.hide()
						.off("cancel", this.$on_cancel_rename)
						.off("change", this.$on_end_rename);
		};

		proto.done_editing = function() {
			this.edit_dropdown.dropdown("destroy").remove();
			delete this.edit_dropdown;
			this.label.show();
		};

		proto.remove = function () {
			this.label.remove();
			this.circle.remove();
			this.line_path.remove();
			this.arrow_path.remove();
			if(this.edit_dropdown) {
				this.edit_dropdown.remove();
				delete this.edit_dropdown;
			}
		};

		proto.destroy = function () {
			var transition = this.option("transition");
			transition.off("fire", this.$flash);
			if(this.edit_dropdown) {
				this.edit_dropdown.dropdown("destroy");
			}
		};
	}(red.TransitionView));
}(red, jQuery));