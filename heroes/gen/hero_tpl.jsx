// Gift Registry page heroes: one comp per page, bg-free, lottie-safe (images, shapes, trim, alpha mattes, nulls).
// Data from gen_heroes.py. ASCII only. Never saves the project. A comp that already exists is left alone (it may have
// hand edits): delete or rename it first to rebuild it.
var SPEC = /*SPEC*/null;
var NL = String.fromCharCode(10);
var LOG = new File(SPEC.log); LOG.encoding = "UTF-8"; LOG.open("w"); LOG.close();
var TAG = "gr-hero";
var RESULT = [];

function w(s) { LOG.open("a"); LOG.write(s + NL); LOG.close(); }
function findItem(name, cls, parent) {
  for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i);
    if (it.name === name && it instanceof cls && (!parent || it.parentFolder === parent)) return it; }
  return null;
}
function folder(name, parent) {
  var f = findItem(name, FolderItem, parent || app.project.rootFolder);
  if (!f) { f = app.project.items.addFolder(name); if (parent) f.parentFolder = parent; }
  return f;
}
function importArt(path, fold) {
  var f = new File(path);
  for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i);
    try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { it.replace(f); it.mainSource.reload(); it.parentFolder = fold; return it; } } catch (e) {} }   // reload: replace() alone can keep a stale cached image
  var n = app.project.importFile(new ImportOptions(f)); n.parentFolder = fold; return n;
}
function easeDims(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) return 1;
  if (t === PropertyValueType.TwoD) return 2; if (t === PropertyValueType.ThreeD) return 3; return 1;
}
function sameVal(a, b) {
  if (typeof a === "number") return Math.abs(a - b) < 1e-6;
  for (var q = 0; q < a.length; q++) if (Math.abs(a[q] - b[q]) > 1e-6) return false;
  return true;
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
    if (i + 1 < keys.length && sameVal(keys[i][1], keys[i + 1][1]))
      prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.HOLD);
  }
}
function tr(L, mn) { return L.property("ADBE Transform Group").property(mn); }
function root(L) { return L.property("ADBE Root Vectors Group"); }
function grp(L, n) { return root(L).property(n); }
function contentsOf(L, n) { return grp(L, n).property("ADBE Vectors Group"); }
function addPath(L, g, p, nm) {
  contentsOf(L, g).addProperty("ADBE Vector Shape - Group").name = nm;
  var s = new Shape(); s.vertices = p.v; s.inTangents = p.i; s.outTangents = p.o; s.closed = p.c;
  contentsOf(L, g).property(nm).property("ADBE Vector Shape").setValue(s);
}
function addFill(L, g, rgb) {
  contentsOf(L, g).addProperty("ADBE Vector Graphic - Fill").name = "Fill";
  contentsOf(L, g).property("Fill").property("ADBE Vector Fill Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
  try { contentsOf(L, g).property("Fill").property("ADBE Vector Fill Rule").setValue(1); } catch (e) {}
}
function addStroke(L, g, rgb, wd, join, cap) {
  contentsOf(L, g).addProperty("ADBE Vector Graphic - Stroke").name = "Stroke";
  var S = function () { return contentsOf(L, g).property("Stroke"); };
  S().property("ADBE Vector Stroke Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
  S().property("ADBE Vector Stroke Width").setValue(wd);
  S().property("ADBE Vector Stroke Line Join").setValue(join);
  S().property("ADBE Vector Stroke Line Cap").setValue(cap);
}
function newGroup(L, n) { root(L).addProperty("ADBE Vector Group").name = n; return n; }
function shapeLayer(comp, name) {
  var L = comp.layers.addShape(); L.name = name; L.comment = TAG;
  tr(L, "ADBE Anchor Point").setValue([0, 0]); tr(L, "ADBE Position").setValue([0, 0]); return L;
}
function imageLayer(comp, item, a, name) {
  var L = comp.layers.add(item); L.name = name; L.comment = TAG;
  var sc = a.scale || 100;
  tr(L, "ADBE Scale").setValue([sc, sc]); tr(L, "ADBE Anchor Point").setValue([a.w / 2, a.h / 2]);
  tr(L, "ADBE Position").setValue([a.x + a.w * sc / 200, a.y + a.h * sc / 200]);
  L.startTime = 0; L.inPoint = 0; L.outPoint = comp.duration; return L;
}
function matte(target, m) {
  try { target.setTrackMatte(m, TrackMatteType.ALPHA); return "setTrackMatte"; }
  catch (e) { target.trackMatteType = TrackMatteType.ALPHA; return "trackMatteType"; }
}

function buildPage(P, rootF) {
  var pf;
  if (P.folder) { pf = rootF; for (var fi = 0; fi < P.folder.length; fi++) pf = folder(P.folder[fi], pf); }   // occasion sets
  else pf = folder(P.name.replace("GR hero ", ""), rootF);
  var existing = findItem(P.name, CompItem, null);
  if (existing) { if (existing.parentFolder !== pf) existing.parentFolder = pf; return P.name + ": exists, left as is"; }
  var af = folder("art", pf), sf = folder("_shared art (used by every occasion)", rootF);
  var comp = app.project.items.addComp(P.name, P.w, P.h, 1, SPEC.dur, SPEC.fps);
  comp.comment = TAG + " | Figma " + P.frame + " | " + P.title; comp.parentFolder = pf;
  var A = P.files, LS = P.L, it = {};
  for (var k in A) if (A.hasOwnProperty(k)) it[k] = importArt(A[k].path || (P.art_dir + "/" + A[k].file), A[k].shared ? sf : af);

  // swoosh: picture revealed by a trimmed stroke along its own outline would need the path; here a wiping matte:
  // a fat stroke along the swoosh's long axis (left -> right), trimmed
  var swL = imageLayer(comp, it.sw, A.sw, "swoosh");
  var sm = shapeLayer(comp, "swoosh draw (matte)");
  newGroup(sm, "path");
  var s0 = A.sw, midY = s0.y + s0.h / 2;
  addPath(sm, "path", { v: [[s0.x - 20, midY], [s0.x + s0.w + 20, midY]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false }, "P");
  contentsOf(sm, "path").addProperty("ADBE Vector Filter - Trim").name = "Trim";
  addStroke(sm, "path", [1, 1, 1], s0.h + 40, 2, 1);
  setKeys(contentsOf(sm, "path").property("Trim").property("ADBE Vector Trim End"), LS.swoosh.trim);
  matte(swL, sm);

  // illustration: JPEG + alpha matte (child of it) on a rig null at the body's bottom middle
  var I = LS.ill;
  var rig = comp.layers.addNull(); rig.name = "illustration rig"; rig.comment = TAG;
  tr(rig, "ADBE Anchor Point").setValue([50, 50]); tr(rig, "ADBE Position").setValue(I.pivot);
  var ill = imageLayer(comp, it.ill, A.ill, "illustration");
  var ima = imageLayer(comp, it.ill_a, A.ill_a, "illustration alpha (matte)");
  ill.parent = rig;
  tr(ill, "ADBE Position").setValue([A.ill.x + A.ill.w / 2 - I.pivot[0] + 50, A.ill.y + A.ill.h / 2 - I.pivot[1] + 50]);
  ima.parent = ill; tr(ima, "ADBE Anchor Point").setValue([0, 0]); tr(ima, "ADBE Position").setValue([0, 0]); tr(ima, "ADBE Scale").setValue([100, 100]);
  matte(ill, ima);
  setKeys(tr(rig, "ADBE Scale"), I.scale);
  setKeys(tr(rig, "ADBE Rotate Z"), I.rot);
  tr(rig, "ADBE Position").dimensionsSeparated = true;
  setKeys(tr(rig, "ADBE Position_1"), I.y);

  // bits (stars, sparkles, gems cut off the illustration)
  for (var b = 0; b < LS.bits.length; b++) {
    var B = LS.bits[b], bl = imageLayer(comp, it[B.key], A[B.key], "bit " + (b + 1) + " (" + B.key + ")");
    setKeys(tr(bl, "ADBE Scale"), B.scale);
    setKeys(tr(bl, "ADBE Position"), B.pos);
    if (B.rot) setKeys(tr(bl, "ADBE Rotate Z"), B.rot);
  }

  // title: soft shadow, white outline, gradient picture matted by the letters
  var sh = imageLayer(comp, it.title_shadow, A.title_shadow, "title shadow");
  setKeys(tr(sh, "ADBE Opacity"), LS.shadow_op);
  var T = LS.title, pi, pk;
  var ol = shapeLayer(comp, "title outline");
  for (pi = 0; pi < T.length; pi++) {
    var gn = newGroup(ol, "p" + pi);
    for (pk = 0; pk < T[pi].outers.length; pk++) addPath(ol, gn, T[pi].outers[pk], "o" + pk);
    addStroke(ol, gn, [1, 1, 1], P.outline_px, 2, 2); addFill(ol, gn, [1, 1, 1]);
    var gt = grp(ol, gn).property("ADBE Vector Transform Group");
    gt.property("ADBE Vector Anchor").setValue(T[pi].pivot); gt.property("ADBE Vector Position").setValue(T[pi].pivot);
    setKeys(grp(ol, gn).property("ADBE Vector Transform Group").property("ADBE Vector Scale"), T[pi].scale);
  }
  var grL = imageLayer(comp, it.title_grad, A.title_grad, "title gradient");
  var lt = shapeLayer(comp, "title letters (matte)");
  for (pi = 0; pi < T.length; pi++) {
    var g2 = newGroup(lt, "p" + pi);
    for (pk = 0; pk < T[pi].paths.length; pk++) addPath(lt, g2, T[pi].paths[pk], "s" + pk);
    addFill(lt, g2, [0, 0, 0]);
    var gt2 = grp(lt, g2).property("ADBE Vector Transform Group");
    gt2.property("ADBE Vector Anchor").setValue(T[pi].pivot); gt2.property("ADBE Vector Position").setValue(T[pi].pivot);
    setKeys(grp(lt, g2).property("ADBE Vector Transform Group").property("ADBE Vector Scale"), T[pi].scale);
  }
  matte(grL, lt);
  comp.time = comp.duration - comp.frameDuration;
  return P.name + ": built " + comp.numLayers + " layers";
}

try {
  w("start");
  var rootF = folder(SPEC.root, null);
  for (var p = 0; p < SPEC.pages.length; p++) { var r = buildPage(SPEC.pages[p], rootF); RESULT.push(r); w(r); }
} catch (err) { RESULT.push("ERROR line " + err.line + ": " + err.toString()); w(RESULT[RESULT.length - 1]); }
RESULT.join(" | ");
