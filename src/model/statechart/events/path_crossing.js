/*jslint nomen: true, vars: true */
/*global interstate,esprima,able,uid,window,console */

(function (ist) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._;

	ist.CrossEvent = function () {
		ist.Event.apply(this, arguments);
		//this._initialize();
		this._type = "cross";
	};

	(function (My) {
		_.proto_extend(My, ist.Event);
		var proto = My.prototype;
		proto.on_create = function (path, min_velocity) {
			this.path = path;
			this.min_velocity = min_velocity;

			this._curr_path = null;
			this._crossing_path_listener_id = false;

			this.live_fn = cjs.liven(function () {
				this.remove_listener();
				var min_velocity = cjs.get(this.min_velocity);
				if(!_.isNumber(min_velocity)) { min_velocity = 0; }
				this._min_velocity = min_velocity;
				this._curr_path = cjs.get(this.path);
				this.add_listener();
			}, {
				context: this,
				run_on_create: false
			});
			this.live_fn.run(false);
		};
		proto.remove_listener = function() {
			if(this._crossing_path_listener_id) {
				removeCrossingPathListener(this._crossing_path_listener_id);
				this._crossing_path_listener_id = false;
			}
		};
		proto.add_listener = function() {
			this._crossing_path_listener_id = addCrossingPathListener(this._curr_path, function(velocity) {
				if(velocity >= this._min_velocity) {
					ist.event_queue.wait();
					this.fire();
					_.defer(function() {
						ist.event_queue.signal();
					});
				}
			}, this);
		};
		proto.enable = function () {
			if(!this.is_enabled()) {
				if(this.live_fn.resume()) {
					this.add_listener();
					this.live_fn.run();
				}
			}
			My.superclass.enable.apply(this, arguments);
		};
		proto.disable = function () {
			if(this.is_enabled()) {
				this.live_fn.pause();
				this.remove_listener();
			}
			My.superclass.disable.apply(this, arguments);
		};
		proto.destroy = function () {
			My.superclass.destroy.apply(this, arguments);
			if(this._crossing_path_listener_id) {
				removeCrossingPathListener(this._crossing_path_listener_id);
			}
		};
	}(ist.CrossEvent));


	var lowerCase = String.prototype.toLowerCase,
		upperCase = String.prototype.toUpperCase,
		isnan = {"NaN": 1, "Infinity": 1, "-Infinity": 1},
		pathCommand = /([achlmrqstvz])[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*)+)/ig,
		pathValues = /(-?\d*\.?\d*(?:e[\-+]?\d+)?)[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*/ig,
		l2c = function (x1, y1, x2, y2) {
			return [x1, y1, x2, y2, x2, y2];
		},
		q2c = function (x1, y1, ax, ay, x2, y2) {
			var _13 = 1 / 3,
				_23 = 2 / 3;
			return [
					_13 * x1 + _23 * ax,
					_13 * y1 + _23 * ay,
					_13 * x2 + _23 * ax,
					_13 * y2 + _23 * ay,
					x2,
					y2
				];
		},
		base3 = function(t, p1, p2, p3, p4) {
			var t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4,
				t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
			return t * t2 - 3 * p1 + 3 * p2;
		},
		bezlen = function(x1, y1, x2, y2, x3, y3, x4, y4, z) {
			if (z === undefined) {
				z = 1;
			}
			z = z > 1 ? 1 : z < 0 ? 0 : z;
			var z2 = z / 2,
				n = 12,
				Tvalues = [-0.1252,0.1252,-0.3678,0.3678,-0.5873,0.5873,-0.7699,0.7699,-0.9041,0.9041,-0.9816,0.9816],
				Cvalues = [0.2491,0.2491,0.2335,0.2335,0.2032,0.2032,0.1601,0.1601,0.1069,0.1069,0.0472,0.0472],
				sum = 0;
			for (var i = 0; i < n; i++) {
				var ct = z2 * Tvalues[i] + z2,
					xbase = base3(ct, x1, x2, x3, x4),
					ybase = base3(ct, y1, y2, y3, y4),
					comb = xbase * xbase + ybase * ybase;
				sum += Cvalues[i] * Math.sqrt(comb);
			}
			return z2 * sum;
		},
		a2c = function (x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
			// for more information of where this math came from visit:
			// http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
			var _120 = Math.PI * 120 / 180,
				rad = Math.PI / 180 * (+angle || 0),
				res = [],
				xy,
				rotate = cacher(function (x, y, rad) {
					var X = x * Math.cos(rad) - y * Math.sin(rad),
						Y = x * Math.sin(rad) + y * Math.cos(rad);
					return {x: X, y: Y};
				}), f1, f2, cx, cy;
			if (!recursive) {
				xy = rotate(x1, y1, -rad);
				x1 = xy.x;
				y1 = xy.y;
				xy = rotate(x2, y2, -rad);
				x2 = xy.x;
				y2 = xy.y;
				var cos = Math.cos(Math.PI / 180 * angle),
					sin = Math.sin(Math.PI / 180 * angle),
					x = (x1 - x2) / 2,
					y = (y1 - y2) / 2;
				var h = (x * x) / (rx * rx) +
							(y * y) / (ry * ry);
				if (h > 1) {
					h = Math.sqrt(h);
					rx = h * rx;
					ry = h * ry;
				}
				var rx2 = rx * rx,
					ry2 = ry * ry,
					k = (large_arc_flag == sweep_flag ? -1 : 1) *
						Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));
				cx = k * rx * y/ry + 0.5*(x1 + x2);
				cy = k * -ry * x/rx + 0.5*(y1 + y2);
				f1 = Math.asin(((y1 - cy) / ry).toFixed(9));
				f2 = Math.asin(((y2 - cy) / ry).toFixed(9));

				f1 = x1 < cx ? Math.PI - f1 : f1;
				f2 = x2 < cx ? Math.PI - f2 : f2;
				if(f1<0) {
					(f1 = Math.PI * 2 + f1);
				}
				if(f2<0) {
					(f2 = Math.PI * 2 + f2);
				}

				if (sweep_flag && f1 > f2) {
					f1 = f1 - Math.PI * 2;
				}
				if (!sweep_flag && f2 > f1) {
					f2 = f2 - Math.PI * 2;
				}
			} else {
				f1 = recursive[0];
				f2 = recursive[1];
				cx = recursive[2];
				cy = recursive[3];
			}
			var df = f2 - f1;
			if (Math.abs(df) > _120) {
				var f2old = f2,
					x2old = x2,
					y2old = y2;
				f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
				x2 = cx + rx * Math.cos(f2);
				y2 = cy + ry * Math.sin(f2);
				res = a2c(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy]);
			}
			df = f2 - f1;
			var c1 = Math.cos(f1),
				s1 = Math.sin(f1),
				c2 = Math.cos(f2),
				s2 = Math.sin(f2),
				t = Math.tan(df / 4),
				hx = 4 / 3 * rx * t,
				hy = 4 / 3 * ry * t,
				m1 = [x1, y1],
				m2 = [x1 + hx * s1, y1 - hy * c1],
				m3 = [x2 + hx * s2, y2 - hy * c2],
				m4 = [x2, y2];
			m2[0] = 2 * m1[0] - m2[0];
			m2[1] = 2 * m1[1] - m2[1];
			if (recursive) {
				return ([m2, m3, m4]).concat(res);
			} else {
				res = ([m2, m3, m4]).concat(res).join().split(",");
				var newres = [];
				for (var i = 0, ii = res.length; i < ii; i++) {
					newres[i] = i % 2 ? rotate(res[i - 1], res[i], rad).y : rotate(res[i], res[i + 1], rad).x;
				}
				return newres;
			}
		},
		bezierBBox = function (p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
			if (!r_is(p1x, "array")) {
				p1x = [p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y];
			}
			var bbox = curveDim.apply(null, p1x);
			return {
				x: bbox.min.x,
				y: bbox.min.y,
				x2: bbox.max.x,
				y2: bbox.max.y,
				width: bbox.max.x - bbox.min.x,
				height: bbox.max.y - bbox.min.y
			};
		},
		isPointInsideBBox = function (bbox, x, y) {
			return x >= bbox.x && x <= bbox.x2 && y >= bbox.y && y <= bbox.y2;
		},
		isBBoxIntersect = function (bbox1, bbox2) {
			var i = isPointInsideBBox;
			return i(bbox2, bbox1.x, bbox1.y) ||
					i(bbox2, bbox1.x2, bbox1.y) ||
					i(bbox2, bbox1.x, bbox1.y2) ||
					i(bbox2, bbox1.x2, bbox1.y2) ||
					i(bbox1, bbox2.x, bbox2.y) ||
					i(bbox1, bbox2.x2, bbox2.y) ||
					i(bbox1, bbox2.x, bbox2.y2) ||
					i(bbox1, bbox2.x2, bbox2.y2) ||
					(bbox1.x < bbox2.x2 && bbox1.x > bbox2.x || bbox2.x < bbox1.x2 && bbox2.x > bbox1.x) &&
					(bbox1.y < bbox2.y2 && bbox1.y > bbox2.y || bbox2.y < bbox1.y2 && bbox2.y > bbox1.y);
		},
		findDotsAtSegment = function (p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
			var t1 = 1 - t,
				t13 = Math.pow(t1, 3),
				t12 = Math.pow(t1, 2),
				t2 = t * t,
				t3 = t2 * t,
				x = t13 * p1x + t12 * 3 * t * c1x + t1 * 3 * t * t * c2x + t3 * p2x,
				y = t13 * p1y + t12 * 3 * t * c1y + t1 * 3 * t * t * c2y + t3 * p2y,
				mx = p1x + 2 * t * (c1x - p1x) + t2 * (c2x - 2 * c1x + p1x),
				my = p1y + 2 * t * (c1y - p1y) + t2 * (c2y - 2 * c1y + p1y),
				nx = c1x + 2 * t * (c2x - c1x) + t2 * (p2x - 2 * c2x + c1x),
				ny = c1y + 2 * t * (c2y - c1y) + t2 * (p2y - 2 * c2y + c1y),
				ax = t1 * p1x + t * c1x,
				ay = t1 * p1y + t * c1y,
				cx = t1 * c2x + t * p2x,
				cy = t1 * c2y + t * p2y,
				alpha = (90 - Math.atan2(mx - nx, my - ny) * 180 / Math.PI);
			if(mx > nx || my < ny) { alpha += 180; }
			return {
				x: x,
				y: y,
				m: {x: mx, y: my},
				n: {x: nx, y: ny},
				start: {x: ax, y: ay},
				end: {x: cx, y: cy},
				alpha: alpha
			};
		},
		findDotAtSegment = function (p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
			var t1 = 1 - t;
			return {
				x: Math.pow(t1, 3) * p1x + Math.pow(t1, 2) * 3 * t * c1x + t1 * 3 * t * t * c2x + Math.pow(t, 3) * p2x,
				y: Math.pow(t1, 3) * p1y + Math.pow(t1, 2) * 3 * t * c1y + t1 * 3 * t * t * c2y + Math.pow(t, 3) * p2y
			};
		},
		repush = function(array, item) {
			for (var i = 0, ii = array.length; i < ii; i++) if (array[i] === item) {
				return array.push(array.splice(i, 1)[0]);
			}
		},
		cacher = function(f, scope, postprocessor) {
			function newf() {
				var arg = Array.prototype.slice.call(arguments, 0),
				args = arg.join("\u2400"),
				cache = newf.cache = newf.cache || {},
				count = newf.count = newf.count || [];
				if (cache.hasOwnProperty(args)) {
					repush(count, args);
					return postprocessor ? postprocessor(cache[args]) : cache[args];
				}
				if(count.length >= 1e3) { delete cache[count.shift()]; }
				count.push(args);
				cache[args] = f.apply(scope, arg);
				return postprocessor ? postprocessor(cache[args]) : cache[args];
			}
			return newf;
		},
		curveDim = cacher(function (p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
			var a = (c2x - 2 * c1x + p1x) - (p2x - 2 * c2x + c1x),
				b = 2 * (c1x - p1x) - 2 * (c2x - c1x),
				c = p1x - c1x,
				t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / 2 / a,
				t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / 2 / a,
				y = [p1y, p2y],
				x = [p1x, p2x],
				dot;
			if(Math.abs(t1) > "1e12") { t1 = 0.5; }
			if(Math.abs(t2) > "1e12") { t2 = 0.5; }
			if (t1 > 0 && t1 < 1) {
				dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t1);
				x.push(dot.x);
				y.push(dot.y);
			}
			if (t2 > 0 && t2 < 1) {
				dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t2);
				x.push(dot.x);
				y.push(dot.y);
			}
			a = (c2y - 2 * c1y + p1y) - (p2y - 2 * c2y + c1y);
			b = 2 * (c1y - p1y) - 2 * (c2y - c1y);
			c = p1y - c1y;
			t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / 2 / a;
			t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / 2 / a;
			if(Math.abs(t1) > "1e12") { t1 = 0.5; }
			if(Math.abs(t2) > "1e12") { t2 = 0.5; }
			if (t1 > 0 && t1 < 1) {
				dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t1);
				x.push(dot.x);
				y.push(dot.y);
			}
			if (t2 > 0 && t2 < 1) {
				dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t2);
				x.push(dot.x);
				y.push(dot.y);
			}
			return {
				min: {x: Math.min.apply(0, x), y: Math.min.apply(0, y)},
				max: {x: Math.max.apply(0, x), y: Math.max.apply(0, y)}
			};
		}),
		intersect = function(x1, y1, x2, y2, x3, y3, x4, y4) {
			if ( Math.max(x1, x2) < Math.min(x3, x4) ||
					Math.min(x1, x2) > Math.max(x3, x4) ||
					Math.max(y1, y2) < Math.min(y3, y4) ||
					Math.min(y1, y2) > Math.max(y3, y4)
					) {
				return;
			}
			var nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
				ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
				denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

			if (!denominator) {
				return;
			}
			var px = nx / denominator,
			py = ny / denominator,
			px2 = +px.toFixed(2),
			py2 = +py.toFixed(2);
			if ( px2 < +Math.min(x1, x2).toFixed(2) ||
					px2 > +Math.max(x1, x2).toFixed(2) ||
					px2 < +Math.min(x3, x4).toFixed(2) ||
					px2 > +Math.max(x3, x4).toFixed(2) ||
					py2 < +Math.min(y1, y2).toFixed(2) ||
					py2 > +Math.max(y1, y2).toFixed(2) ||
					py2 < +Math.min(y3, y4).toFixed(2) ||
					py2 > +Math.max(y3, y4).toFixed(2)
					) {
				return;
			}
			return {x: px, y: py};
		},
		interHelper = function(bez1, bez2, justBool) {
			var bbox1 = bezierBBox(bez1),
				bbox2 = bezierBBox(bez2);
			if (!isBBoxIntersect(bbox1, bbox2)) {
				return justBool ? false : [];
			}
			var l1 = bezlen.apply(0, bez1),
				l2 = bezlen.apply(0, bez2),
				n1 = Math.max(~~(l1 / 5), 1),
				n2 = Math.max(~~(l2 / 5), 1),
				dots1 = [],
				dots2 = [],
				xy = {},
				res = justBool ? false : [],
				p;
			for (var i = 0; i < n1 + 1; i++) {
				p = findDotsAtSegment.apply(this, bez1.concat(i / n1));
				dots1.push({x: p.x, y: p.y, t: i / n1});
			}
			for (i = 0; i < n2 + 1; i++) {
				p = findDotsAtSegment.apply(this, bez2.concat(i / n2));
				dots2.push({x: p.x, y: p.y, t: i / n2});
			}
			for (i = 0; i < n1; i++) {
				for (var j = 0; j < n2; j++) {
					var di = dots1[i],
						di1 = dots1[i + 1],
						dj = dots2[j],
						dj1 = dots2[j + 1],
						ci = Math.abs(di1.x - di.x) < 0.001 ? "y" : "x",
						cj = Math.abs(dj1.x - dj.x) < 0.001 ? "y" : "x",
						is = intersect(di.x, di.y, di1.x, di1.y, dj.x, dj.y, dj1.x, dj1.y);
					if (is) {
						if (xy[is.x.toFixed(4)] == is.y.toFixed(4)) {
							continue;
						}
						xy[is.x.toFixed(4)] = is.y.toFixed(4);
						var t1 = di.t + Math.abs((is[ci] - di[ci]) / (di1[ci] - di[ci])) * (di1.t - di.t),
							t2 = dj.t + Math.abs((is[cj] - dj[cj]) / (dj1[cj] - dj[cj])) * (dj1.t - dj.t);
						if (t1 >= 0 && t1 <= 1.001 && t2 >= 0 && t2 <= 1.001) {
							if (justBool) {
								return true;
							} else {
								res.push({
									x: is.x,
									y: is.y,
									t1: Math.min(t1, 1),
									t2: Math.min(t2, 1)
								});
							}
						}
					}
				}
			}
			return res;
		},
		_path2string = function () {
			return this.join(",").replace(p2s, "$1");
		},
		clone = function(obj) {
			if (typeof obj == "function" || Object(obj) !== obj) {
				return obj;
			}
			var res = new obj.constructor();
			for (var key in obj) if (obj.hasOwnProperty(key)) {
				res[key] = clone(obj[key]);
			}
			return res;
		},
		pathClone = function (pathArray) {
			var res = clone(pathArray);
			res.toString = _path2string;
			return res;
		},
		paths = function (ps) {
			var p = paths.ps = paths.ps || {};
			if (p[ps]) {
				p[ps].sleep = 100;
			} else {
				p[ps] = {
					sleep: 100
				};
			}
			setTimeout(function () {
				for (var key in p) if (p.hasOwnProperty(key) && key != ps) {
					p[key].sleep--;
					if(!p[key].sleep) { delete p[key]; }
				}
			});
			return p[ps];
		},
		parsePathString = function (pathString) {
			if (!pathString) {
				return null;
			}
			var pth = paths(pathString);
			if (pth.arr) {
				return pathClone(pth.arr);
			}

			var paramCounts = {a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0},
				data = [];
			if (r_is(pathString, "array") && r_is(pathString[0], "array")) { // rough assumption
				data = pathClone(pathString);
			}
			if (!data.length) {
				String(pathString).replace(pathCommand, function (a, b, c) {
					var params = [],
						name = b.toLowerCase();
					c.replace(pathValues, function (a, b) {
						if(b) { params.push(+b); }
					});
					if (name == "m" && params.length > 2) {
						data.push(([b]).concat(params.splice(0, 2)));
						name = "l";
						b = b == "m" ? "l" : "L";
					}
					if (name == "r") {
						data.push(([b]).concat(params));
					} else while (params.length >= paramCounts[name]) {
						data.push(([b]).concat(params.splice(0, paramCounts[name])));
						if (!paramCounts[name]) {
							break;
						}
					}
				});
			}
			data.toString = _path2string;
			pth.arr = pathClone(data);
			return data;
		},
		r_is = function (o, type) {
			type = lowerCase.call(type);
			if (type == "finite") {
				return !isnan[has](+o);
			}
			if (type == "array") {
				return o instanceof Array;
			}
			return  (type == "null" && o === null) ||
					(type == typeof o && o !== null) ||
					(type == "object" && o === Object(o)) ||
					(type == "array" && Array.isArray && Array.isArray(o)) ||
					objectToString.call(o).slice(8, -1).toLowerCase() == type;
		},
		catmullRom2bezier = function(crp, z) {
			var d = [];
			for (var i = 0, iLen = crp.length; iLen - 2 * !z > i; i += 2) {
				var p = [
							{x: +crp[i - 2], y: +crp[i - 1]},
							{x: +crp[i],     y: +crp[i + 1]},
							{x: +crp[i + 2], y: +crp[i + 3]},
							{x: +crp[i + 4], y: +crp[i + 5]}
						];
				if (z) {
					if (!i) {
						p[0] = {x: +crp[iLen - 2], y: +crp[iLen - 1]};
					} else if (iLen - 4 == i) {
						p[3] = {x: +crp[0], y: +crp[1]};
					} else if (iLen - 2 == i) {
						p[2] = {x: +crp[0], y: +crp[1]};
						p[3] = {x: +crp[2], y: +crp[3]};
					}
				} else {
					if (iLen - 4 == i) {
						p[3] = p[2];
					} else if (!i) {
						p[0] = {x: +crp[i], y: +crp[i + 1]};
					}
				}
				d.push(["C",
					(-p[0].x + 6 * p[1].x + p[2].x) / 6,
					(-p[0].y + 6 * p[1].y + p[2].y) / 6,
					(p[1].x + 6 * p[2].x - p[3].x) / 6,
					(p[1].y + 6*p[2].y - p[3].y) / 6,
					p[2].x,
					p[2].y
				]);
			}

			return d;
		},
		pathToAbsolute = function (pathArray) {
			var pth = paths(pathArray);
			if (pth.abs) {
				return pathClone(pth.abs);
			}
			if (!r_is(pathArray, "array") || !r_is(pathArray && pathArray[0], "array")) { // rough assumption
				pathArray = parsePathString(pathArray);
			}
			if (!pathArray || !pathArray.length) {
				return [["M", 0, 0]];
			}
			var res = [],
				x = 0,
				y = 0,
				mx = 0,
				my = 0,
				start = 0, dots;
			if (pathArray[0][0] == "M") {
				x = +pathArray[0][1];
				y = +pathArray[0][2];
				mx = x;
				my = y;
				start++;
				res[0] = ["M", x, y];
			}
			var crz = pathArray.length == 3 && pathArray[0][0] == "M" && pathArray[1][0].toUpperCase() == "R" && pathArray[2][0].toUpperCase() == "Z";
			for (var r, pa, i = start, ii = pathArray.length; i < ii; i++) {
				res.push(r = []);
				pa = pathArray[i];
				if (pa[0] != upperCase.call(pa[0])) {
					/* jshint -W086 */
					r[0] = upperCase.call(pa[0]);
					switch (r[0]) {
						case "A":
							r[1] = pa[1];
							r[2] = pa[2];
							r[3] = pa[3];
							r[4] = pa[4];
							r[5] = pa[5];
							r[6] = +(pa[6] + x);
							r[7] = +(pa[7] + y);
							break;
						case "V":
							r[1] = +pa[1] + y;
							break;
						case "H":
							r[1] = +pa[1] + x;
							break;
						case "R":
							dots = ([x, y]).concat(pa.slice(1));
							for (var j = 2, jj = dots.length; j < jj; j++) {
								dots[j] = +dots[j] + x;
								dots[++j] = +dots[j] + y;
							}
							res.pop();
							res = res.concat(catmullRom2bezier(dots, crz));
							break;
						case "M":
							mx = +pa[1] + x;
							my = +pa[2] + y;
						default:
							for (j = 1, jj = pa.length; j < jj; j++) {
								r[j] = +pa[j] + ((j % 2) ? x : y);
							}
					}
					/* jshint +W086 */
				} else if (pa[0] == "R") {
					dots = ([x, y]).concat(pa.slice(1));
					res.pop();
					res = res.concat(catmullRom2bezier(dots, crz));
					r = (["R"]).concat(pa.slice(-2));
				} else {
					for (var k = 0, kk = pa.length; k < kk; k++) {
						r[k] = pa[k];
					}
				}
				/* jshint -W086 */
				switch (r[0]) {
					case "Z":
						x = mx;
						y = my;
						break;
					case "H":
						x = r[1];
						break;
					case "V":
						y = r[1];
						break;
					case "M":
						mx = r[r.length - 2];
						my = r[r.length - 1];
					default:
						x = r[r.length - 2];
						y = r[r.length - 1];
				}
				/* jshint +W086 */
			}
			res.toString = _path2string;
			pth.abs = pathClone(res);
			return res;
		},
		_path2curve = cacher(function (path, path2) {
			var pth = !path2 && paths(path);
			if (!path2 && pth.curve) {
				return pathClone(pth.curve);
			}
			var p = pathToAbsolute(path),
				p2 = path2 && pathToAbsolute(path2),
				attrs = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
				attrs2 = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
				processPath = function (path, d, pcom) {
					var nx, ny;
					if (!path) {
						return ["C", d.x, d.y, d.x, d.y, d.x, d.y];
					}
					if(!(path[0] in {T:1, Q:1})) {
						d.qx = d.qy = null;
					}
					switch (path[0]) {
						case "M":
							d.X = path[1];
							d.Y = path[2];
							break;
						case "A":
							path = (["C"]).concat(a2c.apply(0, ([d.x, d.y]).concat(path.slice(1))));
							break;
						case "S":
							if (pcom == "C" || pcom == "S") { // In "S" case we have to take into account, if the previous command is C/S.
								nx = d.x * 2 - d.bx;          // And reflect the previous
								ny = d.y * 2 - d.by;          // command's control point relative to the current point.
							}
							else {                            // or some else or nothing
								nx = d.x;
								ny = d.y;
							}
							path = (["C", nx, ny]).concat(path.slice(1));
							break;
						case "T":
							if (pcom == "Q" || pcom == "T") { // In "T" case we have to take into account, if the previous command is Q/T.
								d.qx = d.x * 2 - d.qx;        // And make a reflection similar
								d.qy = d.y * 2 - d.qy;        // to case "S".
							}
							else {                            // or something else or nothing
								d.qx = d.x;
								d.qy = d.y;
							}
							path = (["C"]).concat(q2c(d.x, d.y, d.qx, d.qy, path[1], path[2]));
							break;
						case "Q":
							d.qx = path[1];
							d.qy = path[2];
							path = (["C"]).concat(q2c(d.x, d.y, path[1], path[2], path[3], path[4]));
							break;
						case "L":
							path = (["C"]).concat(l2c(d.x, d.y, path[1], path[2]));
							break;
						case "H":
							path = (["C"]).concat(l2c(d.x, d.y, path[1], d.y));
							break;
						case "V":
							path = (["C"]).concat(l2c(d.x, d.y, d.x, path[1]));
							break;
						case "Z":
							path = (["C"]).concat(l2c(d.x, d.y, d.X, d.Y));
							break;
					}
					return path;
				},
				fixArc = function (pp, i) {
					if (pp[i].length > 7) {
						pp[i].shift();
						var pi = pp[i];
						while (pi.length) {
							pp.splice(i++, 0, (["C"]).concat(pi.splice(0, 6)));
						}
						pp.splice(i, 1);
						ii = Math.max(p.length, p2 && p2.length || 0);
					}
				},
				fixM = function (path1, path2, a1, a2, i) {
					if (path1 && path2 && path1[i][0] == "M" && path2[i][0] != "M") {
						path2.splice(i, 0, ["M", a2.x, a2.y]);
						a1.bx = 0;
						a1.by = 0;
						a1.x = path1[i][1];
						a1.y = path1[i][2];
						ii = Math.max(p.length, p2 && p2.length || 0);
					}
				};
			for (var i = 0, ii = Math.max(p.length, p2 && p2.length || 0); i < ii; i++) {
				p[i] = processPath(p[i], attrs);
				fixArc(p, i);
				if(p2) {
					p2[i] = processPath(p2[i], attrs2);
					fixArc(p2, i);
				}
				fixM(p, p2, attrs, attrs2, i);
				fixM(p2, p, attrs2, attrs, i);
				var seg = p[i],
					seg2 = p2 && p2[i],
					seglen = seg.length,
					seg2len = p2 && seg2.length;
				attrs.x = seg[seglen - 2];
				attrs.y = seg[seglen - 1];
				attrs.bx = parseFloat(seg[seglen - 4]) || attrs.x;
				attrs.by = parseFloat(seg[seglen - 3]) || attrs.y;
				attrs2.bx = p2 && (parseFloat(seg2[seg2len - 4]) || attrs2.x);
				attrs2.by = p2 && (parseFloat(seg2[seg2len - 3]) || attrs2.y);
				attrs2.x = p2 && seg2[seg2len - 2];
				attrs2.y = p2 && seg2[seg2len - 1];
			}
			if (!p2) {
				pth.curve = pathClone(p);
			}
			return p2 ? [p, p2] : p;
		}, null, pathClone),
		interPathHelper = function(path1, path2, justBool) {
			path1 = _path2curve(path1);
			//path2 = _path2curve(path2);
			var x1, y1, x2, y2, x1m, y1m, x2m, y2m, bez1, bez2,
				res = justBool ? false : [];
			for (var i = 0, ii = path1.length; i < ii; i++) {
				var pi = path1[i];
				if (pi[0] == "M") {
					x1 = x1m = pi[1];
					y1 = y1m = pi[2];
				} else {
					if (pi[0] == "C") {
						bez1 = [x1, y1].concat(pi.slice(1));
						x1 = bez1[6];
						y1 = bez1[7];
					} else {
						bez1 = [x1, y1, x1, y1, x1m, y1m, x1m, y1m];
						x1 = x1m;
						y1 = y1m;
					}
					for (var j = 0, jj = path2.length; j < jj; j++) {
						var pj = path2[j];
						if (pj[0] == "M") {
							x2 = x2m = pj[1];
							y2 = y2m = pj[2];
						} else {
							if (pj[0] == "C") {
								bez2 = [x2, y2].concat(pj.slice(1));
								x2 = bez2[6];
								y2 = bez2[7];
							} else {
								bez2 = [x2, y2, x2, y2, x2m, y2m, x2m, y2m];
								x2 = x2m;
								y2 = y2m;
							}
							var intr = interHelper(bez1, bez2, justBool);
							if (justBool) {
								if(intr) {
									return true;
								}
							} else {
								for (var k = 0, kk = intr.length; k < kk; k++) {
									intr[k].segment1 = i;
									intr[k].segment2 = j;
									intr[k].bez1 = bez1;
									intr[k].bez2 = bez2;
								}
								res = res.concat(intr);
							}
						}
					}
				}
			}
			return res;
		};

	var touches, latest_touches, last_time,
		crossingPaths = [],
		pathCallbacks = [],
		set_touches = function(to_touches, type) {
			var fingerPath, x, y, tx, ty, j, cpLen = crossingPaths.length, i = 0,
				len = to_touches.length,
				time = (new Date()).getTime(),
				dt = time - last_time;
			last_time = time;
			if(touches && touches.length === to_touches.length) {
				outer: for(i; i<len; i++) {
					x = to_touches[i].x;
					y = to_touches[i].y;
					tx = touches[i].x;
					ty = touches[i].y;
					fingerPath = [["M", tx, ty],
									["C", tx, ty, x, y, x, y]];
					for(j = 0; j < cpLen; j++) {
						var inter = interPathHelper(crossingPaths[j], fingerPath, true);
						if(inter) {
							var dx = x - tx,
								dy = y - ty,
								d = Math.sqrt(Math.pow(dx, 2), Math.pow(dy, 2)),
								v = d / dt;
							var callback_info = pathCallbacks[j];
							callback_info.callback.call(callback_info.context || this, v);
							break outer;
						}
					}
				}
			}
			touches = clone(to_touches);
		},
		timeout_id = false,
		interval_listener = function() {
			timeout_id = false;
			var new_touches = _.map(latest_touches, function(t) {
				return {x: t.pageX, y: t.pageY};
			});
			set_touches(new_touches);
		},
		touchstart_listener = function(event) {
			latest_touches = event.touches;
			if(latest_touches.length === 1) {
				timeout_id = window.setTimeout(interval_listener, 30);
			}
			event.preventDefault();
		},
		touchmove_listener = function(event) {
			if(timeout_id === false) {
				timeout_id = window.setTimeout(interval_listener, 30);
			}
			latest_touches = event.touches;
			event.preventDefault();
		},
		touchend_listener = function(event) {
			latest_touches = event.touches;
			if(latest_touches.length === 0) {
				if(timeout_id) {
					window.clearTimeout(timeout_id);
					timeout_id = false;
				}
				latest_touches = event.touches;
				interval_listener();
			} else {
				latest_touches = event.touches;
				if(timeout_id === false) {
					timeout_id = window.setTimeout(interval_listener, 30);
				}
			}
			event.preventDefault();
		},
		addTouchListeners = function() {
			window.addEventListener("touchstart", touchstart_listener);
			window.addEventListener("touchmove", touchmove_listener);
			window.addEventListener("touchend", touchend_listener);
		},
		removeTouchListeners = function() {
			window.removeEventListener("touchstart", touchstart_listener);
			window.removeEventListener("touchmove", touchmove_listener);
			window.removeEventListener("touchend", touchend_listener);
		},
		crossing_path_listener_id = 1,
		addCrossingPathListener = function(path, callback, context) {
			var cpl_id = crossing_path_listener_id;
			crossing_path_listener_id+=1;
			crossingPaths.push(path);
			pathCallbacks.push({
				callback: callback,
				context: context,
				id: cpl_id
			});
			if(crossingPaths.length === 1) {
				addTouchListeners();
			}
			return cpl_id;
		},
		removeCrossingPathListener = function(path) {
			var i = 0, len = crossingPaths.length, cp, linfo;
			for(i; i<len; i++) {
				cp = crossingPaths[i];
				linfo = pathCallbacks[i];

				if(cp === path || linfo.id === path) {
					crossingPaths.splice(i, 1);
					pathCallbacks.splice(i, 1);
					len -= 1;
					if(len === 0) {
						removeTouchListeners();
					}
				}
			}
		};
}(interstate));
