// Gift Registry bottom sheet preview (dev reference): backdrop, scrim, sheet on the MOVE spring, the hero lottie comp
// (time-remapped so it holds frame 0 until it starts), rows popping in, button rising. Data from sheet_motion.py.
// ASCII only. Never saves the project.
var SPEC = /*SPEC*/null;
var NL = String.fromCharCode(10);
var LOG = new File(SPEC.log); LOG.encoding = "UTF-8"; LOG.open("w"); LOG.close();
var TAG = "gr-sheet";
var RESULT = "not finished";

function w(s) { LOG.open("a"); LOG.write(s + NL); LOG.close(); }
function findComp(name) {
  for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === name) return it; }
  return null;
}
function findFolder(name) {
  for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof FolderItem && it.name === name) return it; }
  return app.project.items.addFolder(name);
}
function importFile(path, folder) {
  var f = new File(path);
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { it.replace(f); return it; } } catch (e) {}
  }
  var nit = app.project.importFile(new ImportOptions(f)); nit.parentFolder = folder; return nit;
}
function tr(layer, mn) { return layer.property("ADBE Transform Group").property(mn); }
function keysAt(prop, k) {
  var ts = [], vs = [];
  for (var i = 0; i < k.length; i++) { ts.push(k[i][0]); vs.push(k[i][1]); }
  prop.setValuesAtTimes(ts, vs);
}
function shiftKeys(k, base) {   // [[t, dy]] -> [[t, [base x, base y + dy]]]
  var o = [];
  for (var i = 0; i < k.length; i++) o.push([k[i][0], [base[0], base[1] + k[i][1]]]);
  return o;
}
function rectLayer(comp, name, center, size, r, rgb, opacity) {
  var L = comp.layers.addShape(); L.name = name; L.comment = TAG;
  tr(L, "ADBE Anchor Point").setValue([0, 0]); tr(L, "ADBE Position").setValue([0, 0]);
  var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = "r";
  var c = L.property("ADBE Root Vectors Group").property("r").property("ADBE Vectors Group");
  var R = c.addProperty("ADBE Vector Shape - Rect"); R.name = "R";
  c = L.property("ADBE Root Vectors Group").property("r").property("ADBE Vectors Group");
  c.property("R").property("ADBE Vector Rect Size").setValue(size);
  c.property("R").property("ADBE Vector Rect Position").setValue(center);
  c.property("R").property("ADBE Vector Rect Roundness").setValue(r);
  var F = c.addProperty("ADBE Vector Graphic - Fill"); F.name = "Fill";
  c = L.property("ADBE Root Vectors Group").property("r").property("ADBE Vectors Group");
  c.property("Fill").property("ADBE Vector Fill Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
  if (opacity !== undefined) c.property("Fill").property("ADBE Vector Fill Opacity").setValue(opacity);
  return L;
}
function imageLayer(comp, item, center, name) {
  var L = comp.layers.add(item); L.name = name; L.comment = TAG;
  tr(L, "ADBE Position").setValue(center);
  return L;
}

try {
  w("start");
  var old = findComp(SPEC.comp.name);
  if (old) { if (old.comment === TAG) old.remove(); else throw new Error("a hand-made comp with this name exists; not touching it"); }
  var hero = findComp(SPEC.hero_comp);
  if (!hero) throw new Error("hero comp missing");
  var folder = findFolder("Gift registry sheet preview");
  var comp = app.project.items.addComp(SPEC.comp.name, SPEC.comp.w, SPEC.comp.h, 1, SPEC.comp.dur, SPEC.comp.fps);
  comp.comment = TAG; comp.parentFolder = folder; comp.bgColor = [0, 0, 0];
  w("comp");

  var bd = comp.layers.add(importFile(SPEC.backdrop, folder)); bd.name = "backdrop (Figma 2:33355)"; bd.comment = TAG;
  tr(bd, "ADBE Position").setValue([SPEC.comp.w / 2, SPEC.comp.h / 2]);
  var scr = rectLayer(comp, "scrim (black 80%)", [SPEC.comp.w / 2, SPEC.comp.h / 2], [SPEC.comp.w, SPEC.comp.h], 0, [0, 0, 0]);
  keysAt(tr(scr, "ADBE Opacity"), SPEC.scrim);
  w("backdrop + scrim");

  // sheet rig: identity at rest (anchor 50,50 at 50,50); Y travels on the MOVE spring
  var rig = comp.layers.addNull(); rig.name = "sheet (MOVE spring)"; rig.comment = TAG;
  tr(rig, "ADBE Anchor Point").setValue([50, 50]); tr(rig, "ADBE Position").setValue([50, 50]);
  var kids = [];
  var gr = rectLayer(comp, "grabber", SPEC.grabber.center, SPEC.grabber.size, 8, SPEC.grabber.color); kids.push(gr);
  var card = rectLayer(comp, "card", SPEC.card.center, SPEC.card.size, SPEC.card.r, [1, 1, 1]); kids.push(card);
  var hb = comp.layers.add(importFile(SPEC.hero_bg, folder)); hb.name = "hero bg (static, drawn by the app)"; hb.comment = TAG; kids.push(hb);
  tr(hb, "ADBE Anchor Point").setValue([0, 0]); tr(hb, "ADBE Position").setValue(SPEC.hero_pos);
  tr(hb, "ADBE Scale").setValue([100 * 2 / 2, 100 * 2 / 2]);
  var hl = comp.layers.add(hero); hl.name = "hero lottie (" + SPEC.hero_comp + ")"; hl.comment = TAG; kids.push(hl);
  tr(hl, "ADBE Anchor Point").setValue([0, 0]); tr(hl, "ADBE Position").setValue(SPEC.hero_pos);
  tr(hl, "ADBE Scale").setValue([SPEC.hero_scale, SPEC.hero_scale]);
  hl.timeRemapEnabled = true;
  var tm = hl.property("ADBE Time Remapping");
  var last = hero.duration - hero.frameDuration;
  hl.outPoint = comp.duration;
  tm.setValueAtTime(0, 0); tm.setValueAtTime(SPEC.hero_t, 0); tm.setValueAtTime(SPEC.hero_t + last, last);
  for (var kr = tm.numKeys; kr >= 1; kr--) {        // drop the default end key (never remove the last one: that hides the property)
    var kt = tm.keyTime(kr);
    if (Math.abs(kt) > 1e-4 && Math.abs(kt - SPEC.hero_t) > 1e-4 && Math.abs(kt - SPEC.hero_t - last) > 1e-4 && tm.numKeys > 1) tm.removeKey(kr);
  }
  for (var ki = 1; ki <= tm.numKeys; ki++) tm.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
  hl.outPoint = comp.duration;
  w("hero remap " + tm.numKeys);

  for (var ei = 0; ei < SPEC.els.length; ei++) {
    var E = SPEC.els[ei], L;
    if (E.sep) {
      L = comp.layers.addShape(); L.name = E.name + " (dotted)"; L.comment = TAG;
      tr(L, "ADBE Anchor Point").setValue([0, 0]); tr(L, "ADBE Position").setValue([0, 0]);
      L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").name = "s";
      var cc = function () { return L.property("ADBE Root Vectors Group").property("s").property("ADBE Vectors Group"); };
      cc().addProperty("ADBE Vector Shape - Group").name = "P";
      var sh = new Shape(); sh.vertices = E.sep; sh.inTangents = [[0, 0], [0, 0]]; sh.outTangents = [[0, 0], [0, 0]]; sh.closed = false;
      cc().property("P").property("ADBE Vector Shape").setValue(sh);
      cc().addProperty("ADBE Vector Filter - Trim").name = "Trim";
      cc().addProperty("ADBE Vector Graphic - Stroke").name = "Stroke";
      var St = cc().property("Stroke");
      St.property("ADBE Vector Stroke Color").setValue([2 / 255, 6 / 255, 12 / 255, 1]);
      cc().property("Stroke").property("ADBE Vector Stroke Opacity").setValue(15);
      cc().property("Stroke").property("ADBE Vector Stroke Width").setValue(2);
      cc().property("Stroke").property("ADBE Vector Stroke Line Cap").setValue(2);
      cc().property("Stroke").property("ADBE Vector Stroke Dashes").addProperty("ADBE Vector Stroke Dash 1");
      cc().property("Stroke").property("ADBE Vector Stroke Dashes").addProperty("ADBE Vector Stroke Gap 1");
      cc().property("Stroke").property("ADBE Vector Stroke Dashes").property("ADBE Vector Stroke Dash 1").setValue(1);
      cc().property("Stroke").property("ADBE Vector Stroke Dashes").property("ADBE Vector Stroke Gap 1").setValue(6);
      keysAt(cc().property("Trim").property("ADBE Vector Trim End"), E.trim);
    } else {
      L = imageLayer(comp, importFile(E.file, folder), E.center, E.name);
      if (E.scale) keysAt(tr(L, "ADBE Scale"), E.scale);
      if (E.dy) keysAt(tr(L, "ADBE Position"), shiftKeys(E.dy, E.center));
      if (E.op) keysAt(tr(L, "ADBE Opacity"), E.op);
    }
    kids.push(L);
  }
  w("elements " + SPEC.els.length);

  for (var p = 0; p < kids.length; p++) kids[p].parent = rig;     // before the rig gets keys: no compensation
  var rp = tr(rig, "ADBE Position"); rp.dimensionsSeparated = true;
  var ry = []; for (var q = 0; q < SPEC.sheet_dy.length; q++) ry.push([SPEC.sheet_dy[q][0], 50 + SPEC.sheet_dy[q][1]]);
  keysAt(tr(rig, "ADBE Position_1"), ry);

  var hm = rectLayer(comp, "home indicator", SPEC.home.center, SPEC.home.size, 10, [1, 1, 1]);
  keysAt(tr(hm, "ADBE Opacity"), SPEC.home_op);

  comp.time = 1.2;
  try { comp.openInViewer(); } catch (e) {}
  RESULT = "ok: " + comp.numLayers + " layers, " + comp.width + "x" + comp.height + ", " + comp.duration + "s";
  w(RESULT);
} catch (err) {
  RESULT = "ERROR line " + err.line + ": " + err.toString();
  w(RESULT);
}
RESULT;
