// Gift Registry 'Create' bottom sheet lotties -> comps in 01 Hero lotties (export these)/Bottom sheet/.
// Generated data in SPEC (gen_build.py, gen_build_portrait.py). ASCII only. Never saves or closes the project. Only touches comps it made (comment tag).
var SPEC = /*SPEC*/null;
var NL_s = String.fromCharCode(10);
var LOG_s = new File(SPEC.log); LOG_s.encoding = "UTF-8"; LOG_s.open("w"); LOG_s.close();
var TAG_s = "gr-sheet-build";
var RES_s = "not finished";

function w_s(s) { LOG_s.open("a"); LOG_s.write(s + NL_s); LOG_s.close(); }
function folderIn_s(parent, name) {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof FolderItem && it.name === name && it.parentFolder === parent) return it;
  }
  var f = app.project.items.addFolder(name); f.parentFolder = parent; return f;
}
function compIn_s(folder, name) {
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof CompItem && it.name === name) return it;
  }
  return null;
}
function importArt_s(path, folder) {
  var f = new File(path);
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { it.replace(f); return it; } } catch (e) {}
  }
  var nit = app.project.importFile(new ImportOptions(f)); nit.parentFolder = folder; return nit;
}
function easeDims_s(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) return 1;
  if (t === PropertyValueType.TwoD) return 2;
  if (t === PropertyValueType.ThreeD) return 3;
  return 1;
}
function sameVal_s(a, b) {
  if (typeof a === "number") return Math.abs(a - b) < 1e-6;
  for (var q = 0; q < a.length; q++) if (Math.abs(a[q] - b[q]) > 1e-6) return false;
  return true;
}
function setKeys_s(prop, keys) {
  var i, d;
  for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
  var spatial = false; try { spatial = prop.isSpatial; } catch (e) {}
  for (i = 0; i < keys.length; i++) {
    var idx = prop.nearestKeyIndex(keys[i][0]);
    prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    var n = easeDims_s(prop), ei = [], eo = [];
    for (d = 0; d < n; d++) { ei.push(new KeyframeEase(0, Math.max(0.1, keys[i][2]))); eo.push(new KeyframeEase(0, Math.max(0.1, keys[i][3]))); }
    prop.setTemporalEaseAtKey(idx, ei, eo);
    if (spatial) {   // straight-line travel between keys (no auto-bezier arcs)
      try { prop.setSpatialAutoBezierAtKey(idx, false); prop.setSpatialContinuousAtKey(idx, false);
            prop.setSpatialTangentsAtKey(idx, [0, 0], [0, 0]); prop.setRovingAtKey(idx, false); } catch (e) {}
    }
    // a rest between two equal keys becomes a HOLD: exporters turn equal-value bezier segments into bad handles (a jump)
    if (i + 1 < keys.length && sameVal_s(keys[i][1], keys[i + 1][1]))
      prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.HOLD);
  }
}
function tr_s(layer, mn) { return layer.property("ADBE Transform Group").property(mn); }

