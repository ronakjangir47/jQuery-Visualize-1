/* --------------------------------------------------------------------
 * jQuery Visualize 'Extended' plugin
 *
 * Original Author: Scott Jehl, scott@filamentgroup.com
 * Copyright (c) 2009 Filament Group
 * licensed under MIT (filamentgroup.com/examples/mit-license.txt)
 *
 * Extended version
 * Author: Christophe Desguez, https://github.com/zipang
 * https://github.com/zipang/jQuery-Visualize
 * -------------------------------------------------------------------- */
(function ($) {
	$.visualize = {
		plugins:{} // additional chart scripts will load themself inside this namespace
	};

	// UTILITIES

	Array.max = function (arr) {
		if (!arr || arr.length == 0) return undefined;
		return Math.max.apply(Array, arr);
	};
	Array.min = function (arr) {
		if (!arr || arr.length == 0) return undefined;
		return Math.min.apply(Array, arr);
	};
	Array.sum = function (arr) {
		var len = (arr && arr.length ? arr.length : 0), sum = 0, val;
		for (var i = 0; i < len; i++) {
			val = parseFloat(arr[i]);
			sum += ((!arr[i] || isNaN(arr[i])) ? 0 : val);
		}
		return sum;
	};
	Array.avg = function (arr) {
		var len = (arr && arr.length ? arr.length : 0);
		return (len ? Array.sum(arr) / len : 0);
	};

	/**
	 * Get a regular serie of numbers from
	 * @param first to
	 * @param last
	 * @param ticks number of steps (ticks). Default to 5
	 * @return {Array}
	 */
	$.visualize.getRangeLabels = function (first, last, ticks) {
		var domain = last - first,
			ticks  = (ticks >= domain) ? (domain + 1) : ticks,
		    slices = ticks - 1,
		    val, labels = [];

		labels.push(first);

		for (var i = 1; i < slices; i++) {
			val = first + domain / slices * i;
			if (Math.abs(val) < 10) {
				labels.push((val % 1 == 0) ? val : Math.ceil(val * 100) / 100); // display 2 digits when precision needed
			} else {
				labels.push(Math.floor(val));
			}
		}

		labels.push(last);
		return labels;
	};

	/**
	 * Find the plugin to draw a specific chart
	 */
	function loadChart(type, next) {

		if ($.visualize.plugins[type]) {
			// Allready loaded chart plugin
			next($.visualize.plugins[type]);

		} else {
			// Try to dynamically load a new type of chart from external plugin
			var pluginUrl = "/plugins/jquery.visualize." + type.split(/[-_]/)[0] + ".js";
			$.ajax({
				url: pluginUrl,
				dataType: "script",
				async: false,
				success: function loaded() {
					if ($.visualize.plugins[type]) {
						next($.visualize.plugins[type]);
					} else {
						throw "Failed to load jquery.vizualize plugin " + type
						+ " in following location : " + this.url + "\n";
					}
				},
				error: function(xhr, b, err) {
					throw "Failed to load jquery.vizualize plugin " + type
					+ " in following location : " + this.url + "\n" + err.message;
				}

			});
		}
	}

	function defaultFormat(x) {
		return x;
	}

	/**-------------------------------------------------------------------- *
	 * DrawContext
	 * All chart plugins will inherit of this context properties
	 * and methods
 	 * -------------------------------------------------------------------- */
	function DrawContext(ctx) {
		$.extend(this, ctx); // copy the target, data and options attribute
	}

	/**
	 * The DrawContext prototype provides some common utility methods to all graph plugins
	 */
	DrawContext.prototype = {

		keys: function() {
			return this._keys || [];
		},

		/**
		 * Draw a serie of date along the X axis
		 * (Depends on lib/CalendarTools.js)
		 */
		drawDateRange: function(dateStart, dateEnd, options) {
			if (typeof(Date.add) != "function") throw "This method is dependant on CalendarTools";

			var ctx = this.target.canvasContext,
				canvas = this.target.canvas,
				w = canvas.width(), h = canvas.height(),
				i = 0, nextDate = dateStart,
				monthName = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jui", "Aou", "Sep", "Oct", "Nov", "Dec"];

			var bands = Date.elapsed("days", dateStart, dateEnd) + 1,
				dayBandWidth = (bands == 0) ? w : w / bands;

			// prepare helper functions
			// type = 0 : day, type = 1 : month, type = 2 : year
			var drawDateLine = function(i, type) {
				ctx.beginPath();
				ctx.lineWidth = [0.1, 2, 3][type];
				ctx.moveTo(dayBandWidth * i, 0);
				ctx.lineTo(dayBandWidth * i, h);
				ctx.strokeStyle = options.lineColors[type];
				ctx.stroke();
				ctx.closePath();
			};
			var drawWeekend = function(i) {
				ctx.beginPath();
				ctx.lineWidth = dayBandWidth*2;
				ctx.moveTo(dayBandWidth * (i + 1), 0);
				ctx.lineTo(dayBandWidth * (i + 1), h);
				ctx.strokeStyle = options.lineColors[3];
				ctx.stroke();
				ctx.closePath();
			};

			// insert list to contain day labels
			var xlabelsUL = $("<ul>").addClass("visualize-labels-x")
				.width(w).height(h)
				.insertBefore(canvas);

			while (nextDate <= dateEnd) {
				var dayNumber = nextDate.getDate();
				var $label = $("<span>").addClass("label").html(dayNumber); // display the day number

				$("<li>").css('left', dayBandWidth * i).width(dayBandWidth)
					.append($label).appendTo(xlabelsUL);

				// if the day labels are too large keep only 5, 10, 15, 20 ..
				if (($label.width() > (dayBandWidth * (dayNumber < 10 ? 0.5 : 0.9))
						&& (dayNumber % 5) && (dayNumber != 1))
					|| (dayNumber == 30 && $label.width() > dayBandWidth * 1.9) ) {
					$label.remove();
				}

				if (nextDate.getDay() == 6) { // saturday starts a weekend
					drawWeekend(i);
 				}

				// Draw date line
				if (dayNumber == 1) { // new month or new year
					$label.append($("<br>")).append(monthName[nextDate.getMonth()]);
					if (nextDate.getMonth()) { // getMonth() > 0
						drawDateLine(i, 1);
					} else { // january = new year
						drawDateLine(i, 2);
						$label.append($("<br>")).append(nextDate.getFullYear());
					}
				} else { // ordinary
					drawDateLine(i, 0);
				}

				nextDate = Date.add(nextDate, 1, "day"); i++;
			}
		},

		/**
		 * Available options :
		 * 	- centerLabels : use TRUE to center a categorie label in the middle of its region
		 * 	                 use FALSE to align numbers on their ticks
		 * 	- drawLines : TRUE of FALSE to draw the vertical line associated with the labels boundarie region
		 * 	- format : an optional format function to format numbers or dates
		 * @param xLabels the labels to write along the axis. numbers or texts
		 * @param options. when not passed, the method will try to figure by itself wether to center the label and to draw lines
		 */
		drawXAxis: function(xLabels, options) {

			var options = $.extend({}, options),
				ctx = this.target.canvasContext,
				canvas = this.target.canvas,
				w = canvas.width(), h = canvas.height(),
				centerLabels = (options.centerLabels !== undefined ? options.centerLabels : (isNaN(xLabels[0]))),
				drawLines = (options.drawLines !== undefined ? options.drawLines : !centerLabels),
				fmt = options.format || defaultFormat,
				bands = (xLabels.length - (centerLabels ? 0 : 1)),
				xBandWidth = (bands == 0) ? w : (w / bands);

			var xlabelsUL = $("<ul>")
					.addClass("visualize-labels visualize-labels-x")
					.width(w).height(h).insertBefore(canvas);

			if (centerLabels) {
				// Display centered labels
				$.each(xLabels, function(i, label) {
					var $label = $("<span>").addClass("label")
						.css({width: "100%", textAlign: "center"}).html(fmt(label));

					$("<li>").css('left', xBandWidth * i).width(xBandWidth)
						.append($label).appendTo(xlabelsUL);
				});

			} else { // Align labels on ticks
				$.each(xLabels, function(i, label) {
					var $label = $("<span>").addClass("label").html(fmt(label));

					$("<li>").css('left', xBandWidth * i).width(xBandWidth)
						.append($label).appendTo(xlabelsUL);

					if (i > 0) {
						$label.css("margin-left", -0.5 * $label.width());
					}
				});
			}

			if (drawLines) {
				ctx.beginPath();
				ctx.lineWidth = 0.1;

				$.each(xLabels, function(i, label) {
					ctx.moveTo(xBandWidth * (i + 1), 0);
					ctx.lineTo(xBandWidth * (i + 1), h);
				});

				ctx.strokeStyle = this.options.lineColors[0];
				ctx.stroke();
				ctx.closePath();
			}
		},

		/**
		 * Same options as drawXAxis.
		 * The Y labels are displayed from bottom to top.
		 */
		drawYAxis: function(yLabels, options) {

			var options = $.extend({}, options),
				ctx = this.target.canvasContext,
				canvas = this.target.canvas,
				w = canvas.width(), h = canvas.height(),
				centerLabels = (options.centerLabels !== undefined ? options.centerLabels : (isNaN(yLabels[0]))),
				drawLines = (options.drawLines !== undefined ? options.drawLines : !centerLabels),
				fmt = options.format || defaultFormat,
				bands = (yLabels.length - (centerLabels ? 0 : 1)),
				liHeight = (bands == 0) ? h : h / bands;

			var ylabelsUL = $("<ul>")
					.addClass("visualize-labels visualize-labels-y")
					.width(w).height(h).insertBefore(canvas);

			$.each(yLabels, function(i, label) {
				var $label = $("<span>").addClass("label").html(fmt(label));

				$("<li>").css(options.fromTop ? "top" : "bottom", liHeight*i + (centerLabels ? liHeight/2 : 0))
					.append($label).prependTo(ylabelsUL);

				// Slitghly reposition the label to center it on the median line
				$label.css('margin-top', -0.5 * $label.height());
			});

			if (drawLines) {
				ctx.beginPath();
				ctx.lineWidth = 0.1;

				$.each(yLabels, function(i, label) {
					ctx.moveTo(0, liHeight * (i + 1));
					ctx.lineTo(w, liHeight * (i + 1));
				});

				ctx.strokeStyle = this.options.lineColors[0];
				ctx.stroke();
				ctx.closePath();
			}
		}
	}; // DrawContext prototype


	/**-------------------------------------------------------------------- *
	 * Table scrapper object
	 * -------------------------------------------------------------------- */
	function TableData(table, options) {
		this.table = $(table);
		this.options = options;
		// private
		this.parse();
	}

	TableData.prototype = {

		parse: function() {
			var rowFilter = this.options.rowFilter,
			    colFilter = this.options.colFilter,
			    lines = [], lineHeaders = [], columnHeaders = [],
				cellParser = this.options.parser || parseFloat;

			$("tr", this.table).filter(rowFilter).each(function (i, tr) {
				var cells = [];
				$("th, td", $(tr)).filter(colFilter).each(function (j, td) {
					cells.push((i == 0) || (j == 0)? $(td).text() : cellParser($(td).text()));
				});
				if (i == 0) {
					cells.shift();
					columnHeaders = cells;
				} else {
					lineHeaders.push(cells.shift());
					lines.push(cells);
				}
			});

			var lcount = lines.length,
			    ccount = lines[0].length,
			    columns = [];

			for (var j = 0; j < ccount; j++) {
				var columnValues = [];
				for (var i = 0; i < lcount; i++) {
					columnValues.push(lines[i][j]);
				}
				columns.push(columnValues);
			}

			this.lineHeaders = lineHeaders;
			this.columnHeaders = columnHeaders;
			this.lines = lines;
			this.columns = columns;
		}
	}; // TableData prototype


	/**-------------------------------------------------------------------- *
	 * jQuery Visualize Plugin declaration
	 * Usage example :
	 * $("table.pie").visualize('pie', {percentage: true});
	 * -------------------------------------------------------------------- */

	var defaults = {
		type:'bar', //also available: area, pie, line
		appendTitle:true, //table caption text is added to chart
		title:null, //grabs from table caption if null
		appendKey:true, //color key is added to chart
		rowFilter:'*',
		colFilter:'*',
		colors:['#be1e2d', '#666699', '#92d5ea', '#ee8310', '#8d10ee', '#5a3b16', '#26a4ed', '#f45a90', '#e9e744'],
		lineColors:["#777", "#aaa", "#eee"],
		textColors:[], //corresponds with colors array. null/undefined items will fall back to CSS
		parseDirection:'x', //which direction to parse the table data

		pieMargin:20, //pie charts only - spacing around pie
		pieLabelsAsPercent:true,
		pieLabelPos:'inside',

		lineWeight:4, //for line and area - stroke weight
		barGroupMargin:10,
		barMargin:1, //space around bars in bar chart (added to both sides of bar)

		yLabelInterval:30 //distance between y labels
	};

 	$.fn.visualize = function(type, options, container) {

		if (typeof(type) != "string") { // Support for the old call form : visualize(options, container)
										// where options contains the type of the chart
			container = options;
			options = type || {};
			type = options.type || defaults.type;
		}

		var $tables = $(this); // we may have more  than one table in the selection

		loadChart( // loading may be asynchrone
			type,
			function visualize(chart) {

				//Merge configuration options
				var o = $.extend({}, defaults, chart.defaults, options);

				if (chart.parser) {
					// the chart plugin may redefine its own parser function
					o.parser = chart.parser;
				}

				$tables.each(function () {

					var $table = $(this);

					//reset width, height to numbers
					var w = o.width  = parseFloat(o.width  || $table.width());
					var h = o.height = parseFloat(o.height || $table.height());
					o.ticks = +o.ticks || Math.ceil(h / o.yLabelInterval);

					//create new canvas, set w&h attrs (not inline styles)
					var $canvas = $("<canvas>").attr("height", h).attr("width", w);
					//get title for chart
					var title = o.title || $table.find('caption').text();

					//create canvas wrapper div, set inline w&h, append
					var $canvasContainer = (container || $("<div>"))
						.addClass("visualize").addClass("visualize-" + type)
						.attr("role", "img").attr("aria-label", "Chart representing data from the table: " + title)
						.height(h).width(w)
						.append($canvas);

					//append new canvas to page
					if (!container) {
						$canvasContainer.insertAfter($table);
					}

					// excanvas initialization (IE only) see http://pipwerks.com/2009/03/12/lazy-loading-excanvasjs/
					if (typeof(G_vmlCanvasManager) != 'undefined') {
						G_vmlCanvasManager.init();
						G_vmlCanvasManager.initElement($canvas[0]);
					}

					// Scrap the table, set up the drawing context
					var tableData = new TableData($table, o),
						drawContext = new DrawContext({
							data: tableData,
							target:{
								container: $canvasContainer,
								canvas: $canvas,
								canvasContext: $canvas[0].getContext('2d')
							},
							options:o
						});

					// Apply (draw) chart to this context
					chart.apply(drawContext);

					//title/key container
					if (o.appendTitle || o.appendKey) {
						var $infoContainer = $("<div>").addClass("visualize-info").appendTo($canvasContainer);

						//append title
						if (o.appendTitle) {
							$("<div>").addClass("visualize-title").html(title).appendTo($infoContainer);
						}

						//append color keys of the series
						if (o.appendKey) {
							var $keys = $("<ul>").addClass("visualize-key");
							$.each(drawContext.keys(), function (i, key) {
								$("<li>")
									.append($("<span>").addClass("visualize-key-color").css("background", o.colors[i]))
									.append($("<span>").addClass("visualize-key-label").html(key))
									.appendTo($keys)
							});
							$keys.appendTo($infoContainer);
						}
					}

					if (!container) {
						//add event for updating
						$canvasContainer.bind('visualizeRefresh', function () {
							$table.visualize(o, $(this).empty());
						});
					}
				}); // $tables.each()
			}
		);

		return $tables; // Allow usual jQuery chainability on selector function

	};

})(jQuery);
