"""The page's styles: the chrome of wireframes.html, and the parts of the revision's frames."""

CSS = r"""
:root{
  /* Layout: a reading column for each screen, with its frames at the
     narrowest drawn width and the widest side by side, the 1440 frame scaled. */
  --bg:#f2f3f4; --surface:#ffffff; --ink:#1c2024; --muted:#59616a; --line:#cfd4d9; --accent:#33506a; --accent-ink:#ffffff;
  --wf-paper:#ffffff; --wf-ink:#262626; --wf-dim:#6b6b6b; --wf-line:#8f8f8f; --wf-soft:#d6d6d6; --wf-fill:#eeeeee; --wf-fill2:#c9c9c9; --wf-dark:#474747; --wf-scrim:rgba(0,0,0,.26);
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#15181b; --surface:#1d2124; --ink:#e6e8ea; --muted:#a2a9b0; --line:#3a4046; --accent:#a9c1d6; --accent-ink:#15181b;
    --wf-paper:#1f1f1f; --wf-ink:#e2e2e2; --wf-dim:#a6a6a6; --wf-line:#8a8a8a; --wf-soft:#4a4a4a; --wf-fill:#2c2c2c; --wf-fill2:#555555; --wf-dark:#d0d0d0; --wf-scrim:rgba(0,0,0,.5);
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --bg:#15181b; --surface:#1d2124; --ink:#e6e8ea; --muted:#a2a9b0; --line:#3a4046; --accent:#a9c1d6; --accent-ink:#15181b;
  --wf-paper:#1f1f1f; --wf-ink:#e2e2e2; --wf-dim:#a6a6a6; --wf-line:#8a8a8a; --wf-soft:#4a4a4a; --wf-fill:#2c2c2c; --wf-fill2:#555555; --wf-dark:#d0d0d0; --wf-scrim:rgba(0,0,0,.5);
  color-scheme:dark;
}
body{background:var(--bg);color:var(--ink);font:15px/1.55 var(--sans);margin:0}
#app{max-width:1520px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:24px 64px}
#app[data-lang="en"] .ko,#app[data-lang="ko"] .en{display:none}
code{font-family:var(--mono);font-size:.88em}
a{color:var(--accent)}
.top{display:flex;flex-direction:column;gap:12px;max-width:72ch}
.eyebrow{margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
h1{margin:0;font-size:clamp(26px,4vw,36px);line-height:1.15;text-wrap:balance}
.lede{margin:0;color:var(--muted)}
.controls{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}
.seg button{font:inherit;font-size:14px;border:0;background:transparent;color:var(--ink);padding:6px 12px;min-height:36px;cursor:pointer}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.seg button:focus-visible,.fit:focus-visible,.toc a:focus-visible,.more:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ctl-l{font-size:13px;color:var(--muted);margin-right:8px}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 8px}
.toc a{display:inline-flex;gap:6px;align-items:baseline;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:14px}
.toc a b{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--muted)}
.key{font-size:13px;color:var(--muted);max-width:90ch;margin:4px 0 0}
.screen{margin-top:40px;padding-top:24px;border-top:1px solid var(--line)}
.screen h2{margin:0;font-size:22px;line-height:1.25;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.screen h2 .sid{font-family:var(--mono);font-size:15px;color:var(--muted);font-weight:600}
.meta{margin:6px 0 0;font-size:13px;color:var(--muted);overflow-wrap:anywhere}
.purpose{margin:8px 0 0;max-width:72ch}
.na{margin:8px 0 0;font-size:13px;color:var(--muted);max-width:90ch}
.state{margin-top:28px}
.state h3{margin:0 0 6px;font-family:var(--mono);font-size:15px}
.cap{position:relative;max-width:90ch;font-size:14px}
.cap .txt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cap.open .txt{display:block}
.cap .from{margin:4px 0 0;font-family:var(--mono);font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.cap:not(.open) .from{display:none}
.cap.open .m1,.cap:not(.open) .m2{display:none}
.more{font:inherit;font-size:13px;border:0;background:none;color:var(--accent);padding:4px 0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.view{margin:14px 0 0;font-size:13px;font-weight:600}
.frames{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;margin-top:10px;align-items:start}
@media (min-width:860px){.frames{grid-template-columns:minmax(0,390px) minmax(0,1fr)}}
#app[data-widths="390"] .f1440,#app[data-widths="1440"] .f390{display:none}
#app[data-widths="1440"] .frames,#app[data-widths="390"] .frames{grid-template-columns:minmax(0,1fr)}
figure{margin:0;min-width:0}
figcaption{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:6px;font-family:var(--mono);flex-wrap:wrap}
.fit{font:inherit;font-size:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);padding:2px 8px;cursor:pointer;min-height:28px}
.fnote{margin:6px 0 0;font-size:12px;color:var(--muted)}
.vp{width:100%;overflow:hidden}
.vp.actual{overflow-x:auto}
/* ---- inside a frame: greys and the system font only ---- */
#app{word-break:keep-all;overflow-wrap:break-word}
.wf{position:relative;background:var(--wf-paper);color:var(--wf-ink);font:14px/1.45 var(--sans);border:1px solid var(--wf-line);overflow:hidden;box-sizing:border-box}
.wf *{box-sizing:border-box}
.wf.w390{width:390px;min-height:700px}
.wf.w1440{width:1440px;min-height:810px}
.wf.app{display:flex;flex-direction:column;min-height:0}
.wf p{margin:0}
.wf code{font-size:12px;overflow-wrap:anywhere}
.ln{display:inline-block;height:8px;border-radius:4px;background:var(--wf-soft);vertical-align:middle;max-width:100%}
.ln.dk{height:10px;background:var(--wf-fill2)}
.lns{display:flex;flex-direction:column;gap:6px;min-width:0;flex:none}
.fld > .lns,.row > .lns{flex:1 1 auto}
.bt{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 12px;border:1.5px solid var(--wf-ink);border-radius:6px;font-weight:600;font-size:13px;background:var(--wf-paper);text-align:center;line-height:1.2}
.bt.pri{background:var(--wf-dark);color:var(--wf-paper);border-color:var(--wf-dark)}
.bt.wait{border-style:dashed;color:var(--wf-dim);border-color:var(--wf-dim);background:transparent}
.lk{text-decoration:underline;text-underline-offset:2px;font-size:13px}
.lk.wait{color:var(--wf-dim);text-decoration-style:dashed}
.fld{border:1.5px solid var(--wf-line);border-radius:6px;padding:8px 10px;color:var(--wf-dim);min-height:36px;font-size:13px;display:flex;align-items:flex-start;min-width:0}
.fld.area{min-height:64px}
.fld.bad{border:2.5px solid var(--wf-ink)}
.fld.filled{color:var(--wf-ink)}
.ban{border:1.5px solid var(--wf-line);background:var(--wf-fill);border-radius:6px;padding:8px 10px;display:flex;gap:8px;align-items:flex-start;font-size:13px;min-width:0}
.ban.warn{border-style:dashed;border-color:var(--wf-ink);background:transparent}
.ban.err{border:2.5px solid var(--wf-ink);background:var(--wf-paper)}
.ban .bx{display:flex;flex-direction:column;gap:6px;min-width:0;overflow-wrap:anywhere;flex:1}
.ban .ic{flex:none;width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;display:inline-grid;place-items:center;font-size:11px;font-weight:700;line-height:1}
.tid{display:block;font-size:11px;color:var(--wf-dim);font-family:var(--mono)}
.h1{font-size:20px;font-weight:700}
.h2{font-size:16px;font-weight:700}
.h3{font-size:14px;font-weight:700}
.sm{font-size:12px;color:var(--wf-dim);min-width:0;overflow-wrap:anywhere}
.sm b{color:var(--wf-ink)}
.ink{color:var(--wf-ink)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}
.col{display:flex;flex-direction:column;gap:8px;min-width:0}
.grow{flex:1 1 auto;min-width:0}
.id{font-family:var(--mono);font-size:11px;border:1px solid var(--wf-line);border-radius:4px;padding:0 4px;white-space:nowrap;color:var(--wf-ink)}
.tag{font-size:11px;border:1px solid var(--wf-line);border-radius:999px;padding:0 8px;white-space:nowrap;color:var(--wf-ink)}
.tag.dk{background:var(--wf-dark);color:var(--wf-paper);border-color:var(--wf-dark)}
.also{border:1.5px dashed var(--wf-line);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0}
.also > .al{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--wf-dim)}
.rv{outline:2px dotted var(--wf-ink);outline-offset:3px;border-radius:3px;min-width:0;display:flex;flex-direction:column;gap:6px}
.rv.r{flex-direction:row;align-items:center;flex-wrap:wrap}
.rv.gap{gap:10px}
.rvo{outline:2px dotted var(--wf-ink);outline-offset:-4px}
span.rv{display:inline-flex}
.m24{display:flex;gap:6px;align-items:center;font-size:12px;font-weight:700}
.dia{width:9px;height:9px;background:var(--wf-dark);transform:rotate(45deg);flex:none;margin:0 3px;display:inline-block}
/* the top bar and the bars under it */
.tb{display:flex;gap:10px;align-items:center;padding:0 12px;border-bottom:1px solid var(--wf-line);height:52px;flex:none}
.w1440 .tb{padding:0 24px;gap:20px}
.brand{font-weight:800;font-size:16px;letter-spacing:.02em}
.tb .fld{min-height:34px;padding:6px 10px;align-items:center;width:340px}
.tb .bt{min-height:36px}
.w390 .tb .bt{min-height:44px}
.crumb{font-size:13px;display:flex;gap:6px;align-items:center;min-width:0}
.ib{width:28px;height:28px;border:1.5px solid var(--wf-ink);border-radius:6px;display:inline-grid;place-items:center;font-size:14px;font-weight:700;flex:none;background:var(--wf-paper);line-height:1}
.w390 .ib{width:44px;height:44px}
.ib.wait{border-style:dashed;border-color:var(--wf-dim);color:var(--wf-dim)}
.nbar{padding:8px 12px 0;flex:none}
.w1440 .nbar{padding:10px 24px 0}
.w1440 .hpw > .nbar{width:1200px;margin:0 auto;padding:16px 0 0}
/* the first page */
.hp{padding:16px 12px 24px;display:flex;flex-direction:column;gap:18px}
.w1440 .hp{width:1200px;margin:0 auto;padding:24px 0 32px;gap:24px}
.hcols{display:flex;flex-direction:column;gap:18px}
.w1440 .hcols{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:24px;align-items:start}
.sec{display:flex;flex-direction:column;gap:10px;min-width:0}
.me{border:1px solid var(--wf-line);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.me.rowy{display:grid;grid-template-columns:118px minmax(0,1fr) 150px;column-gap:16px;row-gap:10px;align-items:start}
.me.rowy > .actw{grid-column:1 / 4;display:flex;justify-content:flex-end}
.after{display:flex;flex-direction:column;gap:12px;min-width:0}
.me.rowy > .after{grid-column:2 / 4}
.rv + .rv,.rv + .cnts,.actw + .after,.me > .rv + .after{margin-top:6px}
.me.done{background:var(--wf-fill)}
.mb{display:flex;flex-direction:column;gap:10px;min-width:0}
.acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.w390 .acts{flex-direction:column;align-items:stretch}
.w390 .acts .bt{min-height:44px}
.w390 .acts .lk{min-height:44px;display:flex;align-items:center;justify-content:center}
.me.rowy .acts,.side .acts,.dp .acts{justify-content:flex-end}
.kv{display:flex;flex-direction:column;gap:6px;font-size:13px;min-width:0}
.w1440 .kv.line{flex-direction:row;flex-wrap:wrap;gap:6px 20px;align-items:baseline}
.kv > div{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;min-width:0}
.ato{border:1px solid var(--wf-line);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:12px;min-width:0}
.atp{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--wf-soft);padding-top:12px;min-width:0}
.cnts{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
.cnt2{display:flex;justify-content:space-between;gap:8px;font-size:13px;align-items:center;min-height:24px}
.w390 .cnt2{min-height:44px}
.pcards{display:grid;gap:12px}
.w1440 .pcards{grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.pcard{border:1px solid var(--wf-line);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.thumbs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.thumb{height:52px;border:1px solid var(--wf-line);border-radius:4px;background:repeating-linear-gradient(45deg,var(--wf-fill) 0 8px,var(--wf-soft) 8px 16px);display:flex;align-items:flex-end;padding:2px 4px;font-size:10px;font-family:var(--mono)}
.stg{display:grid;gap:4px;grid-template-columns:repeat(5,minmax(0,1fr))}
.w1440 .stg{grid-template-columns:repeat(13,minmax(0,1fr))}
.stg > span{border:1px solid var(--wf-line);border-radius:4px;padding:2px 4px;font-size:11px;display:flex;gap:3px;align-items:center;justify-content:space-between}
.stg em{font-style:normal;font-family:var(--mono);color:var(--wf-dim)}
/* the workspace */
.ws{display:flex;flex:1;min-height:0;position:relative}
.cl{width:248px;flex:none;border-right:1px solid var(--wf-line);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.whead{padding:12px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--wf-soft);flex:none}
.psw{display:flex;gap:4px;padding:8px 12px 0;flex:none}
.psw span{border:1px solid var(--wf-line);border-radius:6px;padding:2px 8px;font-size:12px;display:inline-flex;align-items:center;min-height:24px}
.w390 .psw span{min-height:44px}
.psw span.on{border:2px solid var(--wf-ink);font-weight:700}
.sl{padding:2px 8px 8px;display:flex;flex-direction:column;gap:1px;min-height:0}
.sg{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--wf-dim);margin:8px 6px 2px}
.sr{display:flex;gap:6px;align-items:center;font-size:12px;min-height:25px;padding:0 6px;border-radius:4px}
.w390 .sr{min-height:44px;font-size:13px}
.sr.on{box-shadow:inset 3px 0 0 var(--wf-ink);background:var(--wf-fill);font-weight:700}
.sr .n{font-family:var(--mono);color:var(--wf-dim);font-weight:400}
.sr .c{margin-left:auto;color:var(--wf-dim);font-size:11px;font-weight:400}
.mt{min-width:18px;height:16px;border-radius:8px;background:var(--wf-dark);color:var(--wf-paper);font-size:10px;display:inline-grid;place-items:center;padding:0 5px;font-weight:600;flex:none}
.leg{padding:8px 12px;border-top:1px solid var(--wf-soft);font-size:11px;color:var(--wf-dim);margin-top:auto;flex:none}
.rail{width:56px;flex:none;border-right:1px solid var(--wf-line);display:flex;flex-direction:column;min-height:0}
.rs{height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-family:var(--mono);position:relative;line-height:1.15;flex:none}
.rs.on{box-shadow:inset 3px 0 0 var(--wf-ink);font-weight:700;background:var(--wf-fill)}
.rs .mt{position:absolute;top:3px;right:3px;min-width:14px;height:14px;font-size:9px;padding:0 3px}
.rs.top{border-bottom:1px solid var(--wf-soft)}
.rs .shp{font-family:var(--sans);font-size:13px}
.cs{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}
.sh{padding:10px 16px;border-bottom:1px solid var(--wf-soft);display:flex;flex-direction:column;gap:6px;flex:none}
.w390 .sh{padding:8px 12px}
.sh .l1{display:flex;gap:6px 12px;align-items:center;flex-wrap:wrap}
.tools{display:flex;gap:8px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--wf-soft);flex-wrap:wrap;flex:none}
.w390 .tools{padding:6px 12px}
.w390 .tools .bt{min-height:44px}
.seg2{display:inline-flex;border:1.5px solid var(--wf-ink);border-radius:6px;overflow:hidden;font-size:13px;font-weight:600;flex:none}
.seg2 span{padding:0 10px;min-height:29px;display:flex;align-items:center}
.seg2 span.on{background:var(--wf-dark);color:var(--wf-paper)}
.seg2.wait{border-style:dashed;border-color:var(--wf-dim);color:var(--wf-dim)}
.seg2.wait span.on{background:var(--wf-fill);color:var(--wf-dim)}
.w390 .tools .seg2 span{min-height:41px}
.pc{position:relative;flex:1;min-height:0;background:var(--wf-fill);overflow:hidden}
.pc.sk{background:repeating-linear-gradient(45deg,var(--wf-fill) 0 10px,var(--wf-soft) 10px 20px)}
.nd{position:absolute;width:104px;height:58px;background:var(--wf-paper);border:1px solid var(--wf-line);border-radius:3px;padding:9px 8px;display:flex;flex-direction:column;gap:7px}
.nd.k2{background:var(--wf-soft)}
.nd.k2 .ln{background:var(--wf-fill2)}
.nd.sel{outline:3px solid var(--wf-ink);outline-offset:3px}
.nd.sel::after{content:"";position:absolute;inset:-12px;border:2px dotted var(--wf-ink);border-radius:4px}
.map{position:absolute;right:12px;bottom:12px;width:188px;height:118px;border:1px solid var(--wf-line);background:var(--wf-paper);padding:6px}
.w390 .map{width:120px;height:78px;bottom:68px}
.map i{display:block;border:1.5px solid var(--wf-ink);width:45%;height:50%}
.pleg{position:absolute;left:12px;bottom:12px;font-size:11px;background:var(--wf-paper);border:1px solid var(--wf-line);border-radius:4px;padding:4px 8px;color:var(--wf-dim)}
.zb{position:absolute;right:12px;bottom:12px;display:flex;gap:6px}
.flt{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px 16px;border-bottom:1px solid var(--wf-soft);flex:none}
.w390 .flt{padding:8px 12px}
.flt .fld{min-height:30px;padding:4px 10px;align-items:center;width:200px}
.frow{display:flex;gap:6px;align-items:center;margin-left:auto;min-width:0}
.w390 .frow{flex-basis:100%;margin-left:0}
.w390 .flt .fld{min-height:44px;flex:1;width:auto}
.w390 .flt .bt{min-height:44px}
.chip{border:1px solid var(--wf-line);border-radius:999px;padding:2px 10px;font-size:12px;min-height:26px;display:inline-flex;align-items:center;gap:4px}
.w390 .chip{min-height:44px}
.chip.on{border:2px solid var(--wf-ink);font-weight:700}
.il{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}
.gr{padding:6px 16px;background:var(--wf-fill);font-size:12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--wf-soft);flex:none}
.w390 .gr{padding:6px 12px}
.ir{display:flex;gap:10px;align-items:center;padding:0 16px;min-height:36px;border-bottom:1px solid var(--wf-soft);font-size:12px;flex:none}
.ir .i{width:112px;flex:none;display:flex;gap:6px;align-items:center}
.ir .t{flex:1;min-width:0;display:flex}
.ir .f{color:var(--wf-dim);white-space:nowrap}
.ir.on{box-shadow:inset 4px 0 0 var(--wf-ink);background:var(--wf-fill)}
.w390 .ir{flex-direction:column;align-items:stretch;gap:5px;padding:8px 12px;min-height:44px}
.w390 .ir .i{width:auto}
.w390 .ir .t{flex:none}
.w390 .ir .f{white-space:normal}
.goon{display:flex;gap:5px;justify-content:center;padding:12px 0;flex:none}
.goon i{width:4px;height:4px;border-radius:50%;background:var(--wf-line)}
/* the side: the talk, the item, the stage record */
.side{width:400px;flex:none;border-left:1px solid var(--wf-line);display:flex;flex-direction:column;min-height:0;background:var(--wf-paper)}
.tabc{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.ph{display:flex;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--wf-soft);font-weight:700;flex-wrap:wrap;flex:none;min-height:48px}
.w390 .ph{padding:8px 12px}
.w390 .ph .bt{min-height:44px}
.pb{flex:1;min-height:0;overflow:hidden;padding:12px 16px;display:flex;flex-direction:column;gap:12px}
.w390 .pb{padding:12px}
.pf{border-top:1px solid var(--wf-line);padding:10px 16px 12px;display:flex;flex-direction:column;gap:8px;flex:none}
.w390 .pf{padding:10px 12px 12px}
.w390 .pf .bt{min-height:44px}
.halves{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--wf-soft);flex:none}
.halves span{min-height:44px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;text-align:center}
.halves span + span{border-left:1px solid var(--wf-soft)}
.ent{display:flex;flex-direction:column;gap:8px;border:1px solid var(--wf-line);border-radius:8px;padding:10px;min-width:0;flex:none}
.ent.open{border:2.5px solid var(--wf-ink)}
.rep{border-left:3px solid var(--wf-soft);padding-left:8px;display:flex;flex-direction:column;gap:5px}
.gh{font-size:12px;font-weight:700;display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:none}
.tabs{display:flex;border-bottom:1px solid var(--wf-line);flex:none}
.tab{flex:1;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:600;border-bottom:3px solid transparent;line-height:1.2;padding:2px 4px;text-align:center;min-width:0}
.tab.on{border-bottom-color:var(--wf-ink)}
.tab .sub{font-size:11px}
.fields{display:grid;grid-template-columns:112px minmax(0,1fr);gap:4px 12px;font-size:12px;align-items:center}
.scrim{position:absolute;inset:0;background:var(--wf-scrim);z-index:1}
.sheet{position:absolute;left:0;right:0;bottom:0;max-height:85%;background:var(--wf-paper);border-top:2px solid var(--wf-ink);border-radius:14px 14px 0 0;display:flex;flex-direction:column;z-index:2;overflow:hidden}
.sheet.tall{height:85%}
.sheet::before{content:"";width:40px;height:4px;border-radius:2px;background:var(--wf-line);align-self:center;margin:8px 0 2px;flex:none}
/* the project's data */
.dp{position:absolute;z-index:2;background:var(--wf-paper);border:2px solid var(--wf-ink);border-top:0;border-radius:0 0 10px 10px;display:flex;flex-direction:column;overflow:hidden;left:324px;top:52px;width:640px;max-height:calc(100% - 68px)}
.drow{display:grid;grid-template-columns:176px minmax(0,1fr);gap:4px 12px;align-items:baseline;font-size:13px}
.w390 .drow{display:flex;flex-direction:column;gap:3px}
.dcnt{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:5px 0;border-bottom:1px solid var(--wf-soft)}
.dact{display:flex;gap:16px;align-items:center;justify-content:space-between}
.dact > .sm{flex:1;min-width:0}
.dact > .bt{flex:none}
.w390 .dact{flex-direction:column;align-items:stretch;gap:8px}
.w390 .dact .bt,.w390 .dp .bt,.w390 .sheet .bt{min-height:44px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px}
.w390 .two{display:flex;flex-direction:column;gap:10px}
.idl{font-size:12px;overflow-wrap:anywhere;line-height:1.9}
.idl .id{margin-right:4px}
.w390 .pf .acts{flex-direction:column;align-items:stretch}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
"""

