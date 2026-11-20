// Read-only: saves stills of 'GR FTUX . What is a Gift Registry' (tag gr-ftux-build, the comp with markers) via saveFrameToPng
// into ftux/verify/ae_frames/. $.global.SF_FRAMES = [..] (frames at 60 fps), $.global.SF_OUT = folder (optional).
var OUT_f = $.global.SF_OUT || "/Users/ssrawat/claude/gifting-registry-lottie/ftux/verify/ae_frames/";
var FR_f = $.global.SF_FRAMES || [6, 12, 18, 24, 30, 36, 45, 60, 75, 90, 150, 210, 270, 330];
new Folder(OUT_f).create();
var n_f = 0, c_f = null;
for (var i_f = 1; i_f <= app.project.numItems; i_f++) {
  var it_f = app.project.item(i_f);
  if (it_f instanceof CompItem && it_f.comment === "gr-ftux-build" && it_f.markerProperty.numKeys > 0) c_f = it_f;
}
for (var j_f = 0; j_f < FR_f.length; j_f++) {
  if (FR_f[j_f] / c_f.frameRate > c_f.duration + 1e-6) continue;
  c_f.saveFrameToPng(Math.min(FR_f[j_f] / c_f.frameRate, c_f.duration - 1e-4), new File(OUT_f + "ftux__f" + FR_f[j_f] + ".png")); n_f++;
}
$.global.RESULT = "queued " + n_f + " for " + c_f.name;
