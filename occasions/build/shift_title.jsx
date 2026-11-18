// Move the title animation earlier in every occasion hero comp (title pops with the illustration).
// Shifts every key on: "title outline" + "title letters (matte)" group scales, "title shadow" opacity, by DT seconds.
// Idempotent: a comp whose shadow opacity first key is not at OLD_SH (0.58 + 0.25 s) is skipped. Never saves.
var DT = -0.44, OLD_SH = 0.83, FR = 60;
function findItem(name, cls, parent) {
  for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i);
    if (it.name === name && it instanceof cls && (!parent || it.parentFolder === parent)) return it; }
  return null;
}
function shiftProp(p) {
  var n = p.numKeys; if (n === 0) return 0;
  var K = [];
  for (var i = 1; i <= n; i++) K.push({ t: p.keyTime(i), v: p.keyValue(i), ei: p.keyInTemporalEase(i), eo: p.keyOutTemporalEase(i),
    ii: p.keyInInterpolationType(i), oi: p.keyOutInterpolationType(i) });
  for (var j = n; j >= 1; j--) p.removeKey(j);
  for (var k = 0; k < K.length; k++) {
    var t = Math.round((K[k].t + DT) * FR) / FR;
    var idx = p.addKey(t); p.setValueAtKey(idx, K[k].v);
  }
  for (var m = 0; m < K.length; m++) {
    var ix = m + 1;
    p.setInterpolationTypeAtKey(ix, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    p.setTemporalEaseAtKey(ix, K[m].ei, K[m].eo);
    p.setInterpolationTypeAtKey(ix, K[m].ii, K[m].oi);
  }
  return K.length;
}
function groupScales(L) {
  var out = [], root = L.property("ADBE Root Vectors Group");
  for (var g = 1; g <= root.numProperties; g++) out.push(root.property(g).property("ADBE Vector Transform Group").property("ADBE Vector Scale"));
  return out;
}
var res = [];
var rootF = findItem("01 Hero lotties (export these)", FolderItem, app.project.rootFolder);
var sets = findItem("Occasion sets", FolderItem, rootF);
for (var i = 1; i <= app.project.numItems; i++) {
  var c = app.project.item(i);
  if (!(c instanceof CompItem) || c.name.indexOf("GR hero ") !== 0) continue;
  var f = c.parentFolder, inSets = false; while (f && f !== app.project.rootFolder) { if (f === sets) inSets = true; f = f.parentFolder; }
  if (!inSets) continue;
  var sh = c.layer("title shadow"), ol = c.layer("title outline"), lt = c.layer("title letters (matte)");
  var op = sh.property("ADBE Transform Group").property("ADBE Opacity");
  if (Math.abs(op.keyTime(1) - OLD_SH) > 0.009) { res.push(c.name + ": skipped (already shifted, shadow at " + op.keyTime(1) + ")"); continue; }
  var nk = shiftProp(op), ps = groupScales(ol).concat(groupScales(lt));
  for (var q = 0; q < ps.length; q++) nk += shiftProp(ps[q]);
  res.push(c.name + ": " + nk + " keys");
}
res.length + " comps | " + res.join(" | ");
