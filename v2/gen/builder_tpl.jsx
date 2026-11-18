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
  if (!comp) { comp = app.project.items.addComp(SPEC.comp.name, SPEC.comp.w, SPEC.comp.h, 1, SPEC.comp.dur, SPEC.comp.fps); comp.comment = TAG; }
  var A = SPEC.art, LS = SPEC.L;
  var manual = 0;
  for (var mi = 1; mi <= comp.numLayers; mi++) if (comp.layer(mi).comment !== TAG) manual++;
  if (manual > 0) throw new Error("comp has " + manual + " layers not made by this script; stopping");
  cleanComp(comp);
  w("cleaned");
  comp.width = SPEC.comp.w; comp.height = SPEC.comp.h;
  var DUR = comp.duration, FPS = comp.frameRate;
  w("comp " + comp.width + "x" + comp.height + " " + DUR + "s " + FPS + "fps");

  var folder = findFolder(SPEC.folder);
  var it = {};
  var files = SPEC.files;
  for (var fi = 0; fi < files.length; fi++) it[files[fi]] = importArt(A[files[fi]].file, folder);
  w("imported " + files.length);

  // ---- background precomp (base gradient, drifting waves, white fade) ----
  var old = findComp(SPEC.bgcomp);
  if (old && old.comment === TAG) { old.remove(); old = null; }
  var bgc = app.project.items.addComp(SPEC.bgcomp, comp.width, comp.height, 1, DUR, FPS);
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

  // ---- gift: box back, hearts, box front, lid on one rig null that pivots at the box's bottom middle ----
  // each JPEG piece carries its alpha matte as a child layer directly above it
  var G = LS.gift;
  var rig = comp.layers.addNull(); rig.name = "gift rig"; rig.comment = TAG;
  tr(rig, "ADBE Anchor Point").setValue([50, 50]); tr(rig, "ADBE Position").setValue(G.pivot);
  var local = function (p) { return [p[0] - G.pivot[0] + 50, p[1] - G.pivot[1] + 50]; };
  var photo = function (key, name, pivot) {        // jpg + matte; pivot (comp px) becomes the layer anchor
    var a = A[key], L = imageLayer(comp, it[key], a, name);
    var M_ = imageLayer(comp, it[key + "_a"], A[key + "_a"], name + " alpha (matte)");
    var pv = pivot || [a.x + a.w / 2, a.y + a.h / 2];
    L.parent = rig;
    tr(L, "ADBE Anchor Point").setValue([pv[0] - a.x, pv[1] - a.y]); tr(L, "ADBE Position").setValue(local(pv)); tr(L, "ADBE Scale").setValue([100, 100]);
    M_.parent = L;
    tr(M_, "ADBE Anchor Point").setValue([0, 0]); tr(M_, "ADBE Position").setValue([0, 0]); tr(M_, "ADBE Scale").setValue([100, 100]);
    w(name + " matte " + matte(L, M_));
    return L;
  };
  photo("box_back", "box back");
  for (var hi = 0; hi < LS.hearts.length; hi++) {
    var HE = LS.hearts[hi], ha = A[HE.key];
    var hL = imageLayer(comp, it[HE.key], ha, HE.key.replace("_", " "));
    hL.parent = rig;
    tr(hL, "ADBE Anchor Point").setValue([HE.pivot[0] - ha.x, HE.pivot[1] - ha.y]); tr(hL, "ADBE Scale").setValue([100, 100]);
    var hp = tr(hL, "ADBE Position"); hp.setValue(local(HE.pivot)); hp.dimensionsSeparated = true;
    var hb = local(HE.pivot)[1], hk = [];
    for (var q2 = 0; q2 < HE.dy.length; q2++) hk.push([HE.dy[q2][0], hb + HE.dy[q2][1], HE.dy[q2][2], HE.dy[q2][3]]);
    setKeys(tr(hL, "ADBE Position_1"), hk);
    setKeys(tr(hL, "ADBE Scale"), HE.scale);
  }
  photo("box_front", "box front");
  var lidL = photo("lid", "lid", LS.lid.pivot);
  var lpp = tr(lidL, "ADBE Position"); lpp.dimensionsSeparated = true;
  var lb = local(LS.lid.pivot)[1], lk = [];
  for (var q3 = 0; q3 < LS.lid.dy.length; q3++) lk.push([LS.lid.dy[q3][0], lb + LS.lid.dy[q3][1], LS.lid.dy[q3][2], LS.lid.dy[q3][3]]);
  setKeys(tr(lidL, "ADBE Position_1"), lk);
  setKeys(tr(lidL, "ADBE Rotate Z"), LS.lid.rot);
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

  // ---- sparkle lines (cropped from the gift picture): burst out from the box ----
  for (var pj = 0; pj < LS.sparks.length; pj++) {
    var SP = LS.sparks[pj];
    var pL = imageLayer(comp, it[SP.key], A[SP.key], "sparkle " + (pj + 1));
    setKeys(tr(pL, "ADBE Scale"), SP.scale);
    setKeys(tr(pL, "ADBE Position"), SP.pos);
  }
  w("sparks " + LS.sparks.length);

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

  comp.parentFolder = folder;
  // the no-bg twin: same comp minus the background and its corner matte
  var nb = findComp(SPEC.nobg);
  if (nb) { if (nb.comment === TAG) nb.remove(); else throw new Error("hand-made " + SPEC.nobg + " exists"); }
  var nbc = comp.duplicate(); nbc.name = SPEC.nobg; nbc.comment = TAG; nbc.parentFolder = folder;
  for (var nj = nbc.numLayers; nj >= 1; nj--) { var NL2 = nbc.layer(nj); if (NL2.name === "bg" || NL2.name === "bg corners (matte)") NL2.remove(); }
  comp.time = DUR - 1 / FPS;
  try { comp.openInViewer(); } catch (e) {}
  RESULT = "ok: " + comp.numLayers + " layers, " + comp.width + "x" + comp.height;
  w(RESULT);
} catch (err) {
  RESULT = "ERROR line " + err.line + ": " + err.toString();
  w(RESULT);
}
RESULT;