JS = r"""
(function(){
  var app=document.getElementById('app');
  function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
  function setLang(l){app.setAttribute('data-lang',l);document.documentElement.setAttribute('lang',l);document.querySelectorAll('[data-set-lang]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-set-lang')===l))});store('nexus-wf-lang',l);fit()}
  function setWidths(v){app.setAttribute('data-widths',v);document.querySelectorAll('[data-set-widths]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-set-widths')===v))});fit()}
  function fit(){document.querySelectorAll('.vp').forEach(function(vp){var f=vp.firstElementChild,w=+vp.getAttribute('data-w');if(vp.classList.contains('actual')){f.style.zoom='1';return}var a=vp.clientWidth;if(!a)return;f.style.zoom=String(Math.min(1,a/w))})}
  document.querySelectorAll('[data-set-lang]').forEach(function(b){b.addEventListener('click',function(){setLang(b.getAttribute('data-set-lang'))})});
  document.querySelectorAll('[data-set-widths]').forEach(function(b){b.addEventListener('click',function(){setWidths(b.getAttribute('data-set-widths'))})});
  document.querySelectorAll('.fit').forEach(function(b){b.addEventListener('click',function(){var vp=b.closest('figure').querySelector('.vp');var on=vp.classList.toggle('actual');b.setAttribute('aria-pressed',String(on));fit()})});
  document.querySelectorAll('.more').forEach(function(b){b.addEventListener('click',function(){var c=b.closest('.cap');var on=c.classList.toggle('open');b.setAttribute('aria-expanded',String(on))})});
  var saved=store('nexus-wf-lang');
  var lang=saved==='ko'||saved==='en'?saved:((navigator.language||'').toLowerCase().indexOf('ko')===0?'ko':'en');
  setLang(lang);setWidths('both');
  window.addEventListener('resize',fit);
  if(window.ResizeObserver){var ro=new ResizeObserver(fit);document.querySelectorAll('.frames').forEach(function(f){ro.observe(f)})}
  if(location.hash){var t=document.getElementById(location.hash.slice(1));if(t)setTimeout(function(){t.scrollIntoView()},0)}
})();
"""