function buildComp_s(C, folder, artFolder) {
  var comp = compIn_s(folder, C.comp);
  if (comp && comp.comment !== TAG_s) throw new Error("comp '" + C.comp + "' exists and was not made by this script; stopping");
  var dur = C.t_end;
  if (!comp) { comp = app.project.items.addComp(C.comp, SPEC.w, SPEC.h, 1, dur, SPEC.fps); comp.comment = TAG_s; }
  comp.parentFolder = folder;
  for (var i = comp.numLayers; i >= 1; i--) comp.layer(i).remove();
  comp.width = SPEC.w; comp.height = SPEC.h; comp.pixelAspect = 1; comp.frameRate = SPEC.fps; comp.duration = dur;
  comp.workAreaStart = 0; comp.workAreaDuration = dur;
  // markers: intro (0 -> entrance end), idle (entrance end -> comp end)
  var mp = comp.markerProperty;
  while (mp.numKeys > 0) mp.removeKey(1);
  var m1 = new MarkerValue("intro"); m1.duration = C.t_in; mp.setValueAtTime(0, m1);
  var m2 = new MarkerValue("idle"); m2.duration = dur - C.t_in; mp.setValueAtTime(C.t_in, m2);

  var P = C.pieces, R = C.rig;
  var rig = comp.layers.addNull(); rig.name = "rig (entrance + float)"; rig.comment = TAG_s;
  rig.inPoint = 0; rig.outPoint = dur;
  tr_s(rig, "ADBE Anchor Point").setValue([50, 50]); tr_s(rig, "ADBE Position").setValue(R.pivot);
  var local = function (p) { return [p[0] - R.pivot[0] + 50, p[1] - R.pivot[1] + 50]; };
  var made = [];
  for (var li = 0; li < C.layers.length; li++) {
    var S = C.layers[li], pc = P[S.piece];
    var item = importArt_s(pc.path || (SPEC.piece_dir + "/" + C.card + "/" + pc.file), artFolder);
    var sc = pc.sc || 1;   // a piece drawn at sc x its pixel size (one sparkle image used at two sizes)
    var L = comp.layers.add(item); L.name = S.name; L.comment = TAG_s;
    L.startTime = 0; L.inPoint = 0; L.outPoint = dur;
    var pv = S.pivot || [pc.x + pc.w / 2, pc.y + pc.h / 2];
    var loc = S.noparent ? function (p) { return [p[0], p[1]]; } : local;
    if (!S.noparent) L.parent = rig;
    tr_s(L, "ADBE Anchor Point").setValue([(pv[0] - pc.x) / sc, (pv[1] - pc.y) / sc]);
    tr_s(L, "ADBE Position").setValue(loc(pv));
    tr_s(L, "ADBE Scale").setValue([100 * sc, 100 * sc]);
    if (S.scale) {
      var sk = [];
      for (var q0 = 0; q0 < S.scale.length; q0++) sk.push([S.scale[q0][0], [S.scale[q0][1][0] * sc, S.scale[q0][1][1] * sc], S.scale[q0][2], S.scale[q0][3]]);
      setKeys_s(tr_s(L, "ADBE Scale"), sk);
    }
    if (S.rot) setKeys_s(tr_s(L, "ADBE Rotate Z"), S.rot);
    if (S.opacity !== undefined) tr_s(L, "ADBE Opacity").setValue(S.opacity);
    if (S.op_keys) setKeys_s(tr_s(L, "ADBE Opacity"), S.op_keys);
    if (S.pos) {
      var pk = [];
      for (var q = 0; q < S.pos.length; q++) pk.push([S.pos[q][0], loc(S.pos[q][1]), S.pos[q][2], S.pos[q][3]]);
      setKeys_s(tr_s(L, "ADBE Position"), pk);
    }
    if (S.dy) {
      var pp = tr_s(L, "ADBE Position"); pp.dimensionsSeparated = true;
      var by = loc(pv)[1], dk = [];
      for (var q2 = 0; q2 < S.dy.length; q2++) dk.push([S.dy[q2][0], by + S.dy[q2][1], S.dy[q2][2], S.dy[q2][3]]);
      setKeys_s(tr_s(L, "ADBE Position_1"), dk);
    }
    made.push(S.name);
  }
  // rig on top of the stack so the layer order reads bottom -> top like the pieces
  rig.moveToBeginning();
  setKeys_s(tr_s(rig, "ADBE Scale"), R.scale);
  var rp = tr_s(rig, "ADBE Position"); rp.dimensionsSeparated = true;
  setKeys_s(tr_s(rig, "ADBE Position_1"), R.y);
  // layers were added bottom-first; AE puts each new layer on top, so the stack already matches
  comp.time = C.t_in;
  w_s(C.comp + ": " + comp.numLayers + " layers (" + made.join(", ") + "), " + dur + " s, intro " + C.t_in);
  return comp;
}

try {
  w_s("start");
  var root_s = folderIn_s(app.project.rootFolder, SPEC.root);
  var fold_s = folderIn_s(root_s, SPEC.folder);
  var art_s = folderIn_s(fold_s, SPEC.artfolder);
  var out_s = [];
  for (var ci = 0; ci < SPEC.comps.length; ci++) out_s.push(buildComp_s(SPEC.comps[ci], fold_s, art_s).name);
  RES_s = "ok: " + out_s.join(" | ");
  w_s(RES_s);
} catch (err) {
  RES_s = "ERROR line " + err.line + ": " + err.toString();
  w_s(RES_s);
}
RES_s;
