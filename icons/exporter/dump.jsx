// Read-only dumper: writes one raw JSON per comp under "05 Icon lotties" into exporter/dump/. ASCII only. Never modifies the project.
var OUT = "/Users/ssrawat/claude/gifting-registry-lottie/icons/exporter/dump/";
var ONLY = (typeof $.global.DUMP_ONLY !== "undefined") ? $.global.DUMP_ONLY : null;
function Q(s) {
  var o = '"';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i), n = s.charCodeAt(i);
    if (c === '"') o += '\\"'; else if (c === "\\") o += "\\\\";
    else if (n < 32 || n > 126) { var h = n.toString(16); while (h.length < 4) h = "0" + h; o += "\\u" + h; }
    else o += c;
  }
  return o + '"';
}
function S(o) {
  if (o === null || o === undefined) return "null";
  var t = typeof o, i, a = [];
  if (t === "number") return isFinite(o) ? String(Math.round(o * 1e6) / 1e6) : "null";
  if (t === "boolean") return o ? "true" : "false";
  if (t === "string") return Q(o);
  if (o instanceof Array) { for (i = 0; i < o.length; i++) a.push(S(o[i])); return "[" + a.join(",") + "]"; }
  for (var k in o) if (o.hasOwnProperty(k)) a.push(Q(k) + ":" + S(o[k]));
  return "{" + a.join(",") + "}";
}
function cV(v) {
  if (typeof v === "number") return v;
  if (v instanceof Shape) return { vertices: v.vertices, inTangents: v.inTangents, outTangents: v.outTangents, closed: v.closed };
  if (v instanceof Array) { var r = []; for (var i = 0; i < v.length; i++) r.push(v[i]); return r; }
  return String(v);
}
function interp(t) {
  if (t === KeyframeInterpolationType.LINEAR) return "LINEAR";
  if (t === KeyframeInterpolationType.BEZIER) return "BEZIER";
  if (t === KeyframeInterpolationType.HOLD) return "HOLD";
  return "?";
}
function eases(a) { var r = []; for (var i = 0; i < a.length; i++) r.push([a[i].speed, a[i].influence]); return r; }
function dumpProp(p) {
  var r = { mn: p.matchName, nm: p.name }, i;
  if (p.propertyType === PropertyType.PROPERTY) {
    var pvt = p.propertyValueType;
    if (pvt === PropertyValueType.NO_VALUE || pvt === PropertyValueType.CUSTOM_VALUE) { r.novalue = true; return r; }
    r.en = p.enabled;
    try { if (p.expressionEnabled) r.expr = p.expression; } catch (e) {}
    try { r.spatial = p.isSpatial; } catch (e) {}
    if (p.numKeys > 0) {
      r.keys = [];
      for (i = 1; i <= p.numKeys; i++) {
        var k = { t: p.keyTime(i), v: cV(p.keyValue(i)), ii: interp(p.keyInInterpolationType(i)), io: interp(p.keyOutInterpolationType(i)) };
        try { k.ei = eases(p.keyInTemporalEase(i)); k.eo = eases(p.keyOutTemporalEase(i)); } catch (e) {}
        if (r.spatial) { try { k.ti = cV(p.keyInSpatialTangent(i)); k.to = cV(p.keyOutSpatialTangent(i)); k.rov = p.keyRoving(i); } catch (e) {} }
        r.keys.push(k);
      }
    } else r.v = cV(p.value);
  } else {
    r.group = true; r.en = p.enabled; r.props = [];
    if (p.matchName === "ADBE Transform Group" && false) return r;
    for (i = 1; i <= p.numProperties; i++) r.props.push(dumpProp(p.property(i)));
  }
  return r;
}
function dumpLayer(L) {
  var r = { index: L.index, name: L.name, en: L.enabled, shy: L.shy, solo: L.solo, inPoint: L.inPoint, outPoint: L.outPoint, startTime: L.startTime, stretch: L.stretch };
  r.parent = L.parent ? L.parent.index : null;
  r.isShape = (L instanceof ShapeLayer); r.isNull = !!L.nullLayer; r.isText = (L instanceof TextLayer);
  try { r.blend = String(L.blendingMode); r.blendNormal = (L.blendingMode === BlendingMode.NORMAL); } catch (e) {}
  try { r.threeD = L.threeDLayer; r.adjust = L.adjustmentLayer; r.motionBlur = L.motionBlur; r.collapse = L.collapseTransformation; } catch (e) {}
  try { r.isTrackMatte = L.isTrackMatte; } catch (e) {}
  try { r.hasTrackMatte = L.hasTrackMatte; } catch (e) {}
  try { r.matteType = (L.trackMatteType === TrackMatteType.ALPHA) ? "ALPHA" : (L.trackMatteType === TrackMatteType.NO_TRACK_MATTE ? "NONE" : "OTHER:" + L.trackMatteType); } catch (e) {}
  try { r.matteLayer = L.trackMatteLayer ? L.trackMatteLayer.index : null; } catch (e) {}
  try { r.timeRemap = L.timeRemapEnabled; } catch (e) {}
  try { r.numMasks = L.property("ADBE Mask Parade").numProperties; r.numEffects = L.property("ADBE Effect Parade").numProperties; } catch (e) {}
  r.kind = r.isShape ? "shape" : (r.isNull ? "null" : "other");
  try {
    if (!r.isShape && !r.isNull && L.source) {
      if (L.source instanceof CompItem) r.kind = "precomp";
      else if (L.source instanceof FootageItem) {
        r.kind = "footage"; r.srcW = L.source.width; r.srcH = L.source.height;
        r.file = (L.source.mainSource instanceof FileSource && L.source.file) ? L.source.file.fsName : null;
        try { r.hasAlpha = L.source.hasAlpha; r.srcName = L.source.name; } catch (e) {}
      }
    }
  } catch (e) { r.srcErr = String(e); }
  r.transform = dumpProp(L.property("ADBE Transform Group"));
  if (r.isShape) r.contents = dumpProp(L.property("ADBE Root Vectors Group"));
  return r;
}
function collect(f, out) {
  for (var i = 1; i <= f.numItems; i++) { var it = f.item(i);
    if (it instanceof FolderItem) collect(it, out); else if (it instanceof CompItem) out.push(it); }
}
function safe(n) { return n.replace(/[^A-Za-z0-9 _.-]/g, "_"); }
var rootF = null, i, j;
for (i = 1; i <= app.project.numItems; i++) { var q = app.project.item(i); if (q instanceof FolderItem && q.name.indexOf("05 Icon lotties") === 0) rootF = q; }
var comps = []; collect(rootF, comps);
new Folder(OUT).create();
var done = [];
for (i = 0; i < comps.length; i++) {
  var C = comps[i];
  if (ONLY && ONLY !== C.name) continue;
  var d = { name: C.name, w: C.width, h: C.height, fps: C.frameRate, dur: C.duration, frameDuration: C.frameDuration, numLayers: C.numLayers, folder: C.parentFolder.name, layers: [] };
  for (j = 1; j <= C.numLayers; j++) d.layers.push(dumpLayer(C.layer(j)));
  var f = new File(OUT + safe(C.name) + ".json"); f.encoding = "UTF-8"; f.open("w"); f.write(S(d)); f.close();
  done.push(C.name);
}
$.global.RESULT = done.length + " dumped, comps found " + comps.length + ": " + done.join(" | ");
