// Portrait cards (copy of ae_frames.jsx -> verify/ae_frames_portrait/). Read-only: saves stills of the Bottom sheet comps via saveFrameToPng into sheet-illos/verify/ae_frames/. Does not modify the project.
// $.global.SF_FRAMES = [..] (frame numbers at 60 fps) and optional $.global.SF_ONLY = comp name.
var OUT_f = "/Users/ssrawat/claude/gifting-registry-lottie/sheet-illos/verify/ae_frames_portrait/";
var FR_f = $.global.SF_FRAMES || [10, 20, 30, 45, 75, 150, 284];
var ONLY_f = $.global.SF_ONLY || null;
function safe_f(n) { return n.replace(/[^A-Za-z0-9 _.-]/g, "_"); }
new Folder(OUT_f).create();
var n_f = 0, names_f = [];
for (var i_f = 1; i_f <= app.project.numItems; i_f++) {
  var c_f = app.project.item(i_f);
  if (!(c_f instanceof CompItem) || c_f.comment !== "gr-sheet-build") continue;
  if (c_f.name.indexOf("(portrait)") < 0) continue;
  if (ONLY_f && c_f.name !== ONLY_f) continue;
  names_f.push(c_f.name);
  for (var j_f = 0; j_f < FR_f.length; j_f++) {
    if (FR_f[j_f] / c_f.frameRate > c_f.duration) continue;
    c_f.saveFrameToPng(FR_f[j_f] / c_f.frameRate, new File(OUT_f + safe_f(c_f.name) + "__f" + FR_f[j_f] + ".png")); n_f++;
  }
}
$.global.RESULT = "queued " + n_f + " for " + names_f.join(" | ");
