/*jslint nomen: true, vars: true, white: true */
/*jshint scripturl: true */
/*global red,esprima,able,uid,console,window,jQuery,Raphael */

(function (red, $) {
	"use strict";
	var cjs = red.cjs,
		_ = red._;

	var UNSET_RADIUS = 7;

	var on_cell_key_down = function(event) {
		var keyCode = event.keyCode;
		var prev, next, next_focusable, prev_focusable;
		if(this.element.is(event.target)) {
			if(keyCode === 79 || keyCode === 13) { // o or ENTER
				event.preventDefault();
				event.stopPropagation();
				if(this.element.hasClass("unset")) {
					this.element.trigger("click");
				} else {
					this.begin_editing();
				}
			} else if(keyCode === 39 || keyCode === 76) { // Right or o or k
				next_focusable = this.element.next(":focusable");
				if(next_focusable.length>0) {
					next_focusable.focus();
				} else {
					var prop = this.element.parents(":focusable").first();
					next = prop.next();
					if(next.length>0) {
						next.focus();
					} else {
						prop.focus();
					}
				}
			} else if(keyCode === 37 || keyCode === 72) { // Left
				prev_focusable = this.element.prev(":focusable");
				if(prev_focusable.length>0) {
					prev_focusable.focus();
				} else {
					this.element.parents(":focusable").first().focus();
				}
			} else if(keyCode === 40 || keyCode === 74) { //down or j
				var next_prop = this.element.parents(":focusable").first().next();
				next_focusable = $(":focusable", next_prop).eq(this.element.index());
				if(next_focusable.length>0) {
					next_focusable.focus();
				} else {
					next_prop.focus();
				}
			} else if(keyCode === 38 || keyCode === 75) { // up or k
				var prev_prop = this.element.parents(":focusable").first().prev();
				prev_focusable = $(":focusable", prev_prop).eq(this.element.index());
				if(prev_focusable.length>0) {
					prev_focusable.focus();
				} else {
					prev_prop.focus();
				}
			} else if(keyCode === 8) { //backspace
				if(this.element.hasClass("cell")) {
					this.unset();
				}
			}
		}
	};

	$.widget("red.prop_cell", {
		options: {
			value: false,
			left: 0,
			width: 0,
			edit_width: 100,
			active: false,
			parent: false
		},
		_create: function() {
			var client = this.option("value");
			client.signal_interest();

			this.update_position();
			this.update_active();
			this.create_live_text_fn();

			this.text = $("<span />")	.addClass("txt")
										.appendTo(this.element);
			this.element.on("keydown.prop_cell", _.bind(on_cell_key_down, this))
						.on("click.prop_cell", _.bind(this.on_click, this))
						.addClass("cell")
						.attr("tabindex", 1);
		},
		_destroy: function() {
			this._super();

			this.element.off("keydown.prop_cell click.prop_cell")
						.removeClass("cell");

			if(this.textbox) {
				this.textbox.off("keydown.prop_cell blur.prop_cell")
							.remove();
			}

			this.text.remove();
			this.destroy_live_text_fn();

			var client = this.option("value");

			client.signal_destroy();
			delete this.options;
		},
		on_click: function() {
			this.begin_editing();
		},
		create_live_text_fn: function() {
			var value = this.option("value");
			var is_err = false;
			if(value.type() === "raw_cell") {
				var $str = value.get_$("get_str");
				this.live_text_fn = cjs.liven(function() {
					var str = $str.get();
					this.str = str;
					try {
						esprima.parse(this.str);
						this.element.attr("title", "");
						this.element.removeClass("error");
					} catch(e) {
						this.element.attr("title", e.description);
						this.element.addClass("error");
					}
					if(str === "") {
						this.text.html("&nbsp;");
					} else {
						this.text.text(str);
					}
				}, {
					context: this,
					on_destroy: function() {
						$str.signal_destroy();
					}
				});
			}
		},
		destroy_live_text_fn: function() {
			if(this.live_text_fn) {
				this.live_text_fn.destroy();
				delete this.live_text_fn;
			}
		},
		update_position: function() {
			var left = this.option("left"),
				width = this.element.is(".editing") ? this.option("edit_width") : this.option("width");
			this.element.css({
				left: (left - width/2) + "px",
				width: width + "px"
			});
		},
		update_active: function() {
			if(this.option("active")) {
				this.element.addClass("active");
			} else {
				this.element.removeClass("active");
			}
		},
		begin_editing: function() {
			this.element.addClass("editing");
			this.element.off("click.prop_cell");
			this.text.hide();

			if(this.textbox) {
				this.textbox.show();
			} else {
				this.textbox = $("<textarea />")	.attr("type", "text")
													.appendTo(this.element)
													.on("keydown.prop_cell", _.bind(function(event) {
														if(event.keyCode === 27) {
															event.preventDefault();
															event.stopPropagation();
															this.end_edit(true);
														} else if(event.keyCode === 13 && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
															event.preventDefault();
															event.stopPropagation();
															this.end_edit();
														}
													}, this))
													.on("blur.prop_cell", _.bind(this.end_edit, this));
			}
			var width = this.option("edit_width"),
				left = this.option("left");
			this.element.css({
				left: (left - width/2) + "px",
				width: width + "px"
			});

			this.textbox.val(this.str);
			this.focus();
			this.select();
		},
		unset: function() {
			var event = new $.Event("command");
			event.command_type = "unset_stateful_prop_for_state";
			event.prop = this.option("prop");
			event.state = this.option("state");

			this.element.trigger(event);
		},
		end_edit: function(cancel) {
			this.element.on("click", _.bind(this.on_click, this));
			if(cancel !== true) {
				var val = this.textbox.val();
				if(val.trim() === "" && this.option("prop") && this.option("state")) {
					this.unset();
				} else {
					var event = new $.Event("command");
					event.command_type = "set_str";
					event.str = val;
					event.client = this.option("value");

					this.element.trigger(event);
				}
			}
			this.text.show();
			this.textbox.hide();
			this.element.focus();
			this.element.removeClass("editing");

			var width = this.option("width"),
				left = this.option("left");
			this.element.css({
				left: (left - width/2) + "px",
				width: width + "px"
			});
		},
		focus: function() {
			if(this.textbox) {
				this.textbox.focus();
			}
		},
		select: function() {
			if(this.textbox) {
				this.textbox.select();
			}
		},
		_setOption: function(key, value) {
			this._super(key, value);
			if(key === "left" || key === "width") {
				this.update_position();
			} else if(key === "active") {
				this.update_active();
			}
		}
	});

	$.widget("red.unset_prop", {
		options: {
			left: 0,
			radius: 7,
			state: null
		},
		_create: function() {
			this.element.addClass("unset")
						.attr("tabindex", 1)
						.on("keydown.unset", _.bind(on_cell_key_down, this));
			this.update_left();
		},
		_destroy: function() {
			this.element.removeClass("unset")
						.off("keydown.unset");
			delete this.options.state;
		},
		update_left: function() {
			this.element.css("left", (this.option("left") - this.option("radius")) + "px");
		},
		_setOption: function(key, value) {
			this._super(key, value);
			if(key === "left" || key === "radius") {
				this.update_left();
			}
		}
	});
}(red, jQuery));
