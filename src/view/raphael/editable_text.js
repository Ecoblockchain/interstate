(function(red) {
var cjs = red.cjs, _ = red._;

var match_styles = function(textbox, text) {
	textbox.style.position = "absolute";
	var anchor = text.attr("text-anchor");
	if(anchor === "start") {
		textbox.style.textAlign = "left";
	} else if(anchor === "middle") {
		textbox.style.textAlign = "center";
	} else {
		textbox.style.textAlign = "right";
	}
	textbox.style.fontFamily = text.attr("font-family");
	textbox.style.fontWeight = text.attr("font-weight");
	textbox.style.fontStyle = text.attr("font-style");
	textbox.style.fontSize = text.attr("font-size")+"px";
	var box = text.getBBox();
	textbox.style.top = box.y + "px";
	textbox.style.outline = "none";
	textbox.style.border = "1px solid black";
	textbox.style.padding = "0px";
	textbox.style.margin = "0px";
	textbox.style.boxSizing = "border-box";
	textbox.style.background = "none";
};

var EditableText = function(paper, options) {
	red.make_this_listenable(this);
	this.options = _.extend({
		x: 0
		, y: 0
		, text: ""
		, width: 100
		, "text-anchor": "start"
		, animation_duration: 600
		, default: ""
		, font: ""
		, "font-family": "Courier New, Courier"
		, "font-size": 14
		, "font-weight": "normal"
		, color: "#000000"
		, default_color: "#AAAAAA"
	}, options);

	this.text = paper	.text(this.option("x"), this.option("y"), this.get_text())
						.attr({
							font: this.option("font")
							, "font-family": this.option("font-family")
							, "font-size": this.option("font-size")
							, "font-weight": this.option("font-weight")
							, "text-anchor": this.option("text-anchor")
						});

	if(this.show_default()) {
		this.text.attr("fill", this.option("default_color"))
	} else {
		this.text.attr("fill", this.option("color"))
	}

	this.$onClick = _.bind(this.onClick, this);
	this.$onKeydown = _.bind(this.onKeydown, this);
	this.$onBlur = _.bind(this.onBlur, this);

	this.text.click(this.$onClick);
	this.paper = paper;
};
(function(my) {
	var proto = my.prototype;
	red.make_proto_listenable(proto);
	proto.show_default = function() {
		return this.option("text") === "";
	};
	proto.get_text = function() {
		if(this.show_default()) {
			return this.option("default");
		} else {
			return this.option("text");
		}
	};
	proto.onClick = function(event) {
		this.edit();
	};
	proto.edit = function() {
		var textbox = document.createElement("input");
		textbox.type = "text"
		textbox.style.zIndex = 2;

		var anchor = this.text.attr("text-anchor");
		if(anchor === "start") {
			textbox.style.left = this.option("x") + "px";
		} else if(anchor === "middle") {
			textbox.style.left = (this.option("x") - this.option("width")/2) + "px";
		} else {
			textbox.style.left = (this.option("x") - this.option("width")) + "px";
		}

		textbox.style.width = this.option("width") + "px";
		match_styles(textbox, this.text);
		this.paper.canvas.parentNode.insertBefore(textbox, this.paper.canvas);
		textbox.value = this.option("text");
		textbox.style.color = this.option("color");
		textbox.focus();
		textbox.select();

		this.text.hide();
		textbox.addEventListener("keydown", this.$onKeydown);
		textbox.addEventListener("blur", this.$onBlur);
	};
	proto.getBBox = function() {
		return this.text.getBBox();
	};
	proto.onKeydown = function(event) {
		var textbox = event.srcElement;
		if(event.keyCode === 27) { //esc
			this.showText(textbox);
		} else if(event.keyCode === 13) { // enter
			this.onTextChange(textbox.value);
			this.showText(textbox);
		}
	};
	proto.onTextChange = function(value) {
		this.option("text", value);
		this.text.attr("text", this.get_text());
		if(this.show_default()) {
			this.text.attr("fill", this.option("default_color"))
		} else {
			this.text.attr("fill", this.option("color"))
		}
		this._emit("change", {
			value: value
			, target: this
		});
	};
	proto.onBlur = function(event) {
		var textbox = event.srcElement;
		this.onTextChange(textbox.value);
		this.showText(textbox);
	};
	proto.showText = function(textbox) {
		this.text.show();
		textbox.removeEventListener("keydown", this.$onKeydown);
		textbox.removeEventListener("blur", this.$onBlur);
		textbox.parentNode.removeChild(textbox);
	};
	proto.option = function(key, value, animated) {
		if(arguments.length <= 1) {
			if(_.isString(key)) {
				return this.options[key];
			} else {
				_.each(key, function(v, k) {
					this.options[k] = v;
				}, this);
			}
		} else {
			this.options[key] = value;
		}
		this.text.attr({
			x: this.option("x")
			, y: this.option("y")
			, width: this.option("width")
			, font: this.option("font")
			, "font-family": this.option("font-family")
			, "font-size": this.option("font-size")
			, "font-weight": this.option("font-weight")
			, "text-anchor": this.option("text-anchor")
		});
	};
	proto.remove = function() {
		this.text.remove();
	};
}(EditableText));
red.define("editable_text", function(a, b) { return new EditableText(a,b); });
}(red));
