// Read-only: renders 5 stills per comp via saveFrameToPng into exporter/ae_frames/. Does not modify the project.
var OUT = "/Users/ssrawat/claude/gifting-registry-lottie/occasions/exporter/ae_frames/";
var FR = [27, 45, 60, 96, 203];
var START = $.global.AF_START || 0, END = $.global.AF_END || 999;
function collect(f, out) { for (var i = 1; i <= f.numItems; i++) { var it = f.item(i);
  if (it instanceof FolderItem) collect(it, out); else if (it instanceof CompItem) out.push(it); } }
function safe(n) { return n.replace(/[^A-Za-z0-9 _.-]/g, "_"); }
var rootF = null, i, j;
for (i = 1; i <= app.project.numItems; i++) { var q = app.project.item(i); if (q instanceof FolderItem && q.name.indexOf("Occasion sets") >= 0) rootF = q; }
var comps = []; collect(rootF, comps);
new Folder(OUT).create();
var n = 0;
for (i = START; i < comps.length && i < END; i++) {
  for (j = 0; j < FR.length; j++) {
    comps[i].saveFrameToPng(FR[j] / 60, new File(OUT + safe(comps[i].name) + "__f" + FR[j] + ".png")); n++;
  }
}
$.global.RESULT = "queued " + n;
