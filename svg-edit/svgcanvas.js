var svgcanvas = null;

function svgCanvasInit(event) {
	svgcanvas = new SvgCanvas(event.target.ownerDocument);
	svgcanvas.setup(event);
	parent.SvgCanvas = svgcanvas;
}

function SvgCanvas(doc)
{

// private members

	var svgdoc = doc;
	var svgroot = svgdoc.documentElement;
	var svgns = "http://www.w3.org/2000/svg";
	var d_attr = null;
	var started = false;
	var shape = null;
	var obj_num = 1;
	var start_x = null;
	var start_y = null;
	var current_mode = "path";
	var current_fill = "none";
	var current_stroke = "black";
	var current_stroke_width = 1;
	var current_stroke_style = "none";
	var current_opacity = 1;
	var freehand_min_x = null;
	var freehand_max_x = null;
	var freehand_min_y = null;
	var freehand_max_y = null;

// private functions
	var getId = function() {
		return "svg_"+parent.wave.getViewer().getId()+"_"+obj_num;
	}

	var assignAttributes = function(node, attrs) {
		for (i in attrs) {
			node.setAttributeNS(null, i, attrs[i]);
		}
	}

	// remove unneeded attributes
	// makes resulting SVG smaller
	var cleanupElement = function(element) {
		if (element.getAttribute('fill-opacity') == '1')
			element.removeAttribute('fill-opacity');
		if (element.getAttribute('opacity') == '1')
			element.removeAttribute('opacity');
		if (element.getAttribute('stroke') == 'none')
			element.removeAttribute('stroke');
		if (element.getAttribute('stroke-dasharray') == 'none')
			element.removeAttribute('stroke-dasharray');
		if (element.getAttribute('stroke-opacity') == '1')
			element.removeAttribute('stroke-opacity');
		if (element.getAttribute('stroke-width') == '1')
			element.removeAttribute('stroke-width');
	}

	var updateSvgElementFromJson = function(data) {
		var shape = svgdoc.getElementById(data.id);
		var newshape = !shape;
		if (newshape) shape = svgdoc.createElementNS(svgns, data.element);
		assignAttributes(shape, data.attr);
		cleanupElement(shape);
		if (newshape) svgdoc.documentElement.appendChild(shape);
		return shape;
	}

	var addSvgElementFromJson = function(data) {
		var elem = updateSvgElementFromJson(data)
		sendElemState(elem);
		return elem;
	}

	var sendElemState = function (elem) {
		if (!parent.wave) return;
		var delta = {};
		var attrs = {};
		var a = elem.attributes;
		for(var i = 0; i < a.length; i++) {
			attrs[a.item(i).nodeName] = a.item(i).nodeValue;
		};
		var ob = { element: elem.nodeName,
				   attr: attrs };
		delta[elem.id] = parent.wave.util.printJson(ob,false);
		parent.wave.getState().submitDelta(delta);
	}


	var doClear = function() {
		var nodes = svgroot.childNodes;
		var len = svgroot.childNodes.length;
		var i = 0;
		for(var rep = 0; rep < len; rep++){
			if (nodes[i].nodeType == 1) { // element node
				nodes[i].parentNode.removeChild(nodes[i]);
			} else {
				i++;
			}
		}
	};

	var sendClear = function () {
		if (!parent.wave) return;
		parent.wave.getState().submitDelta({"special": "clear"});
	}

	var sendDelete = function (id) {
		if (!parent.wave) return;
		var delta = {};
		delta[id] = "null"; // FIXME: How to delete? The shared state will only grow, won't it?
		parent.wave.getState().submitDelta(delta);
	}

	var svgToString = function(elem, indent) {
		var out = "";
		if (elem) {
			var attrs = elem.attributes;
			var attr;
			var i;
			var childs = elem.childNodes;
			// don't include scripts in output svg
			if (elem.nodeName == "script") return "";
			for (i=0; i<indent; i++) out += "  ";
			out += "<" + elem.nodeName;
			for (i=attrs.length-1; i>=0; i--) {
				attr = attrs.item(i);
				// don't include events in output svg
				if (attr.nodeName == "onload" ||
					attr.nodeName == "onmousedown" ||
					attr.nodeName == "onmousemove" ||
					attr.nodeName == "onmouseup") continue;
				out += " " + attr.nodeName + "=\"" + attr.nodeValue+ "\"";
			}
			if (elem.hasChildNodes()) {
				out += ">\n";
				indent++;
				for (i=0; i<childs.length; i++)
				{
					if (childs.item(i).nodeType == 1) { // element node
						out = out + svgToString(childs.item(i), indent);
					} else if (childs.item(i).nodeType == 3) { // text node
						for (j=0; j<indent; j++) out += "  ";
						out += childs.item(i).nodeValue + "\n";
					}
				}
				indent--;
				for (i=0; i<indent; i++) out += "  ";
				out += "</" + elem.nodeName + ">\n";
			} else {
				out += " />\n";
			}
		}
		return out;
	}

// public events

	this.mouseDown = function(evt)
	{
		var x = evt.pageX;
		var y = evt.pageY;
		switch (current_mode)
		{
		case "path":
			started = true;
			d_attr = "M" + x + " " + y + " ";
			shape = addSvgElementFromJson({
				"element": "path",
				"attr": {
					"d": d_attr,
					"id": getId(),
					"fill": "none",
					"stroke": current_stroke,
					"stroke-width": current_stroke_width,
					"stroke-dasharray": current_stroke_style,
					"opacity": 0.5
				}
			});
			freehand_min_x = x;
			freehand_max_x = x;
			freehand_min_y = y;
			freehand_max_y = y;
			break;
		case "rect":
			started = true;
			start_x = x;
			start_y = y;
			shape = addSvgElementFromJson({
				"element": "rect",
				"attr": {
					"x": x,
					"y": y,
					"width": "1px",
					"height": "1px",
					"id": getId(),
					"fill": current_fill,
					"stroke": current_stroke,
					"stroke-width": current_stroke_width,
					"stroke-dasharray": current_stroke_style,
					"opacity": 0.5
				}
			});
			break;
		case "line":
			started = true;
			shape = addSvgElementFromJson({
				"element": "line",
				"attr": {
					"x1": x,
					"y1": y,
					"x2": x + 1 + "px",
					"y2": y + 1 + "px",
					"id": getId(),
					"stroke": current_stroke,
					"stroke-width": current_stroke_width,
					"stroke-dasharray": current_stroke_style,
					"opacity": 0.5
				}
			});
			break;
		case "ellipse":
			started = true;
			shape = addSvgElementFromJson({
				"element": "ellipse",
				"attr": {
					"cx": x,
					"cy": y,
					"rx": 1 + "px",
					"ry": 1 + "px",
					"id": getId(),
					"fill": current_fill,
					"stroke": current_stroke,
					"stroke-width": current_stroke_width,
					"stroke-dasharray": current_stroke_style,
					"opacity": 0.5
				}
			});
			break;
		case "delete":
			var t = evt.target;
			if (t == svgroot) return;
			var id = t.id
			t.parentNode.removeChild(t);
			sendDelete(id);
			break;
		}
	}

	this.mouseMove = function(evt)
	{
		if (!started) return;
		var x = evt.pageX;
		var y = evt.pageY;
		switch (current_mode)
		{
			case "line":
				shape.setAttributeNS(null, "x2", x);
				shape.setAttributeNS(null, "y2", y);
				break;
			case "rect":
				shape.setAttributeNS(null, "x", start_x < x ? start_x : x);
				shape.setAttributeNS(null, "width", Math.abs(x - start_x));
				shape.setAttributeNS(null, "y", start_y < y ? start_y : y);
				shape.setAttributeNS(null, "height", Math.abs(y - start_y));
				break;
			case "ellipse":
				var cx = shape.getAttributeNS(null, "cx");
				var cy = shape.getAttributeNS(null, "cy");
				shape.setAttributeNS(null, "rx", Math.abs(x - cx) );
				shape.setAttributeNS(null, "ry", Math.abs(y - cy) );
				break;
			case "path":
				d_attr += "L" + x + " " + y + " ";
				shape.setAttributeNS(null, "d", d_attr);
				break;
		}
	}

	this.mouseUp = function(evt)
	{
		if (!started || !shape) return;
		started = false;
		shape.setAttribute("opacity", current_opacity);
		obj_num++;
		cleanupElement(shape);
		sendElemState(shape);
		d_attr = null;
		shape = null;
	}

// public functions

	this.serialize = function(handler) {
		var str = "<?xml version=\"1.0\" standalone=\"no\"?>\n"
		str += "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
		str += svgToString(svgroot, 0);
		handler(str);
	}

	this.clear = function() {
		doClear();
		sendClear();
	}

	this.setMode = function(name) {
		current_mode = name;
	}

	this.setStrokeColor = function(color) {
		current_stroke = color;
	}

	this.setFillColor = function(color) {
		current_fill = color;
	}

	this.setStrokeWidth = function(val) {
		current_stroke_width = val;
	}

	this.setStrokeStyle = function(val) {
		current_stroke_style = val;
	}

	this.updateState = function(state) {
    	var keys = state.getKeys();		
		for (var i = 0; i < keys.length; ++i) {
			var k = keys[i];
			var v = state.get(k);
//alert("k="+k+", v="+v);
			if (k == "special") {
				if (v == "clear") doClear();
			} else {
				var ob;
				eval("ob="+v); // FIXME: Yes, I'm using eval... Dirty, dirty..
				if (ob) updateSvgElementFromJson(ob);
				else {
					var node = svgdoc.getElementById(k);
					if (node) node.parentNode.removeChild(node);
				}
			}
		}
	}

	this.setup = function(evt) {
		assignAttributes(svgroot, {
			"onmouseup":   "svgcanvas.mouseUp(evt)",
			"onmousedown": "svgcanvas.mouseDown(evt)",
			"onmousemove": "svgcanvas.mouseMove(evt)"
		});
	}

}
