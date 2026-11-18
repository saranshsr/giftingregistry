// Gift Registry hero -> the 'gifting ' comp. Generated data in SPEC (gen_build.py). ASCII only. Never saves the project.
var SPEC = /*SPEC*/null;
var NL = String.fromCharCode(10);
var LOG = new File(SPEC.log); LOG.encoding = "UTF-8"; LOG.open("w"); LOG.close();
var TAG = "gr-build";
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
function importArt(file, folder) {
  var f = new File(SPEC.art_dir + "/" + file);
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { it.replace(f); return it; } } catch (e) {}
  }
  var nit = app.project.importFile(new ImportOptions(f)); nit.parentFolder = folder; return nit;
}
function easeDims(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) return 1;
  if (t === PropertyValueType.TwoD) return 2;
  if (t === PropertyValueType.ThreeD) return 3;
  return 1;
}
function setKeys(prop, keys) {
  var i, d;
  for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
  for (i = 0; i < keys.length; i++) {
    var idx = prop.nearestKeyIndex(keys[i][0]);
    prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    var n = easeDims(prop), ei = [], eo = [];
    for (d = 0; d < n; d++) { ei.push(new KeyframeEase(0, Math.max(0.1, keys[i][2]))); eo.push(new KeyframeEase(0, Math.max(0.1, keys[i][3]))); }
    prop.setTemporalEaseAtKey(idx, ei, eo);
    // a rest between two equal keys becomes a HOLD: exporters turn equal-value bezier segments into bad handles (a jump)
    if (i + 1 < keys.length && sameVal(keys[i][1], keys[i + 1][1]))
      prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.HOLD);
  }
}
function sameVal(a, b) {
  if (typeof a === "number") return Math.abs(a - b) < 1e-6;
  for (var q = 0; q < a.length; q++) if (Math.abs(a[q] - b[q]) > 1e-6) return false;
  return true;
}
function tr(layer, mn) { return layer.property("ADBE Transform Group").property(mn); }
function root(layer) { return layer.property("ADBE Root Vectors Group"); }
function grp(layer, name) { return root(layer).property(name); }
function contentsOf(layer, name) { return grp(layer, name).property("ADBE Vectors Group"); }
function addPath(layer, gname, p, pname) {
  var g = contentsOf(layer, gname).addProperty("ADBE Vector Shape - Group"); g.name = pname;
  var s = new Shape(); s.vertices = p.v; s.inTangents = p.i; s.outTangents = p.o; s.closed = p.c;
  contentsOf(layer, gname).property(pname).property("ADBE Vector Shape").setValue(s);
}
function addFill(layer, gname, rgb) {
  var f = contentsOf(layer, gname).addProperty("ADBE Vector Graphic - Fill"); f.name = "Fill";
  var F = contentsOf(layer, gname).property("Fill");
  F.property("ADBE Vector Fill Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
  try { F.property("ADBE Vector Fill Rule").setValue(1); } catch (e) {}
}
function addStroke(layer, gname, rgb, width, join, cap) {
  var s = contentsOf(layer, gname).addProperty("ADBE Vector Graphic - Stroke"); s.name = "Stroke";
  var S = contentsOf(layer, gname).property("Stroke");
  S.property("ADBE Vector Stroke Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
  S.property("ADBE Vector Stroke Width").setValue(width);
  S.property("ADBE Vector Stroke Line Join").setValue(join);
  S.property("ADBE Vector Stroke Line Cap").setValue(cap);
}
function newGroup(layer, name) { var g = root(layer).addProperty("ADBE Vector Group"); g.name = name; return name; }
function shapeLayer(comp, name) {
  var L = comp.layers.addShape(); L.name = name; L.comment = TAG;
  tr(L, "ADBE Anchor Point").setValue([0, 0]); tr(L, "ADBE Position").setValue([0, 0]);
  return L;
}
function imageLayer(comp, item, a, name) {
  var L = comp.layers.add(item); L.name = name; L.comment = TAG;
  var sc = a.scale;
  tr(L, "ADBE Scale").setValue([sc, sc]);
  tr(L, "ADBE Anchor Point").setValue([a.w / 2, a.h / 2]);
  tr(L, "ADBE Position").setValue([a.x + a.w * sc / 200, a.y + a.h * sc / 200]);
  L.startTime = 0; L.inPoint = 0; L.outPoint = comp.duration;
  return L;
}
function matte(target, matteLayer) {
  try { target.setTrackMatte(matteLayer, TrackMatteType.ALPHA); return "setTrackMatte"; }
  catch (e) { target.trackMatteType = TrackMatteType.ALPHA; return "trackMatteType"; }
}
function cleanComp(comp) {
  for (var i = comp.numLayers; i >= 1; i--) {
    var L = comp.layer(i);
    if (L.comment !== TAG) continue;
    var src = null; try { if (L.nullLayer) src = L.source; } catch (e) {}
    L.remove();
    try { if (src && src.usedIn.length === 0) src.remove(); } catch (e) {}
  }
}

try {
  w("start");
  var comp = findComp(SPEC.comp.name);
  if (!comp) throw new Error("comp not found: [" + SPEC.comp.name + "]");
  var A = SPEC.art, LS = SPEC.L;
  var manual = 0;
  for (var mi = 1; mi <= comp.numLayers; mi++) if (comp.layer(mi).comment !== TAG) manual++;
  if (manual > 0) throw new Error("comp has " + manual + " layers not made by this script; stopping");
  cleanComp(comp);
  w("cleaned");
  comp.width = SPEC.comp.w; comp.height = SPEC.comp.h;
  var DUR = comp.duration, FPS = comp.frameRate;
  w("comp " + comp.width + "x" + comp.height + " " + DUR + "s " + FPS + "fps");

  var folder = findFolder("Gift registry art");
  var it = {};
  var files = ["bg_base", "bg_waves", "bg_fade", "gift_box", "gift_box_a", "star_green", "star_grey", "swoosh", "title_grad", "title_shadow"];
  for (var fi = 0; fi < files.length; fi++) it[files[fi]] = importArt(A[files[fi]].file, folder);
  w("imported " + files.length);

  // ---- background precomp (base gradient, drifting waves, white fade) ----
  var old = findComp("gifting bg");
  if (old && old.comment === TAG) { old.remove(); old = null; }
  var bgc = app.project.items.addComp("gifting bg", comp.width, comp.height, 1, DUR, FPS);
  bgc.comment = TAG; bgc.parentFolder = folder;
  imageLayer(bgc, it.bg_base, A.bg_base, "bg base");
  var wv = imageLayer(bgc, it.bg_waves, A.bg_waves, "bg waves");
  var wp = tr(wv, "ADBE Position"); var wx = wp.value[0];
  wp.dimensionsSeparated = true;
  var kx = []; for (var q = 0; q < LS.waves.dx.length; q++) { var k0 = LS.waves.dx[q]; kx.push([k0[0], wx + k0[1], k0[2], k0[3]]); }
  setKeys(tr(wv, "ADBE Position_0"), kx);
  setKeys(tr(wv, "ADBE Opacity"), LS.waves.op);
  imageLayer(bgc, it.bg_fade, A.bg_fade, "bg fade");
  w("bg precomp");

  var bgL = comp.layers.add(bgc); bgL.name = "bg"; bgL.comment = TAG;
  var bm = shapeLayer(comp, "bg corners (matte)");
  var bh = A.bg_h + 300;
  newGroup(bm, "rect");
  var rc = contentsOf(bm, "rect").addProperty("ADBE Vector Shape - Rect"); rc.name = "R";
  var R = contentsOf(bm, "rect").property("R");
  R.property("ADBE Vector Rect Size").setValue([comp.width, bh]);
  R.property("ADBE Vector Rect Position").setValue([comp.width / 2, bh / 2]);
  contentsOf(bm, "rect").property("R").property("ADBE Vector Rect Roundness").setValue(A.corner_r);
  addFill(bm, "rect", [1, 1, 1]);
  w("bg matte " + matte(bgL, bm));

  // ---- swoosh: the picture, revealed by a trimmed stroke along its own path ----
  var swL = imageLayer(comp, it.swoosh, A.swoosh, "swoosh");
  var sm = shapeLayer(comp, "swoosh draw (matte)");
  newGroup(sm, "path");
  addPath(sm, "path", A.swoosh_path, "P");
  var tp = contentsOf(sm, "path").addProperty("ADBE Vector Filter - Trim"); tp.name = "Trim";
  addStroke(sm, "path", [1, 1, 1], 44, 2, 2);
  setKeys(contentsOf(sm, "path").property("Trim").property("ADBE Vector Trim End"), LS.swoosh.trim);
  w("swoosh matte " + matte(swL, sm));

  // ---- gift box: JPEG + alpha matte, both on a rig null pivoting at the box's bottom middle ----
  var G = LS.gift;
  var rig = comp.layers.addNull(); rig.name = "gift rig"; rig.comment = TAG;
  tr(rig, "ADBE Anchor Point").setValue([50, 50]); tr(rig, "ADBE Position").setValue(G.pivot);
  var box = imageLayer(comp, it.gift_box, A.gift_box, "gift box");
  var boxA = imageLayer(comp, it.gift_box_a, A.gift_box_a, "gift box alpha (matte)");
  var gb = A.gift_box, lp = [gb.x + gb.w / 2 - G.pivot[0] + 50, gb.y + gb.h / 2 - G.pivot[1] + 50];
  box.parent = rig; boxA.parent = rig;
  tr(box, "ADBE Position").setValue(lp); tr(boxA, "ADBE Position").setValue(lp);
  tr(box, "ADBE Scale").setValue([100, 100]); tr(boxA, "ADBE Scale").setValue([100, 100]);
  w("box matte " + matte(box, boxA));
  setKeys(tr(rig, "ADBE Scale"), G.scale);
  setKeys(tr(rig, "ADBE Rotate Z"), G.rot);
  var rp = tr(rig, "ADBE Position"); rp.dimensionsSeparated = true;
  setKeys(tr(rig, "ADBE Position_1"), G.y);
  w("gift rig");

  // ---- stars (cropped from the gift picture) ----
  var stars = ["star_green", "star_grey"];
  for (var si = 0; si < 2; si++) {
    var sk = stars[si], S = LS[sk];
    var sL = imageLayer(comp, it[sk], A[sk], sk.replace("_", " "));
    setKeys(tr(sL, "ADBE Scale"), S.scale);
    setKeys(tr(sL, "ADBE Rotate Z"), S.rot);
  }
  w("stars");

  // ---- title: soft shadow, white outline, gradient picture matted by the letters ----
  var shL = imageLayer(comp, it.title_shadow, A.title_shadow, "title shadow");
  setKeys(tr(shL, "ADBE Opacity"), SPEC.L.shadow_op);
  var T = LS.title, pi, pk;
  var ol = shapeLayer(comp, "title outline");
  for (pi = 0; pi < T.length; pi++) {
    var gn = newGroup(ol, "p" + pi);
    for (pk = 0; pk < T[pi].outers.length; pk++) addPath(ol, gn, T[pi].outers[pk], "o" + pk);
    addStroke(ol, gn, [1, 1, 1], SPEC.outline_px, 2, 2);
    addFill(ol, gn, [1, 1, 1]);
    var gt = grp(ol, gn).property("ADBE Vector Transform Group");
    gt.property("ADBE Vector Anchor").setValue(T[pi].pivot); gt.property("ADBE Vector Position").setValue(T[pi].pivot);
    setKeys(grp(ol, gn).property("ADBE Vector Transform Group").property("ADBE Vector Scale"), T[pi].scale);
  }
  w("outline " + T.length);
  var grL = imageLayer(comp, it.title_grad, A.title_grad, "title gradient");
  var lt = shapeLayer(comp, "title letters (matte)");
  for (pi = 0; pi < T.length; pi++) {
    var gn2 = newGroup(lt, "p" + pi);
    for (pk = 0; pk < T[pi].paths.length; pk++) addPath(lt, gn2, T[pi].paths[pk], "s" + pk);
    addFill(lt, gn2, [0, 0, 0]);
    var gt2 = grp(lt, gn2).property("ADBE Vector Transform Group");
    gt2.property("ADBE Vector Anchor").setValue(T[pi].pivot); gt2.property("ADBE Vector Position").setValue(T[pi].pivot);
    setKeys(grp(lt, gn2).property("ADBE Vector Transform Group").property("ADBE Vector Scale"), T[pi].scale);
  }
  w("letters matte " + matte(grL, lt));

  comp.time = DUR - 1 / FPS;
  try { comp.openInViewer(); } catch (e) {}
  RESULT = "ok: " + comp.numLayers + " layers, " + comp.width + "x" + comp.height;
  w(RESULT);
} catch (err) {
  RESULT = "ERROR line " + err.line + ": " + err.toString();
  w(RESULT);
}
RESULT;
