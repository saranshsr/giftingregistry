// GR FTUX "What is a Gift Registry?" -> comps in 01 Hero lotties (export these)/FTUX/. Generated data in SPEC (gen_build.py).
// ASCII only. Never saves or closes the project. Only edits or replaces comps it made itself (comment tag); the studio hero
// comp is only read (duplicated), never changed.
var SPEC = /*SPEC*/null;
var NL_f = String.fromCharCode(10);
var LOG_f = new File(SPEC.log); LOG_f.encoding = "UTF-8"; LOG_f.open("w"); LOG_f.close();
var TAG_f = SPEC.tag;
var RES_f = "not finished";

function w_f(s) { LOG_f.open("a"); LOG_f.write(s + NL_f); LOG_f.close(); }
function folderIn_f(parent, name) {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FolderItem && it.name === name && it.parentFolder === parent) return it;
  }
  var f = app.project.items.addFolder(name); f.parentFolder = parent; return f;
}
function compNamed_f(name) {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof CompItem && it.name === name) return it;
  }
  return null;
}
function importArt_f(path, folder) {
  var f = new File(path);
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { it.replace(f); return it; } } catch (e) {}
  }
  var nit = app.project.importFile(new ImportOptions(f)); nit.parentFolder = folder; return nit;
}
function easeDims_f(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) return 1;
  if (t === PropertyValueType.TwoD) return 2;
  if (t === PropertyValueType.ThreeD) return 3;
  return 1;
}
function sameVal_f(a, b) {
  if (typeof a === "number") return Math.abs(a - b) < 1e-6;
  for (var q = 0; q < a.length; q++) if (Math.abs(a[q] - b[q]) > 1e-6) return false;
  return true;
}
function fixDim_f(prop, v) {   // 2D values for 3-value props (scale of a 2D layer reports 3 dims)
  if (typeof v === "number") return v;
  var n = easeDims_f(prop) === 1 && prop.propertyValueType !== PropertyValueType.TwoD_SPATIAL && prop.propertyValueType !== PropertyValueType.ThreeD_SPATIAL ? 1 : 0;
  if (prop.propertyValueType === PropertyValueType.ThreeD && v.length === 2) return [v[0], v[1], 100];
  return v;
}
function setKeys_f(prop, keys) {
  var i, d;
  for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], fixDim_f(prop, keys[i][1]));
  var spatial = false; try { spatial = prop.isSpatial; } catch (e) {}
  for (i = 0; i < keys.length; i++) {
    var idx = prop.nearestKeyIndex(keys[i][0]);
    prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    var n = easeDims_f(prop), ei = [], eo = [];
    for (d = 0; d < n; d++) { ei.push(new KeyframeEase(0, Math.max(0.1, keys[i][2]))); eo.push(new KeyframeEase(0, Math.max(0.1, keys[i][3]))); }
    prop.setTemporalEaseAtKey(idx, ei, eo);
    if (spatial) {
      try { prop.setSpatialAutoBezierAtKey(idx, false); prop.setSpatialContinuousAtKey(idx, false);
            prop.setSpatialTangentsAtKey(idx, [0, 0], [0, 0]); prop.setRovingAtKey(idx, false); } catch (e) {}
    }
    if (i + 1 < keys.length && sameVal_f(keys[i][1], keys[i + 1][1]))
      prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.HOLD);
  }
}
function tr_f(layer, mn) { return layer.property("ADBE Transform Group").property(mn); }
function layerNamed_f(comp, name) {
  for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) return comp.layer(i);
  throw new Error("no layer '" + name + "' in " + comp.name);
}
function freshComp_f(name, w, h, dur, folder) {
  var c = compNamed_f(name);
  if (c && c.comment !== TAG_f) throw new Error("comp '" + name + "' exists and was not made by this script; stopping");
  if (!c) { c = app.project.items.addComp(name, w, h, 1, dur, SPEC.fps); c.comment = TAG_f; }
  c.parentFolder = folder;
  for (var i = c.numLayers; i >= 1; i--) c.layer(i).remove();
  c.width = w; c.height = h; c.pixelAspect = 1; c.frameRate = SPEC.fps; c.duration = dur; c.workAreaStart = 0; c.workAreaDuration = dur;
  c.bgColor = [0, 0, 0];   // saveFrameToPng premultiplies onto the comp colour; black keeps the diff (AE vs lottie on black) exact
  return c;
}
function keyVal_f(prop, k) { return prop.keyValue(k); }

