/*jslint nomen: true, vars: true */
/*global interstate,esprima,able,uid,console,window,RedMap */

(function (ist, $) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._;

	var show_all_start_states = ist.__debug_statecharts;

	var FAKE_ROOT_STATECHART = {
			id: "FAKE",
			outgoingTransitions: [],
			incomingTransitions: []
		};

	var NO_INDENT = 0,
		INDENT_ABOVE = 1,
		INDENT_BELOW = 2,
		INDENT_BOTH = 3;

	function padStr(str, len, pad_str, padFromEnd) {
		if(str.length > len) {
			return str.slice(0, len);
		} else {
			while(str.length < len) {
				if(padFromEnd) {
					str = str + pad_str;
				} else {
					str = pad_str + str;
				}
			}
			return str;
		}
	}
	

	ist.RootStatechartLayoutEngine = function (options) {
		able.make_this_optionable(this, {
			theta_degrees: 40,
			added_transition_width: 30,
			transition_height: 16,
			transition_margin: 1,
			used_state_name_width: 90,
			unused_state_name_width: 40,
			state_name_height: function() { return this.option("transition_height"); },
			state_padding_y: function() { return this.option("transition_margin"); },
			state_padding_x: 2,
			add_state_width: 50,
			used_start_state_width: function() { return this.option("used_state_name_width"); },
			unused_start_state_width: function() { return this.option("unused_state_name_width"); },
			start_state_radius: 6,
			theta_radians: function() { return this.option("theta_degrees") * Math.PI / 180; },
			tan_theta: function() { return Math.tan(this.option("theta_radians")); },
			transition_width: function() { return this.option("transition_height") / this.option("tan_theta"); },
			state_line_padding_factor: 1/2,
			padding_top: 10,
			padding_bottom: 5,
			padding_left: 0,
			padding_right: 0,
			collapseUnusedTransitions: false,
			indentIncomingTransitions: false,
			stateMachineSummary: false,
			allowTransitionsOnStateRow: false
		}, options);

		this.$stateMachineSummary = this.option("stateMachineSummary");
		this.$layout = cjs(_.bind(this._compute_layout, this));
	};
	(function (My) {
		var proto = My.prototype;

		My.INVISIBLE_DISPLAY_TYPE = "invisible",
		My.HRANGE_DISPLAY_TYPE = "hrange",
		My.STARTSTATE_DISPLAY_TYPE = "start",
		My.STATE_DISPLAY_TYPE = "state",
		My.TRANSITION_DISPLAY_TYPE = "transition";

		able.make_proto_optionable(proto);

		proto.destroy = function() {
			able.destroy_this_optionable(this);
			this.$layout.destroy();
			delete this.$layout;
		};

		proto.invalidate = function() {
			this.$layout.invalidate();
		};

		proto.get_statechart_tree = function (sc_summary) {
			var expand_node = function (node, is_root) {
				var sc = node.sc_summary;
				if (!sc.isStart) {
					var substates = sc.substates;

					if(_.size(substates) > 1 || is_root || show_all_start_states) { // use is_root for root statecharts with only a start state
						node.children.push.apply(node.children, _.compact(_.map(substates, function (x, name) {
							var subnode = {sc_summary: x, children: [], parent: node};
							expand_node(subnode);
							return subnode;
						})));
					}
				}
			};
			var curr_node = {
				sc_summary: FAKE_ROOT_STATECHART,
				children: _	.chain(sc_summary)
							.map(function (sc) {
								var node = {sc_summary: sc, children: []};
								expand_node(node, true);
								return node;
							}, this)
							.compact()
							.value(),
				parent: false
			};

			return curr_node;
		};

		proto.get_x = function (state_wrapper) {
			var full_layout_info = this.get_layout();
			if (state_wrapper) {
				var id = state_wrapper.cobj_id,
					layout_info = full_layout_info.locations[id];

				if (layout_info) {
					if (state_wrapper.type() === "statechart") {
						return layout_info.columnX;
					} else if (state_wrapper.type() === "transition") {
						return layout_info.from.x;
					}
				}
			} else {
				return full_layout_info.width;
			}
		};
		proto.total_width = function () {
			var full_layout_info = this.get_layout();
			return full_layout_info.width;
		};

		proto.get_width = function (state_wrapper) {
			if (state_wrapper.type() === "statechart") {
				return this.option("used_state_name_width");
			} else if (state_wrapper.type() === "transition") {
				return this.option("transition_width");
			} else if (state_wrapper.type() === "start_state") {
				return this.option("start_state_width");
			}
			return 0;
		};

		proto.get_layout = function () {
			return this.$layout.get();
		};

		proto._compute_layout = function () {
			var stateMachineSummary = this.$stateMachineSummary.get();

			if(!stateMachineSummary || stateMachineSummary.length === 0) {
				return {width: 0, height: 0, locations: {}};
			}

			var THETA_DEGREES = this.option("theta_degrees"),
				TRANSITION_HEIGHT = this.option("transition_height"),
				TRANSITION_MARGIN = this.option("transition_margin"),
				USED_STATE_NAME_WIDTH = this.option("used_state_name_width"),
				UNUSED_STATE_NAME_WIDTH = this.option("unused_state_name_width"),
				STATE_NAME_HEIGHT = this.option("state_name_height"),
				STATE_PADDING_Y = this.option("state_padding_y"),
				STATE_PADDING_X = this.option("state_padding_x"),
				ADD_STATE_WIDTH = this.option("add_state_width"),
				USED_START_STATE_WIDTH = this.option("used_start_state_width"),
				UNUSED_START_STATE_WIDTH = this.option("unused_start_state_width"),
				THETA_RADIANS = this.option("theta_radians"),
				TAN_THETA = this.option("tan_theta"),
				TRANSITION_WIDTH = this.option("transition_width"),
				STATE_LINE_PADDING_FACTOR = this.option("state_line_padding_factor"),
				START_STATE_RADIUS = this.option("start_state_radius"),
				PADDING_TOP = this.option("padding_top"),
				PADDING_BOTTOM = this.option("padding_bottom"),
				PADDING_LEFT = this.option("padding_left"),
				PADDING_RIGHT = this.option("padding_right"),
				statecharts_with_add_state_button = stateMachineSummary[0],
				ROW_HEIGHT = this.option("transition_height"),

				sc_tree = this.get_statechart_tree(stateMachineSummary),
				state_wings = {},
				rows = [],
				col = 0;

			function push_node_columns(node, depth) {
				var sc_summary = node.sc_summary,
					id = sc_summary.id,
					isStart = !!sc_summary.isStart,
					outgoingTransitions = sc_summary.outgoingTransitions,
					info = (state_wings[id] = {type:"state", sc_summary: sc_summary, rowNum: depth, isAtomic: isStart});

				if(isStart) {
					_.extend(info, {
						centerColumn: col++,
						columnTransitions: {
							outgoing: {
								used: [],
								notUsed: []
							},
							incoming: []
						},
					});
				} else {
					var children = node.children,
						leftmostColumn = col++,
						centerColumn,
						rightmostColumn;

					_.each(children, function (childnode) {
						push_node_columns(childnode, depth + 1);
					});

					centerColumn = col++;
					rightmostColumn = col++;

					_.extend(info, {
						leftmostColumn: leftmostColumn,
						centerColumn: centerColumn,
						rightmostColumn: rightmostColumn,
						leftColumnTransitions: {
							outgoing: {
								used: [],
								notUsed: []
							},
							incoming: [],
							ordered: []
						},
						rightColumnTransitions: {
							outgoing: {
								used: [],
								notUsed: []
							},
							incoming: [],
							ordered: []
						}
					});
				}

				if (rows[depth]) {
					rows[depth].push(info);
				} else {
					rows[depth] = [info];
				}
			}

			push_node_columns(sc_tree, 0);

/*
			_.each(reverseArr(rows), function(row, index) {
				var row_strs = [];
				for(var i = 0; i<col; i++) {
					row_strs[i] = "   ";
				}
				_.each(row, function(state_wing_info) {
					var leftmostColumn = state_wing_info.leftmostColumn,
						rightmostColumn = state_wing_info.rightmostColumn,
						centerColumn = state_wing_info.centerColumn, str;

					if(leftmostColumn >= 0) {
						for(var i = leftmostColumn; i<=rightmostColumn; i++) {
							if(i === centerColumn) {
								str = padStr(uid.strip_prefix(state_wing_info.sc_summary.id), 3, "-");
							} else if(i === leftmostColumn) {
								str = "|--";
							} else if(i === rightmostColumn) {
								str = "--|";
							} else {
								str = "---";
							}
							row_strs[i] = str;
						}
					} else {
						row_strs[centerColumn] = padStr(uid.strip_prefix(state_wing_info.sc_summary.id), 3, " ");
					}
				});
				var row_str = row_strs.join("");
				console.log(padStr(index+":", 4, " "), row_str);
			});
			*/

			_.each(state_wings, function(fromStateWing) {
				var sc_summary = fromStateWing.sc_summary,
					outgoingTransitions = sc_summary.outgoingTransitions,
					fromCenterColumn = fromStateWing.centerColumn,
					atomic = fromStateWing.isAtomic;

				_.each(outgoingTransitions, function(transition) {
					var usedByAnyProperties = transition.usedByAnyProperties,
						toStateClient = transition.to,
						toStateID = toStateClient.cobj_id,
						toStateWing = state_wings[toStateID],
						toCenterColumn = toStateWing.centerColumnn,
						columnTransitions, transitionTypeArr,
						fromColumnInfo, toColumnInfo,
						fromSide, toSide,
						fromColumn, toColumn, toCenterColumn = toStateWing.centerColumn;

					if(atomic) {
						columnTransitions = fromStateWing.columnTransitions.outgoing;
						fromColumn = fromStateWing.centerColumn;
						fromColumnInfo = fromStateWing.columnTransitions;
						fromSide = "center";
					} else {
						if(toCenterColumn === fromCenterColumn) {
							columnTransitions = fromStateWing.rightColumnTransitions.outgoing;
							fromColumn = fromStateWing.rightmostColumn;
							fromColumnInfo = fromStateWing.rightColumnTransitions;
							fromSide = "right";
						} else if(fromCenterColumn > toCenterColumn) {
							columnTransitions = fromStateWing.leftColumnTransitions.outgoing;
							fromColumn = fromStateWing.leftmostColumn;
							fromColumnInfo = fromStateWing.leftColumnTransitions;
							fromSide = "left";
						} else {
							columnTransitions = fromStateWing.rightColumnTransitions.outgoing;
							fromColumn = fromStateWing.rightmostColumn;
							fromColumnInfo = fromStateWing.rightColumnTransitions;
							fromSide = "right";
						}
					}

					if(usedByAnyProperties) {
						transitionTypeArr = columnTransitions.used;
					} else {
						transitionTypeArr = columnTransitions.notUsed;
					}
					var transition_info = {
							type:"transition",
							transition_summary: transition,
							fromStateWing: fromStateWing,
							toStateWing: toStateWing,
						};
					transitionTypeArr.push(transition_info);

					if(toStateWing.isAtomic) {
						toStateWing.columnTransitions.incoming.push(transition_info);
						toColumn = toCenterColumn;
						toColumnInfo = toStateWing.columnTransitions;
						toSide = "center";
					} else {
						if(toCenterColumn>fromCenterColumn) {
							toStateWing.leftColumnTransitions.incoming.push(transition_info);
							toColumn = toStateWing.leftmostColumn;
							toColumnInfo = toStateWing.leftColumnTransitions;
							toSide = "left";
						} else {
							toStateWing.rightColumnTransitions.incoming.push(transition_info);
							toColumn = toStateWing.rightmostColumn;
							toColumnInfo = toStateWing.rightColumnTransitions;
							toSide = "right";
						}
					}

					_.extend(transition_info, {
						fromColumn: fromColumn,
						fromColumnInfo: fromColumnInfo,
						toColumn: toColumn,
						toColumnInfo: toColumnInfo,
						leftmostColumn: Math.min(fromColumn, toColumn),
						rightmostColumn: Math.max(fromColumn, toColumn),
						fromSide: fromSide,
						toSide: toSide
					});
				});
			});

			function rowHasRoomforTransition(row, transition_info){
				var i = 0, len = row.length, cell, leftWing, rightWing, center,
					minCol = transition_info.leftmostColumn, maxCol = transition_info.rightmostColumn;
				while(i<len) {
					cell = row[i];
					if(cell.type === "state") {
						if(cell.isAtomic) {
							center = cell.centerColumn;
							if(center > minCol && center < maxCol) {
								return false;
							}
						} else {
							leftWing = cell.leftmostColumn;
							rightWing = cell.rightmostColumn;

							if((leftWing > minCol && leftWing < maxCol) || (rightWing > minCol && rightWing < maxCol) ||
								(leftWing > minCol && rightWing < maxCol) || (rightWing > minCol && leftWing < maxCol)) {
								return false;
							}
						}
					} else if(cell.type === "transition") {
						leftWing = cell.leftmostColumn;
						rightWing = cell.rightmostColumn;

						if((leftWing >= minCol && leftWing <= maxCol) || (rightWing >= minCol && rightWing <= maxCol) ||
							(leftWing >= minCol && rightWing <= maxCol) || (rightWing >= minCol && leftWing <= maxCol)) {
							return false;
						}
					}
					i++;
				}
				return true;
			}

			_.each(state_wings, function(fromStateWing) {
				var sc_summary = fromStateWing.sc_summary,
					depth = fromStateWing.rowNum,
					row,
					transitions_infos,
					incoming_transition_infos,
					highestTransitionRow = depth;

				if(fromStateWing.isAtomic) {
					transitions_infos = fromStateWing.columnTransitions.outgoing.used.concat(fromStateWing.columnTransitions.outgoing.notUsed);
				} else {
					transitions_infos = fromStateWing.leftColumnTransitions.outgoing.used.concat(
															fromStateWing.rightColumnTransitions.outgoing.used,
															fromStateWing.leftColumnTransitions.outgoing.notUsed,
															fromStateWing.rightColumnTransitions.outgoing.notUsed
														);
				}

				_.each(transitions_infos, function(transition_info) {
					var row_num = depth;
					
					if(!fromStateWing.isAtomic && !this.option("allowTransitionsOnStateRow")) {
						row_num++;
					}

					while(row_num < rows.length) {
						row = rows[row_num];

						if(rowHasRoomforTransition(row, transition_info)) {
							row.push(transition_info);
							_.extend(transition_info, {
								rowNum: row_num
							});
							if(row_num > highestTransitionRow) { highestTransitionRow = row_num; }
							return;
						}
						row_num++;
					}

					// not found; create a new row;
					_.extend(transition_info, {
						rowNum: row_num
					});
					if(row_num > highestTransitionRow) { highestTransitionRow = row_num; }
					row = [transition_info];
					rows[row_num] = row;
				}, this);
				fromStateWing.numOwnRows = highestTransitionRow-depth + 1;
			}, this);

			_.each(state_wings, function(fromStateWing) {
				var sc_summary = fromStateWing.sc_summary,
					depth = fromStateWing.rowNum,
					incoming_transition_infos,
					highestTransitionRow = depth + fromStateWing.numOwnRows-1;

				if(fromStateWing.isAtomic) {
					incoming_transition_infos = fromStateWing.columnTransitions.incoming;
				} else {
					incoming_transition_infos = fromStateWing.leftColumnTransitions.incoming.concat(
															fromStateWing.rightColumnTransitions.incoming
														);
				}

				_.each(incoming_transition_infos, function(transition_info) {
					var row_num = transition_info.rowNum;
					if(row_num > highestTransitionRow) { highestTransitionRow = row_num; }
				});
				fromStateWing.numOwnRows = highestTransitionRow-depth + 1;
			});

			var columnWidths = [],
				TRANSITION_WIDTH = this.option("transition_width"),
				TRANSITION_HEIGHT = this.option("transition_height");

			_.each(state_wings, function(stateWing) {
				var sc_summary = stateWing.sc_summary,
					depth = stateWing.rowNum,
					centerColumnWidth;

				if(sc_summary.isAtomic) {
					if(sc_summary.usedByAnyProperties) {
						centerColumnWidth = this.option("used_start_state_width");
					} else {
						centerColumnWidth = this.option("unused_start_state_width");
					}
				} else {
					if(sc_summary === FAKE_ROOT_STATECHART) {
						centerColumnWidth = 0;
					} else if(sc_summary.isRoot) {
						if(sc_summary === statecharts_with_add_state_button) {
							centerColumnWidth = ADD_STATE_WIDTH;
						} else {
							centerColumnWidth = 0;
						}
					} else if(sc_summary.usedByAnyProperties) {
						centerColumnWidth = this.option("used_state_name_width");
					} else {
						centerColumnWidth = this.option("unused_state_name_width");
					}
				}

				columnWidths[stateWing.centerColumn] = centerColumnWidth;
				stateWing.centerColumnWidth = centerColumnWidth;

				if(stateWing.isAtomic) {
					_.each(stateWing.columnTransitions.outgoing.used.concat(stateWing.columnTransitions.outgoing.notUsed),
						function(transition) {
							var rowNum = transition.rowNum;
							stateWing.numOwnRows = 1;
							stateWing.rowNum = rowNum;
						});
				} else {
					_.each([stateWing.leftColumnTransitions, stateWing.rightColumnTransitions],
						function(columnTransitions, i) {
							var columnIndex = (i === 0 ? stateWing.leftmostColumn : stateWing.rightmostColumn),
								width = 0;

							var collapseUnusedTransitions = this.option("collapseUnusedTransitions"),
								indentIncomingTransitions = this.option("indentIncomingTransitions"),
								indentations = [],
								overallHighestTransitionRow = false,
								orderedTransitions;

							_.each(columnTransitions.outgoing.used, function(transition_info) {
								var rowNum = transition_info.rowNum;

								indentations[rowNum-depth] = INDENT_BOTH;
								width += TRANSITION_WIDTH;
							});

							if(collapseUnusedTransitions) {
								var lowestTransitionRowNum = false,
									highestTransitionRowNum = false;

								_.each(columnTransitions.outgoing.notUsed, function(transition_info) {
									var rowNum = transition_info.rowNum;

									if(lowestTransitionRowNum === false || lowestTransitionRowNum > rowNum) {
										lowestTransitionRowNum = rowNum;
									}
									if(highestTransitionRowNum === false || highestTransitionRowNum < rowNum) {
										highestTransitionRowNum = rowNum;
									}
									indentations[rowNum-depth] = NO_INDENT;
								});

								if(lowestTransitionRowNum !== false && highestTransitionRowNum !== false) {
									width += TRANSITION_WIDTH;
									if(lowestTransitionRowNum === highestTransitionRowNum) {
										indentations[lowestTransitionRowNum-depth] = INDENT_BOTH;
									} else {
										indentations[lowestTransitionRowNum-depth] = INDENT_BELOW;
										indentations[highestTransitionRowNum-depth] = INDENT_ABOVE;
									}
								}
							} else {
								_.each(columnTransitions.outgoing.notUsed, function(transition_info) {
									var rowNum = transition_info.rowNum;

									indentations[rowNum-depth] = INDENT_BOTH;
									width += TRANSITION_WIDTH;
								});
							}

							if(indentIncomingTransitions) {
								_.each(columnTransitions.incoming, function(transition_info) {
									var rowNum = transition_info.rowNum;

									indentations[rowNum-depth] = INDENT_BOTH;
									width += TRANSITION_WIDTH;
								});
							} else {
								_.each(columnTransitions.incoming, function(transition_info) {
									var rowNum = transition_info.rowNum;

									if(!indentations[rowNum-depth]) { // don't overwrite previous indentation
										indentations[rowNum-depth] = NO_INDENT;
									}
								});
							}

							_.each(columnTransitions.incoming.concat(columnTransitions.outgoing.notUsed,
								columnTransitions.outgoing.used), function(transition_info) {
									var rowNum = transition_info.rowNum;

									if(overallHighestTransitionRow === false || overallHighestTransitionRow < rowNum) {
										overallHighestTransitionRow = rowNum;
									}
								});

							_.extend(columnTransitions, {
								indentations: indentations,
								width: width
							});

							if(width + 0.0001 >= TRANSITION_WIDTH) {
								width += this.option("added_transition_width");
							} // pad the widths of columns with transitions

							columnWidths[columnIndex] = Math.max(width, this.option("state_padding_x"));
						}, this);
				}
			}, this);

			function computeNumRows(sc_summary) {
				var stateWings = state_wings[sc_summary.id];

				if(!stateWings) {
					return 0;
				}

				var maxNumRows = stateWings.numOwnRows;
				_.each(sc_summary.substates, function(child) {
					var numChildRows = computeNumRows(child),
						childWings = state_wings[child.id];

					if(childWings) {
						var totalNumRows = (childWings.rowNum - stateWings.rowNum) + numChildRows;
						if(totalNumRows > maxNumRows) {
							maxNumRows = totalNumRows;
						}
					}
				});
				stateWings.numRows = maxNumRows;

				return stateWings.numRows;
			}
			_.each(stateMachineSummary, computeNumRows);

			var overallNumRows = 0,
				totalWidth = 0;
			_.each(stateMachineSummary, function(sc_summary) {
				var stateWings = state_wings[sc_summary.id],
					numRows = stateWings.numRows;

				if(numRows+1 > overallNumRows) { overallNumRows = numRows+1; }
			});

			_.each(columnWidths, function(cwidth) {
				totalWidth += cwidth;
			});

			_.extend(state_wings[FAKE_ROOT_STATECHART.id], {
				numRows: overallNumRows,
				width: totalWidth
			});
			/*

			var table_str_arr = [],
				CHARS_PER_COL = 7,
				empty_str = "";

			while(empty_str.length < CHARS_PER_COL) { empty_str += " "; }

			for(var i = 0; i<overallNumRows; i++) {
				table_str_arr[i] = [];
				for(var j = 0; j<col; j++) {
					table_str_arr[i][j] = [empty_str, empty_str, empty_str]
				}
			}

			_.each(rows, function(row, index) {
				var row_str_array = [];
				_.each(row, function(state_wing_info) {
					if(state_wing_info.type === "state") {
						var ts, cs;
						if(state_wing_info.isAtomic) {
							ts = [state_wing_info.columnTransitions];
							cs = [state_wing_info.centerColumn];
						} else {
							ts = [state_wing_info.leftColumnTransitions, state_wing_info.rightColumnTransitions];
							cs = [state_wing_info.leftmostColumn, state_wing_info.rightmostColumn];

							var leftmostColumn = state_wing_info.leftmostColumn,
								rightmostColumn = state_wing_info.rightmostColumn,
								centerColumn = state_wing_info.centerColumn, str;

							var rowNum = state_wing_info.rowNum;

							var strs;
							for(var i = leftmostColumn; i<=rightmostColumn; i++) {
								if(i === centerColumn) {
									strs = [padStr("", CHARS_PER_COL, "-"),
											padStr(uid.strip_prefix(state_wing_info.sc_summary.id)+"", CHARS_PER_COL, " "),
											padStr("",CHARS_PER_COL, "-")];
								} else if(i === leftmostColumn) {
									strs = [padStr("+", CHARS_PER_COL, "-", true),
											padStr("|", CHARS_PER_COL, " ", true),
											padStr("+", CHARS_PER_COL, "-", true)];
								} else if(i === rightmostColumn) {
									strs = [padStr("+", CHARS_PER_COL, "-", false),
											padStr("|", CHARS_PER_COL, " ", false),
											padStr("+", CHARS_PER_COL, "-", false)];
								} else {
									strs = [padStr("", CHARS_PER_COL, "-"),
											"",
											padStr("",CHARS_PER_COL, "-")];
								}
								table_str_arr[rowNum][i] = strs;
							}
						}
						_.each(ts,
							function(columnTransitions, index) {
								var outSlash = index === 0 ? "\\" : "/";
								var colIndex = cs[index];
								var row_strs = [];

								var transitionArr = columnTransitions.incoming.concat(
										columnTransitions.outgoing.used,
										columnTransitions.outgoing.notUsed
									);
								_.each(transitionArr, function(transition) {
									var arrow_str0, arrow_str1;

									if(transition.fromStateWing === state_wing_info && transition.toStateWing === state_wing_info) {
										arrow_str0 = "<";
										arrow_str1 = ">";
									} else if(transition.fromStateWing === state_wing_info) {
										arrow_str0 = "-";
										arrow_str1 = "->";
									} else {
										arrow_str0 = "<-";
										arrow_str1 = "-";
									}
									var rowNum = transition.rowNum,
										indentation = columnTransitions.indentations ? columnTransitions.indentations[rowNum-state_wing_info.rowNum] : false || NO_INDENT,
										transitionID = uid.strip_prefix(transition.transition_summary.id),
										arrow_str = " " + arrow_str0 + transitionID + arrow_str1,
										transition_rep;
									
									if(state_wing_info.isAtomic) {
										transition_rep = [" ", "0" + arrow_str, 
											padStr(uid.strip_prefix(state_wing_info.sc_summary.id)+"", CHARS_PER_COL, " ", true)];
									} else {
										if(indentation === INDENT_ABOVE) {
											transition_rep = [outSlash, arrow_str, "|"];
										} else if(indentation === INDENT_BELOW) {
											transition_rep = ["|", arrow_str, outSlash];
										} else if(indentation === INDENT_BOTH) {
											transition_rep = [outSlash, arrow_str, outSlash];
										} else {
											transition_rep = ["|", arrow_str, "|"];
										}
									}
									table_str_arr[rowNum][colIndex] = transition_rep;
								});
							});
					}
				});
			});

			for(var i = table_str_arr.length-1; i>=0; i--) {
				var row_arr = table_str_arr[i],
					lines = [];
				for(var j = 0; j<3; j++) {
					lines[j] = _.map(_.pluck(row_arr, j), function(str) {
						return padStr(str, CHARS_PER_COL, " ", true);
					})
				}
				for(var j = 0; j<lines.length; j++) {
					console.log(lines[j].join(""));
				}
			}
			/**/


			var location_info_map = {};

			_.each(state_wings, function(stateWing) {
				var sc_summary = stateWing.sc_summary,
					locationInfo, centerColumnIndex, i, ccx, lcx, rcx,
					leftColumnIndex, rightColumnIndex;

				if(stateWing.isAtomic) {
					centerColumnIndex = stateWing.centerColumn,
					i = 0,
					ccx = 0;
					for(;i<centerColumnIndex; i++) {
						ccx += columnWidths[i];
					}

					locationInfo = {
						columnX: PADDING_LEFT + ccx + stateWing.centerColumnWidth/2,
						columnWidth: stateWing.centerColumnWidth,
						x: PADDING_LEFT + ccx + stateWing.centerColumnWidth/2,
						y: PADDING_TOP + ((overallNumRows-stateWing.rowNum) - 0.5) * ROW_HEIGHT,
						displayType: My.STARTSTATE_DISPLAY_TYPE
					};
				} else if(sc_summary === FAKE_ROOT_STATECHART) {
					locationInfo = {
						x: 0,
						y: 0,
						width: PADDING_LEFT + PADDING_RIGHT + stateWing.width,
						height: PADDING_TOP + PADDING_BOTTOM + (stateWing.numRows-2) * ROW_HEIGHT,
						displayType: My.INVISIBLE_DISPLAY_TYPE
					};
				} else if(sc_summary.isRoot) {
					leftColumnIndex = stateWing.leftmostColumn;
					rightColumnIndex = stateWing.rightmostColumn;
					i = 0;

					centerColumnIndex = stateWing.centerColumn;

					lcx = 0;
					for(;i<leftColumnIndex; i++) {
						lcx += columnWidths[i];
					}
					ccx = lcx;
					for(;i<centerColumnIndex; i++) {
						ccx += columnWidths[i];
					}
					rcx = ccx;
					for(; i<rightColumnIndex; i++) {
						rcx += columnWidths[i];
					}
					locationInfo = {
						x: PADDING_LEFT + lcx,
						y: PADDING_TOP/2,
						width: rcx-lcx,
						displayType: My.HRANGE_DISPLAY_TYPE
					};
					if(sc_summary === statecharts_with_add_state_button) {
						_.extend(locationInfo, {
							add_state_button_x: PADDING_LEFT + ccx
						});
					}
				} else {
					leftColumnIndex = stateWing.leftmostColumn;
					rightColumnIndex = stateWing.rightmostColumn;
					i = 0;

					centerColumnIndex = stateWing.centerColumn;

					lcx = 0;
					for(;i<leftColumnIndex; i++) {
						lcx += columnWidths[i];
					}
					ccx = lcx;
					for(;i<centerColumnIndex; i++) {
						ccx += columnWidths[i];
					}
					rcx = ccx;
					for(; i<rightColumnIndex; i++) {
						rcx += columnWidths[i];
					}

					var leftWingPoints = [],
						rightWingPoints = [],
						numRows = stateWing.numRows,
						leftColumnTransitions = stateWing.leftColumnTransitions,
						rightColumnTransitions = stateWing.rightColumnTransitions,
						i = 0,
						lastLeftIndentation = -1,
						lastRightIndentation = -1,
						leftIndentation, rightIndentation, points;

					//console.log(rightColumnTransitions.indentations);
					while(i < numRows) {
						leftIndentation = leftColumnTransitions.indentations[i];
						rightIndentation = rightColumnTransitions.indentations[i];

						if(leftIndentation) {
							if(lastLeftIndentation < i-1) {
								leftWingPoints.unshift([0.0, (i - lastLeftIndentation - 1)]);
							}

							if(leftIndentation === INDENT_ABOVE) {
								leftWingPoints.unshift([0.5, 0.5], [0.0, 0.5]);
							} else if(leftIndentation === INDENT_BELOW) {
								leftWingPoints.unshift([0.0, 0.5], [0.5, 0.5]);
							} else if(leftIndentation === INDENT_BOTH) {
								leftWingPoints.unshift([1,1]);
							}
							lastLeftIndentation = i;
						}

						//console.log(rightIndentation);
						if(rightIndentation) {
							if(lastRightIndentation < i-1) {
								rightWingPoints.push([0.0, (i - lastRightIndentation - 1)]);
							}

							if(rightIndentation === INDENT_ABOVE) {
								rightWingPoints.push([0.0, 0.5], [0.5, 0.5]);
							} else if(rightIndentation === INDENT_BELOW) {
								rightWingPoints.push([0.5, 0.5], [0.0, 0.5]);
							} else if(rightIndentation === INDENT_BOTH) {
								rightWingPoints.push([1,1]);
							}
							lastRightIndentation = i;
						}

						i++;
					}

					if(lastLeftIndentation < numRows-1) {
						leftWingPoints.unshift([0, (numRows - lastLeftIndentation-1)]);
					}

					if(lastRightIndentation < numRows-1) {
						rightWingPoints.push([0, (numRows - lastRightIndentation-1)]);
					}

					var pts = [["M", PADDING_LEFT + rcx, PADDING_TOP + (overallNumRows-stateWing.rowNum) * ROW_HEIGHT]];
					_.each(rightWingPoints, function(pt) {
						pts.push(["l", TRANSITION_WIDTH*pt[0], -TRANSITION_HEIGHT*pt[1]]);
					});
					pts.push(["H", PADDING_LEFT + lcx]);
					_.each(leftWingPoints, function(pt) {
						pts.push(["l", TRANSITION_WIDTH*pt[0], TRANSITION_HEIGHT*pt[1]]);
					});
					pts.push(["L", PADDING_LEFT + lcx+columnWidths[leftColumnIndex], PADDING_TOP + (overallNumRows-stateWing.rowNum) * ROW_HEIGHT]);
					pts.push(["Z"]);

					locationInfo = {
						shape: pts,
						columnX: PADDING_LEFT + ccx + stateWing.centerColumnWidth/2,
						columnWidth: stateWing.centerColumnWidth,
						x: PADDING_LEFT + ccx + stateWing.centerColumnWidth/2,
						y: PADDING_TOP + (overallNumRows-stateWing.rowNum-0.5) * ROW_HEIGHT,
						displayType: My.STATE_DISPLAY_TYPE
					};
				}

				location_info_map[sc_summary.id] = locationInfo;
			}, this);
			//console.log(state_wings);
			//console.log(location_info_map);

			_.each(state_wings, function(stateWing) {
				var sc_summary = stateWing.sc_summary,
					locationInfo = location_info_map[sc_summary.id],
					transitions;

				if(stateWing.isAtomic) {
					transitions = stateWing.columnTransitions.outgoing.used.concat(stateWing.columnTransitions.outgoing.notUsed);
				} else {
					transitions = stateWing.leftColumnTransitions.outgoing.notUsed.concat(
								stateWing.rightColumnTransitions.outgoing.notUsed,
								stateWing.leftColumnTransitions.outgoing.used,
								stateWing.rightColumnTransitions.outgoing.used
							);
				}

				function computeXOffset(rowNum, side, stateWing) {
					var offset = 0,
						numRowsUp = rowNum - stateWing.rowNum,
						numRows = stateWing.numRows,
						indentations, indentation, i;
					if(side === "right") {
						indentations = stateWing.rightColumnTransitions.indentations;
						i = 0;
						while(i <= numRowsUp) {
							indentation = indentations[i];
							if(indentation === INDENT_BOTH) {
								if(i === numRowsUp) {
									offset += TRANSITION_WIDTH/2;
								} else {
									offset += TRANSITION_WIDTH;
								}
							} else if(indentation === INDENT_BELOW) {
								offset += TRANSITION_WIDTH/2;
							} else if(indentation === INDENT_ABOVE) {
								if(i !== numRowsUp) {
									offset += TRANSITION_WIDTH/2;
								}
							}
							i++;
						}
					} else {
						indentations = stateWing.leftColumnTransitions.indentations;
						i = stateWing.numRows;
						while(i >= numRowsUp) {
							indentation = indentations[i];
							if(indentation === INDENT_BOTH) {
								if(i === numRowsUp) {
									offset += TRANSITION_WIDTH/2;
								} else {
									offset += TRANSITION_WIDTH;
								}
							} else if(indentation === INDENT_BELOW) {
								if(i !== numRowsUp) {
									offset += TRANSITION_WIDTH/2;
								}
							} else if(indentation === INDENT_ABOVE) {
								offset += TRANSITION_WIDTH/2;
							}
							i--;
						}
					}
					return offset;
				}

				_.each(transitions, function(transitionWing) {
					var rowNum = transitionWing.rowNum,
						y = (overallNumRows-transitionWing.rowNum-0.5) * ROW_HEIGHT,
						fromStateWing = transitionWing.fromStateWing,
						toStateWing = transitionWing.toStateWing,
						fromColumn = transitionWing.fromColumn,
						toColumn = transitionWing.toColumn,
						fromX = 0, toX = 0, i = 0,
						numRowsUp, indentations, indentation;

					if(fromStateWing === toStateWing && fromStateWing.isAtomic) {
						return;
					}

					while(i < fromColumn) {
						fromX += columnWidths[i];
						i++;
					}
					i=0;
					while(i < toColumn) {
						toX += columnWidths[i];
						i++;
					}

					if(fromStateWing.isAtomic) {
						var fromLocationInfo = location_info_map[fromStateWing.sc_summary.id];
						fromX = fromLocationInfo.x;
					} else {
						fromX += computeXOffset(rowNum, transitionWing.fromSide, fromStateWing);
						fromX += PADDING_LEFT;
					}

					if(toStateWing.isAtomic) {
						var toLocationInfo = location_info_map[toStateWing.sc_summary.id];
						toX = toLocationInfo.x;
					} else {
						toX += computeXOffset(rowNum, transitionWing.toSide, toStateWing);
						toX += PADDING_LEFT;
					}

					var transitionLocationInfo = {
							from: {
								x: fromX,
								y: PADDING_TOP + y
							},
							to: {
								x: toX,
								y: PADDING_TOP + y
							},
							columnX: locationInfo.columnX,
							columnWidth: locationInfo.columnWidth,
							displayType: My.TRANSITION_DISPLAY_TYPE
						},
						transition_info = transitionWing.transition_summary;

					location_info_map[transition_info.id] = transitionLocationInfo;
				});
			}, this);
			var rootLayout = location_info_map[FAKE_ROOT_STATECHART.id];

			return {width: rootLayout.width, height: rootLayout.height, locations: location_info_map};
		};
	}(ist.RootStatechartLayoutEngine));

	function fillArray(value, len) {
		var arr = [], i = 0;
		while(i < len) { arr.push(value); i++; }
		return arr;
	}

function reverseArr(input) {
    var ret = new Array;
    for(var i = input.length-1; i >= 0; i--) {
        ret.push(input[i]);
    }
    return ret;
}
}(interstate));