// ---------------------------------------------------------------- hero art copy
function buildHero_f(folder) {
  var src = compNamed_f(SPEC.hero.src);
  if (!src) throw new Error("no comp " + SPEC.hero.src);
  var old = compNamed_f(SPEC.hero_comp);
  if (old) { if (old.comment !== TAG_f) throw new Error("hero copy exists and was not made by this script"); old.remove(); }
  var c = src.duplicate(); c.name = SPEC.hero_comp; c.comment = TAG_f; c.parentFolder = folder;
  c.duration = SPEC.t_end; c.workAreaStart = 0; c.workAreaDuration = SPEC.t_end;
  var i, j, k;
  for (i = 1; i <= c.numLayers; i++) { var L = c.layer(i); L.outPoint = SPEC.t_end; }
  // the float: drop the original idle keys, re-key it inside the loop
  for (i = 0; i < SPEC.hero.retime.length; i++) {
    var R = SPEC.hero.retime[i], p = tr_f(layerNamed_f(c, R[0]), R[1]);
    for (k = p.numKeys; k >= 1; k--) if (p.keyTime(k) > R[2] + 1e-4) p.removeKey(k);
    var last = p.numKeys;
    setKeys_f(p, R[3]);
    if (sameVal_f(p.keyValue(last), R[3][0][1])) p.setInterpolationTypeAtKey(last, p.keyInInterpolationType(last), KeyframeInterpolationType.HOLD);
  }
  // twinkles: move the tail keys later, keeping their eases
  for (i = 0; i < SPEC.hero.shift.length; i++) {
    var Sh = SPEC.hero.shift[i], q = tr_f(layerNamed_f(c, Sh[0]), Sh[1]), keep = [];
    for (k = 1; k <= q.numKeys; k++) if (q.keyTime(k) >= Sh[2] - 1e-4)
      keep.push({ t: q.keyTime(k), v: q.keyValue(k), ei: q.keyInTemporalEase(k), eo: q.keyOutTemporalEase(k), ii: q.keyInInterpolationType(k), io: q.keyOutInterpolationType(k) });
    for (k = q.numKeys; k >= 1; k--) if (q.keyTime(k) >= Sh[2] - 1e-4) q.removeKey(k);
    for (j = 0; j < keep.length; j++) {
      var nk = q.addKey(keep[j].t + Sh[3]); q.setValueAtKey(nk, keep[j].v);
    }
    for (j = 0; j < keep.length; j++) {
      var ix = q.nearestKeyIndex(keep[j].t + Sh[3]);
      q.setInterpolationTypeAtKey(ix, keep[j].ii, keep[j].io); q.setTemporalEaseAtKey(ix, keep[j].ei, keep[j].eo);
    }
  }
  // rotating images never rest on exactly 0 deg
  for (i = 0; i < SPEC.hero.rest_r0.length; i++) {
    var Z = SPEC.hero.rest_r0[i], r = tr_f(layerNamed_f(c, Z[0]), "ADBE Rotate Z");
    for (k = 1; k <= r.numKeys; k++) if (r.keyTime(k) >= Z[1] - 1e-4) r.setValueAtKey(k, r.keyValue(k) + 0.25);
  }
  w_f("hero copy: " + c.numLayers + " layers, " + c.duration + " s");
  return c;
}

// ---------------------------------------------------------------- rays precomp
function buildRays_f(folder, artFolder) {
  var R = SPEC.rays;
  var c = freshComp_f(SPEC.rays_comp, SPEC.hero_w, SPEC.hero_h, SPEC.t_end, folder);
  var rig = c.layers.addNull(); rig.name = "rays rig (bloom)"; rig.inPoint = 0; rig.outPoint = SPEC.t_end;
  tr_f(rig, "ADBE Anchor Point").setValue([50, 50]); tr_f(rig, "ADBE Position").setValue(R.pivot);
  setKeys_f(tr_f(rig, "ADBE Scale"), R.rig_scale);
  // source order bottom -> top: RAY_A, RAY_B, RAY_C, RAY_D, RAY_SWEEP (layers are added on top of each other)
  for (var i = R.layers.length - 1; i >= 0; i--) {
    var S = R.layers[i];
    var L = c.layers.add(importArt_f(SPEC.art_dir + "/" + S.file, artFolder)); L.name = S.name;
    L.startTime = 0; L.inPoint = 0; L.outPoint = SPEC.t_end; L.parent = rig;
    tr_f(L, "ADBE Anchor Point").setValue(S.anchor); tr_f(L, "ADBE Position").setValue([50, 50]);
    setKeys_f(tr_f(L, "ADBE Opacity"), S.op); setKeys_f(tr_f(L, "ADBE Rotate Z"), S.rot); setKeys_f(tr_f(L, "ADBE Scale"), S.scale);
  }
  rig.moveToBeginning();
  w_f("rays: " + c.numLayers + " layers");
  return c;
}

// ---------------------------------------------------------------- main comp
function addPiece_f(comp, P, artFolder, name, pivot) {
  var L = comp.layers.add(importArt_f(SPEC.art_dir + "/" + P.file, artFolder)); L.name = name;
  L.startTime = 0; L.inPoint = 0; L.outPoint = SPEC.t_end;
  var pv = pivot || [P.x + P.w / 2, P.y + P.h / 2];
  tr_f(L, "ADBE Anchor Point").setValue([pv[0] - P.x, pv[1] - P.y]); tr_f(L, "ADBE Position").setValue(pv);
  return L;
}
function buildMain_f(folder, artFolder, rays, hero) {
  var c = freshComp_f(SPEC.main, SPEC.w, SPEC.h, SPEC.t_end, folder);
  var mp = c.markerProperty;
  while (mp.numKeys > 0) mp.removeKey(1);
  var m1 = new MarkerValue("intro"); m1.duration = SPEC.t_in; mp.setValueAtTime(0, m1);
  var m2 = new MarkerValue("idle"); m2.duration = SPEC.t_end - SPEC.t_in; mp.setValueAtTime(SPEC.t_in, m2);
  // bottom -> top
  var bg = addPiece_f(c, SPEC.bg.piece, artFolder, "hero bg (Figma Onboarding background)");
  setKeys_f(tr_f(bg, "ADBE Opacity"), SPEC.bg.op);
  var rl = c.layers.add(rays); rl.name = "rays (clipped to the hero)"; rl.startTime = 0; rl.inPoint = 0; rl.outPoint = SPEC.t_end;
  tr_f(rl, "ADBE Position").setValue([SPEC.hero_w / 2, SPEC.hero_h / 2]);
  var hl = c.layers.add(hero); hl.name = "hero art (studio 17 Nov copy)"; hl.startTime = 0; hl.inPoint = 0; hl.outPoint = SPEC.t_end;
  tr_f(hl, "ADBE Position").setValue([SPEC.hero_w / 2, SPEC.hero_h / 2]);
  for (var i = 0; i < SPEC.cols.length; i++) {
    var C = SPEC.cols[i], n = (i + 1);
    if (C.div) {
      var D = C.div, sl = c.layers.addShape(); sl.name = "divider " + n;
      sl.startTime = 0; sl.inPoint = 0; sl.outPoint = SPEC.t_end;
      var g = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = "line";
      var gc = g.property("ADBE Vectors Group");
      var pg = gc.addProperty("ADBE Vector Shape - Group");
      var sh = new Shape(); sh.vertices = [[0, 0], [0, D.len]]; sh.inTangents = [[0, 0], [0, 0]]; sh.outTangents = [[0, 0], [0, 0]]; sh.closed = false;
      pg.property("ADBE Vector Shape").setValue(sh);
      var st = gc.addProperty("ADBE Vector Graphic - Stroke");
      st.property("ADBE Vector Stroke Color").setValue(D.color);
      st.property("ADBE Vector Stroke Width").setValue(D.w);
      st.property("ADBE Vector Stroke Line Cap").setValue(2);
      tr_f(sl, "ADBE Anchor Point").setValue([0, 0]); tr_f(sl, "ADBE Position").setValue([D.x, D.y0]);
      setKeys_f(tr_f(sl, "ADBE Scale"), D.scale); setKeys_f(tr_f(sl, "ADBE Opacity"), D.op);
    }
    var I = C.ico, il = addPiece_f(c, I.piece, artFolder, "icon " + n, I.pivot);
    setKeys_f(tr_f(il, "ADBE Scale"), I.scale); setKeys_f(tr_f(il, "ADBE Position"), I.pos); setKeys_f(tr_f(il, "ADBE Opacity"), I.op);
    var N = C.num, nl = addPiece_f(c, N.piece, artFolder, "number 0" + n, N.pivot);
    setKeys_f(tr_f(nl, "ADBE Scale"), N.scale); setKeys_f(tr_f(nl, "ADBE Rotate Z"), N.rot); setKeys_f(tr_f(nl, "ADBE Opacity"), N.op);
    var T = C.txt, tl = addPiece_f(c, T.piece, artFolder, "text " + n, T.pivot);
    setKeys_f(tr_f(tl, "ADBE Position"), T.pos); setKeys_f(tr_f(tl, "ADBE Opacity"), T.op);
  }
  c.time = SPEC.t_in;
  w_f("main: " + c.numLayers + " layers, " + c.width + "x" + c.height + ", " + c.duration + " s");
  return c;
}

try {
  w_f("start");
  var root_f = folderIn_f(app.project.rootFolder, SPEC.root);
  var fold_f = folderIn_f(root_f, SPEC.folder);
  var art_f = folderIn_f(fold_f, SPEC.artfolder);
  // empty an earlier main comp first so its hero copy can be replaced
  var oldMain_f = compNamed_f(SPEC.main);
  if (oldMain_f) { if (oldMain_f.comment !== TAG_f) throw new Error("main comp exists and was not made by this script"); for (var z = oldMain_f.numLayers; z >= 1; z--) oldMain_f.layer(z).remove(); }
  var hero_f = buildHero_f(fold_f);
  var rays_f = buildRays_f(fold_f, art_f);
  var main_f = buildMain_f(fold_f, art_f, rays_f, hero_f);
  RES_f = "ok: " + main_f.name + " | " + rays_f.name + " | " + hero_f.name;
  w_f(RES_f);
} catch (err) {
  RES_f = "ERROR line " + err.line + ": " + err.toString();
  w_f(RES_f);
}
RES_f;
