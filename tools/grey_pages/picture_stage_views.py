#!/usr/bin/env python3
"""Draws docs/09-mockup/nexus/picture-stage-views.html: the picture stage's column with its four views, in grey.

Stage 07's choice 18 and its note for stage 09 ask for the sheet. It reuses the parts of stage 08's wireframes
(wf_base, wf_frames, wf_css), so every label of a frame still comes from stage 08's words tables.
Run it again when the rows of SCR-112's head and tools or of SCR-111's columns change, from the repository's root:
python -W error tools/grey_pages/picture_stage_views.py [--out FILE]
tests/test_grey_pages.py draws the page and holds it to the committed file byte for byte; tools/grey_pages/README.md
says how to measure it in a browser.
"""
import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import wf_base as B  # noqa: E402
from wf_base import T, W, bt, div, dot, esc, grow, sm, span  # noqa: E402
from wf_css import CSS  # noqa: E402
import wf_frames as F  # noqa: E402

DRAWN = "2026-11-12"
OUT = B.ROOT.parent.parent / "09-mockup" / "nexus" / "picture-stage-views.html"

# The workspace's columns (stage 08, rule 16 and choice 23) and the frames' windows.
LIST, RAIL, TALK = 248, 56, 400
WINS = (1280, 1440)
HEIGHT = {1280: 800, 1440: 900}
FOLDS = ("shown", "folded")
VIEWS = ("picture", "list", "edit", "board")
# Excalidraw 0.18.1, the browser build's pin: under this width of its own box it lays itself out for a phone.
PHONE_BOX = 730
# The built list's fixed columns, gaps and paddings (nexus/ui/page.css, .nx .li): the title has the rest.
LIST_FIXED = 508
# The tools' line with the picture and the step control, in the redesign's look (measured in redesign.html).
TOOLS_EN, TOOLS_KO, STEPS_EN, TOOLS_PAD = 580, 572, 228, 20
# On a first visit the talk is a column from this width, and starts folded under it (the sheet's proposal).
FIRST_TALK = 1440
CUR = 1


def num(n):
    return "{:,}".format(n)


def stage_w(win, fold):
    return win - RAIL if fold == "folded" else win - LIST - TALK


def TT(en, ko):
    """Running text in both languages, with `code` spans."""
    return '<span class="en" lang="en">%s</span><span class="ko" lang="ko">%s</span>' % (B.md_inline(en), B.md_inline(ko))


# ------------------------------------------------------------------ the sheet's own marks
def co(n, inv=False):
    return span("co inv" if inv else "co", str(n))


def an(n, *kids):
    """A drawn part with its number: a rule under the part, the number at its corner."""
    return span("an", co(n), *kids)


def place(n, cls="", on=False):
    """A place that waits for the release that includes editing: a dashed box with its number."""
    return span(("pl %s%s" % (cls, " on" if on else "")).strip(), co(n, inv=on))


# ------------------------------------------------------------------ the column's parts
def head9(view, fold):
    editing = view in ("edit", "board")
    name = span("h2", F.stage_name(CUR))
    state = span("sm", W("◐ in progress"))
    counts = span("sm ink", dot(W("{n} contexts", n=7), W("{n} terms", n=42), W("{n} open hotspots", n=3)))
    commit = dot(W("Last checkpoint {date}", date="2026-11-08"), W("Commit {commit}", commit=F.COMMIT),
                 W("drawn {time}", time=F.TIMES[False]["drawn"]))
    p1 = place(1, on=view == "edit") if editing else ""
    talk = F.talk_button(CUR, show_rv=False) if fold == "folded" else ""
    return div("sh", div("l1", name, state, grow(), counts, p1, talk), sm(commit))


def tools9(view):
    editing = view in ("edit", "board")
    segs = [span("on" if view in ("picture", "edit") else "", W("Picture")), span("on" if view == "list" else "", W("List"))]
    if editing:
        segs.append(span("p2 on" if view == "board" else "p2", co(2, inv=view == "board")))
    if view == "picture":
        mid = an(3, span("ib", "−"), span("sm", "100%"), span("ib", "+"), bt(W("Fit")), bt(W("Go to")))
    elif view == "list":
        mid = ""
    else:
        mid = place(3, "wide")
    return div("tools", span("seg2", *segs), mid, grow(), an(4, bt(W("Stage record"))))


def steps9():
    """The step control of a DDD board, at the step that a board opens at: the whole board."""
    return div("stp", an(5, span("ib", "‹"), span("fld sf", span("", W("8-b–9 Map and tables")), span("", "▾")), span("ib", "›")))


def plate(view, win, fold):
    sw = stage_w(win, fold)
    if view == "edit":
        title = T("The editor, in the picture's place", "그림의 자리에 들어가는 편집기")
        what = TT("`#view=edit` · Phase ② draws this view (SPEC-134). Excalidraw draws its own tools inside this box.",
                  "`#view=edit` · 이 보기는 ② 차례가 그립니다(SPEC-134). Excalidraw는 자기 도구를 이 상자 안에 그립니다.")
    else:
        title = T("The part's work board", "부분의 작업 보드")
        what = TT("`#view=board` · Phase ② draws this view (SPEC-142): on stage 01 while a workshop is open, in Excalidraw.",
                  "`#view=board` · 이 보기는 ② 차례가 그립니다(SPEC-142): 01단계에서 워크숍이 열려 있는 동안, Excalidraw로.")
    kids = [span("pt", title), span("", what),
            span("", T("This box: %s px wide" % num(sw), "이 상자: 너비 %s픽셀" % num(sw)))]
    if sw < PHONE_BOX:
        kids.append(span("pw", T("Under %d px: Excalidraw 0.18.1 lays itself out for a phone here." % PHONE_BOX,
                                 "%d픽셀보다 좁습니다: Excalidraw 0.18.1이 여기서는 휴대폰 배치를 씁니다." % PHONE_BOX)))
    return div("rg", div("plate", *kids))


PIC_COLS = {632: 4, 792: 6, 1224: 9, 1384: 10}
LIST_ROWS = {(1280, "shown"): 12, (1280, "folded"): 13, (1440, "shown"): 16, (1440, "folded"): 16}


def region(view, win, fold):
    if view == "picture":
        return steps9() + F.picture(1440, cols=PIC_COLS[stage_w(win, fold)])
    if view == "list":
        return F.doc_list(1440, prefix="TERM", rv_row=False, nrows=LIST_ROWS[(win, fold)])
    return plate(view, win, fold)


VIEW_NAMES = {"picture": ("The picture", "그림"), "list": ("The list", "목록"), "edit": ("The editor", "편집기"),
              "board": ("The work board", "작업 보드")}
FOLD_NAMES = {"shown": ("columns shown", "열을 편 모습"), "folded": ("columns folded", "열을 접은 모습")}


def frame(view, win, fold):
    stage = head9(view, fold) + tools9(view) + region(view, win, fold)
    if fold == "folded":
        left = F.rail(CUR, False).replace('class="rail rvo"', 'class="rail"', 1)
        side = ""
    else:
        left = F.list_col(1440, CUR)
        side = F.talk_side(1440, CUR, "CTX-003")
    inner = F.tb_ws(1440, CUR) + div("ws", left, div("cs", stage), side)
    cls = "wf w1440 app v9" + (" w1280" if win == 1280 else "")
    label = "%s, %s px, %s" % (VIEW_NAMES[view][0], num(win), FOLD_NAMES[fold][0])
    return '<div class="%s" data-view="%s" data-width="%d" data-fold="%s" role="img" aria-label="%s" style="height:%dpx">%s</div>' % (
        cls, view, win, fold, html.escape(label, quote=True), HEIGHT[win], inner)


def ruler(win, fold):
    sw = stage_w(win, fold)
    st = '<span class="st" style="width:%dpx"><b>%s</b></span>' % (sw, T("The stage · %s px" % num(sw), "단계 · %s px" % num(sw)))
    if fold == "folded":
        return '<div class="rul"><span style="width:%dpx"><b>%d</b></span>%s</div>' % (RAIL, RAIL, st)
    return '<div class="rul"><span style="width:%dpx"><b>%s</b></span>%s<span style="width:%dpx"><b>%s</b></span></div>' % (
        LIST, T("List of stages · %d" % LIST, "단계 목록 · %d" % LIST), st, TALK, T("Talk · %d" % TALK, "대화 · %d" % TALK))


def figure(view, win, fold):
    sw = stage_w(win, fold)
    cap = "%s px · %s · %s" % (num(win), T(*FOLD_NAMES[fold]), T("the stage %s px" % num(sw), "단계 %s px" % num(sw)))
    fit = '<button type="button" class="fit" aria-pressed="false">%s</button>' % T("Actual size", "실제 크기")
    return ('<figure data-win="%d" data-fold="%s"><figcaption><span>%s</span>%s</figcaption>'
            '<div class="vp" data-w="%d"><div class="fw" style="width:%dpx">%s%s</div></div></figure>') % (
        win, fold, cap, fit, win, win, ruler(win, fold), frame(view, win, fold))


# ------------------------------------------------------------------ the page's text
PLACES = [
    ("The head's right end, after the counts and before the folded talk's button: the control that starts editing. It waits "
     "for the release that includes editing; until then nothing stands there, and the counts reach the end (stage 08, rule 23).",
     "머리의 오른쪽 끝, 수 다음이고 접힌 대화의 단추 앞: 편집을 시작하는 조작의 자리입니다. 편집이 든 릴리스를 기다리며, "
     "그때까지는 아무것도 없고 수가 끝까지 닿습니다(08단계, 규칙 23)."),
    ("The third place of Picture and List, after List: the part's work board, on stage 01 while a workshop is open. "
     "It waits the same way.",
     "그림과 목록의 셋째 자리, 목록 다음: 부분의 작업 보드이며, 워크숍이 열려 있는 동안 01단계에 있습니다. 같은 식으로 기다립니다."),
    ("Between Picture and List and Stage record: the tools of the view that shows. With the picture, the zoom, Fit and Go to; "
     "with the list, none; with the editor and the work board, what phase ② draws there.",
     "그림과 목록, 그리고 단계 기록 사이: 지금 보이는 보기의 도구입니다. 그림이면 확대 단추와 비율, 맞추기, 바로 가기이고, "
     "목록이면 없으며, 편집기와 작업 보드이면 ② 차례가 거기에 그리는 것입니다."),
    ("Stage record, at the right end of the tools' line in every view.",
     "단계 기록: 어느 보기에서나 도구 줄의 오른쪽 끝입니다."),
    ("The step control of a DDD board: a line of its own under the tools, with the picture only.",
     "DDD 보드의 스텝 고르기: 도구 아래 자기 줄에, 그림일 때만 있습니다."),
]

SETTLES = [
    ("**One column, four views.** The head, the tools' line and the view's region are the column's; the picture's tools, the "
     "step control, the map and the legend are the picture's. TASK-275 builds the picture as one view of the column, so that the "
     "list, and later the editor and the work board, take the same region and the head does not move.",
     "**열 하나에 보기 넷.** 머리, 도구 줄, 보기의 영역은 열의 것이고, 그림의 도구, 스텝 고르기, 지도, 표시의 설명은 그림의 "
     "것입니다. TASK-275는 그림을 이 열의 보기 하나로 만들어, 목록이, 그리고 나중에 편집기와 작업 보드가 같은 영역에 들어가고 "
     "머리는 움직이지 않게 합니다."),
    ("**The tools' line.** Picture and List first, then the view's tools, and Stage record at the right end. In the redesign's "
     "look its five parts with the picture measure %d pixels in English and %d in Korean, and the line has %d at a stage of %d "
     "pixels and %d at %d: one line at every drawn width. It wraps where its parts do not fit, and never leaves the column."
     % (TOOLS_EN, TOOLS_KO, 632 - 2 * TOOLS_PAD, 632, 792 - 2 * TOOLS_PAD, 792),
     "**도구 줄.** 그림과 목록이 먼저, 그다음 보기의 도구, 오른쪽 끝에 단계 기록입니다. 다시 디자인의 생김새에서 그림일 때의 "
     "다섯 부분은 영어로 %d픽셀, 한국어로 %d픽셀이고, 줄의 자리는 단계가 %d픽셀일 때 %d, %d일 때 %d입니다: 그린 폭 어디서나 "
     "한 줄입니다. 부분이 들어가지 않는 곳에서는 줄을 바꾸고, 열 밖으로 나가지 않습니다."
     % (TOOLS_EN, TOOLS_KO, 632, 632 - 2 * TOOLS_PAD, 792, 792 - 2 * TOOLS_PAD)),
    ("**The step control.** A line of its own under the tools at every width from 1,024 pixels, as redesign.html draws it in "
     "`SCR-112#large`. On the tools' line it would need %d pixels, %d and %d with a gap of 8, which no stage beside both columns "
     "has; and a control that changed lines as a column folds would move under the hand."
     % (TOOLS_EN + STEPS_EN + 8, TOOLS_EN, STEPS_EN),
     "**스텝 고르기.** 1,024픽셀부터 어느 폭에서나 도구 아래 자기 줄에 있으며, redesign.html이 `SCR-112#large`에 그린 대로입니다. "
     "도구 줄에 함께 두면 %d픽셀이 필요한데(%d과 %d, 사이 8), 두 열 옆의 단계에는 그만한 자리가 없습니다. 열을 접을 때마다 "
     "줄이 바뀌는 조작은 손 밑에서 움직이게 됩니다."
     % (TOOLS_EN + STEPS_EN + 8, TOOLS_EN, STEPS_EN)),
    ("**The first visit.** Beside the list of stages and the talk, the stage is 632 pixels at 1,280 and reaches 776, the least "
     "that stage 08's choice 14 keeps for it, only at 1,424. So on a first visit the talk is a column from 1,440 pixels, and "
     "from 1,280 to 1,439 it starts folded to its button; what the user then folds or shows is kept (SCR-111).",
     "**처음 열 때.** 단계 목록과 대화 옆에서 단계는 1,280픽셀에서 632픽셀이고, 08단계의 고른 것 14가 지키는 최소 776픽셀에는 "
     "1,424픽셀이 되어야 닿습니다. 그래서 처음 열 때 대화는 1,440픽셀부터 열이고, 1,280\\~1,439픽셀에서는 단추로 접힌 채 "
     "시작합니다. 그 뒤로는 사용자가 접거나 편 대로 남습니다(SCR-111)."),
    ("**The editor's box.** Excalidraw 0.18.1, the version that the browser build pins, lays itself out for a phone when its own "
     "box is under %d pixels wide. Beside both columns the box is 632 pixels at 1,280 and passes %d only from a window of %s. "
     "What opening the editor does to the columns is phase ②'s to decide, in its stages 07 to 09 (D20); this sheet gives "
     "the numbers." % (PHONE_BOX, PHONE_BOX, num(PHONE_BOX + LIST + TALK)),
     "**편집기의 상자.** 브라우저 빌드가 고정한 판인 Excalidraw 0.18.1은 자기 상자의 너비가 %d픽셀보다 좁으면 휴대폰 배치를 "
     "씁니다. 두 열 옆에서 그 상자는 1,280픽셀에서 632픽셀이고, 창이 %s픽셀은 되어야 %d을 넘습니다. 편집기를 열 때 열을 "
     "어떻게 할지는 ② 차례가 그 07–09단계에서 정합니다(D20). 이 장은 수만 적습니다."
     % (PHONE_BOX, num(PHONE_BOX + LIST + TALK), PHONE_BOX)),
    ("**The list.** The built list's fixed columns, gaps and paddings take %d pixels, so an item's title has %d pixels at a "
     "stage of 632, %d at 792, %s at 1,224 and %s at 1,384."
     % (LIST_FIXED, 632 - LIST_FIXED, 792 - LIST_FIXED, num(1224 - LIST_FIXED), num(1384 - LIST_FIXED)),
     "**목록.** 만든 목록에서 너비가 정해진 부분과 간격, 안쪽 여백이 %d픽셀을 쓰므로, 항목의 제목은 단계가 632픽셀일 때 %d픽셀, 792일 때 %d, "
     "1,224일 때 %s, 1,384일 때 %s입니다."
     % (LIST_FIXED, 632 - LIST_FIXED, 792 - LIST_FIXED, num(1224 - LIST_FIXED), num(1384 - LIST_FIXED))),
]

VIEW_TEXT = {
    "picture": ("The view that a picture stage opens with. A release without editing: nothing stands at 1 and 2. The tools' "
                "line holds Picture and List, the picture's tools (3) and Stage record (4); on a DDD board the step control (5) "
                "has the line under it.",
                "그림 단계가 처음 보이는 보기입니다. 편집이 없는 릴리스: 1과 2에는 아무것도 없습니다. 도구 줄에는 그림과 목록, 그림의 "
                "도구(3), 단계 기록(4)이 있고, DDD 보드에서는 그 아래 줄에 스텝 고르기(5)가 있습니다."),
    "list": ("`#view=list`: the stage's items as SCR-113 lists them. A release without editing. The tools' line keeps Picture "
             "and List and Stage record (4); the picture's tools and the step control do not show, and the list's own filters "
             "follow under it.",
             "`#view=list`: 단계의 항목을 SCR-113이 늘어놓는 대로 보입니다. 편집이 없는 릴리스입니다. 도구 줄에는 그림과 목록, "
             "단계 기록(4)이 남고, 그림의 도구와 스텝 고르기는 보이지 않으며, 그 아래에 목록 자신의 거르기가 옵니다."),
    "edit": ("`#view=edit`, in a release that includes editing: the control at 1 starts it, and the editor takes the picture's "
             "region. What stands at 3 is phase ②'s to draw. Until that release, an address with `view=edit` shows the picture.",
             "`#view=edit`, 편집이 든 릴리스에서: 1의 조작이 시작하고, 편집기가 그림의 영역에 들어갑니다. 3에 무엇이 설지는 "
             "② 차례가 그립니다. 그 릴리스 전에는 `view=edit`가 붙은 주소가 그림을 보입니다."),
    "board": ("`#view=board`, in a release that includes editing, on stage 01 while a workshop is open: the third place of "
              "Picture and List (2) shows it. Until that release, an address with `view=board` shows the picture.",
              "`#view=board`, 편집이 든 릴리스에서, 워크숍이 열려 있는 동안 01단계에: 그림과 목록의 셋째 자리(2)가 이 보기를 "
              "보입니다. 그 릴리스 전에는 `view=board`가 붙은 주소가 그림을 보입니다."),
}

EXTRA_CSS = r"""
/* ---- the sheet of the picture stage's views ---- */
.blk{margin-top:32px}
.blk h2{margin:0;font-size:18px;line-height:1.3}
.blk > p{margin:8px 0 0;max-width:86ch;font-size:14px}
.nums{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;max-width:86ch;font-size:14px}
.nums li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:10px;align-items:start}
.nums .co{margin-top:1px}
.notes{margin:12px 0 0;padding-left:20px;max-width:86ch;font-size:14px;display:flex;flex-direction:column;gap:8px}
.tw{margin-top:12px;overflow-x:auto;max-width:100%}
.wt{border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
.wt th,.wt td{border:1px solid var(--line);padding:6px 12px;text-align:right;white-space:nowrap}
.wt th:first-child,.wt td:first-child{text-align:left}
.wt thead th{background:var(--surface);font-weight:600;font-size:13px}
.wt td.dr{font-weight:700;background:var(--surface)}
.wt td.lo{text-decoration:underline dashed;text-underline-offset:3px}
.wt td.fv{outline:2px solid var(--ink);outline-offset:-4px}
.frames9{display:flex;flex-direction:column;gap:28px;margin-top:16px}
#app[data-win="1280"] figure[data-win="1440"],#app[data-win="1440"] figure[data-win="1280"],
#app[data-fold="shown"] figure[data-fold="folded"],#app[data-fold="folded"] figure[data-fold="shown"]{display:none}
.fw{display:flex;flex-direction:column;gap:6px}
.rul{display:flex;height:24px;font:600 12px/1 var(--mono);color:var(--ink)}
.rul > span{position:relative;display:flex;align-items:center;justify-content:center;border-left:1.5px solid var(--ink);box-sizing:border-box;min-width:0;white-space:nowrap}
.rul > span:last-child{border-right:1.5px solid var(--ink)}
.rul > span::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px solid var(--muted)}
.rul b{position:relative;background:var(--bg);padding:0 6px;font-weight:600}
.rul .st b{background:var(--ink);color:var(--bg);padding:4px 8px;border-radius:3px}
.wf.v9{border:0;outline:1px solid var(--wf-line);outline-offset:-1px}
.wf.w1440.w1280{width:1280px}
.v9 .sr{min-height:24px}
.co{display:inline-block;width:20px;height:20px;border-radius:50%;background:var(--wf-ink);color:var(--wf-paper);font:700 11px/20px var(--mono);text-align:center;flex:none}
.co.inv{background:var(--wf-paper);color:var(--wf-ink)}
.an{position:relative;display:inline-flex;gap:8px;align-items:center;flex:none}
.an > .co{position:absolute;left:-9px;top:-11px;z-index:1}
.an::after{content:"";position:absolute;left:0;right:0;bottom:-5px;border-bottom:1.5px solid var(--wf-ink)}
.pl{display:inline-flex;align-items:center;justify-content:center;min-width:76px;height:32px;border:1.5px dashed var(--wf-ink);border-radius:6px;flex:none}
.pl.wide{min-width:220px}
.pl.on{background:var(--wf-dark);border-style:solid;border-color:var(--wf-dark)}
.v9 .seg2 > span + span{border-left:1.5px solid var(--wf-ink)}
.v9 .seg2 > span.p2{min-width:72px;justify-content:center;border-left-style:dashed}
.v9 .seg2 > span.p2.on{border-left-style:solid}
.seg2 span.co{display:inline-block;padding:0;min-height:0}
.stp{display:flex;gap:8px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--wf-soft);flex:none}
.stp .fld{min-height:28px;padding:3px 10px;align-items:center;gap:8px;color:var(--wf-ink);font-weight:600}
.rg{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:24px;background:repeating-linear-gradient(45deg,var(--wf-fill) 0 10px,var(--wf-soft) 10px 20px)}
.rg::before{content:"";position:absolute;inset:10px;border:1.5px dashed var(--wf-ink);pointer-events:none}
.plate{position:relative;display:flex;flex-direction:column;gap:8px;align-items:flex-start;max-width:440px;background:var(--wf-paper);border:1.5px dashed var(--wf-ink);border-radius:4px;padding:14px 16px;font-size:13px;line-height:1.5}
.plate .pt{font-size:15px;font-weight:700;line-height:1.3}
.plate .pw{font-weight:700}
"""

JS = r"""
(function(){
  var app=document.getElementById('app');
  function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
  function press(attr,v){document.querySelectorAll('['+attr+']').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute(attr)===v))})}
  function setLang(l){app.setAttribute('data-lang',l);document.documentElement.setAttribute('lang',l);press('data-set-lang',l);store('nexus-wf-lang',l);fit()}
  function setWin(v){app.setAttribute('data-win',v);press('data-set-win',v);fit()}
  function setFold(v){app.setAttribute('data-fold',v);press('data-set-fold',v);fit()}
  function fit(){document.querySelectorAll('.vp').forEach(function(vp){var f=vp.firstElementChild,w=+vp.getAttribute('data-w');if(vp.classList.contains('actual')){f.style.zoom='1';return}var a=vp.clientWidth;if(!a)return;f.style.zoom=String(Math.min(1,a/w))})}
  document.querySelectorAll('[data-set-lang]').forEach(function(b){b.addEventListener('click',function(){setLang(b.getAttribute('data-set-lang'))})});
  document.querySelectorAll('[data-set-win]').forEach(function(b){b.addEventListener('click',function(){setWin(b.getAttribute('data-set-win'))})});
  document.querySelectorAll('[data-set-fold]').forEach(function(b){b.addEventListener('click',function(){setFold(b.getAttribute('data-set-fold'))})});
  document.querySelectorAll('.fit').forEach(function(b){b.addEventListener('click',function(){var vp=b.closest('figure').querySelector('.vp');var on=vp.classList.toggle('actual');b.setAttribute('aria-pressed',String(on));fit()})});
  var saved=store('nexus-wf-lang');
  var lang=saved==='ko'||saved==='en'?saved:((navigator.language||'').toLowerCase().indexOf('ko')===0?'ko':'en');
  setLang(lang);setWin('both');setFold('both');
  window.addEventListener('resize',fit);
  if(window.ResizeObserver){var ro=new ResizeObserver(fit);document.querySelectorAll('.frames9').forEach(function(f){ro.observe(f)})}
  if(location.hash){var t=document.getElementById(location.hash.slice(1));if(t)setTimeout(function(){t.scrollIntoView()},0)}
})();
"""


def bold(s):
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)


def TB(en, ko):
    return bold(TT(en, ko))


def widths_table():
    def cell(n, drawn=False, first=False):
        cls = " ".join(c for c in ("dr" if drawn else "", "lo" if n < PHONE_BOX else "", "fv" if first else "") if c)
        return '<td%s>%s</td>' % (' class="%s"' % cls if cls else "", num(n))
    rows = ""
    for win in (1024, 1152, 1280, 1440):
        panel = win < 1280
        # A first visit shows the list of stages, and the talk as a column only from FIRST_TALK.
        both = "<td>–</td><td>–</td>" if panel else (cell(win - LIST - TALK, win in WINS, win >= FIRST_TALK) + cell(win - RAIL - TALK))
        rows += "<tr><td>%s</td>%s%s%s</tr>\n" % (num(win), both, cell(win - LIST, first=win < FIRST_TALK),
                                                  cell(win - RAIL, win in WINS))
    head = "".join("<th>%s</th>" % T(a, b) for a, b in [
        ("Window", "창"), ("List and talk", "목록과 대화"), ("Rail and talk", "띠와 대화"),
        ("List, talk folded", "목록, 대화는 접힘"), ("Rail, talk folded", "띠, 대화는 접힘")])
    return '<div class="tw"><table class="wt"><thead><tr>%s</tr></thead><tbody>\n%s</tbody></table></div>' % (head, rows)


def build():
    sections, toc, nframes = [], [], 0
    for k, view in enumerate(VIEWS):
        figs = "".join(figure(view, win, fold) for win in WINS for fold in FOLDS)
        nframes += len(WINS) * len(FOLDS)
        sid = "view-" + view
        toc.append('<a href="#%s"><b>%d</b>%s</a>' % (sid, k + 1, T(*VIEW_NAMES[view])))
        sections.append('<section class="screen" id="%s">\n<h2><span class="sid">%d</span>%s</h2>\n<p class="purpose">%s</p>\n'
                        '<div class="frames9">%s</div>\n</section>\n' % (sid, k + 1, T(*VIEW_NAMES[view]), TT(*VIEW_TEXT[view]), figs))
    lede = TT(
        "One sheet of grey wireframes of the picture stage's column, SCR-112, with the four views that stage 07's choice 18 gives "
        "it: the picture, the list, the editor in the picture's place and the part's work board on stage 01. Each is drawn at "
        "1,280 and 1,440 pixels with the workspace's columns shown and folded (SPEC-210), %d frames. It is a skeleton without the "
        "look: it shows where the views' controls go in the head and the tools and how wide a view is, and it decides nothing of "
        "phase ②'s own screens. The picture and the list are drawn as a release without editing shows them, the editor and the "
        "work board as a release that includes editing would. Stage 08's definitions and stage 09's notes are the source: where "
        "a frame and they differ, they hold. Nothing here is built, and the revision's checkpoint passed on 2026-11-12. Drawn on %s."
        % (nframes, DRAWN),
        "그림 단계 SCR-112의 열을 회색 와이어프레임 한 장으로 그렸습니다. 07단계의 선택 18이 이 열에 준 네 보기, 곧 그림, 목록, "
        "그림의 자리에 들어가는 편집기, 01단계에서 부분의 작업 보드입니다. 보기마다 1,280픽셀과 1,440픽셀에서 작업 공간의 열을 편 "
        "것과 접은 것(SPEC-210)으로 그려 틀이 %d개입니다. 생김새 없는 뼈대입니다: 머리와 도구에서 보기의 조작이 어디에 가는지, "
        "보기가 얼마나 넓은지를 보여 주고, ② 차례 자신의 화면에 대해서는 아무것도 정하지 않습니다. 그림과 목록은 편집이 없는 "
        "릴리스가 보이는 대로, 편집기와 작업 보드는 편집이 든 릴리스가 보일 모습으로 그렸습니다. 원본은 08단계의 정의서와 "
        "09단계의 메모이며, 틀이 그것과 다르면 그것을 따릅니다. 여기 있는 것은 아직 만들지 않았고, 설계 수정의 확인 지점은 "
        "2026-11-12에 통과했습니다. %s에 그렸습니다." % (nframes, DRAWN))
    key = TT(
        "Grey bars stand for the project's own text. The words in the frames are the final words of stage 08's words tables; the "
        "dates, counts and names are examples. A black disc with a number is the sheet's own mark and no part of the screen: it "
        "names a place of the list below. A dashed box with a number is a place that waits for the release that includes "
        "editing, filled where its view shows; a hatched region with a dashed plate stands for a view that phase ② draws. A "
        "list that goes on ends in three dots. The scale above a frame gives the widths of its columns.",
        "회색 막대는 프로젝트 자신의 글입니다. 틀 속의 말은 08단계 말 표의 최종 문구이고, 날짜와 수와 이름은 예시입니다. 숫자가 든 "
        "검은 원은 이 장의 표시이지 화면의 부분이 아닙니다: 아래 목록의 자리를 가리킵니다. 숫자가 든 점선 상자는 편집이 든 "
        "릴리스를 기다리는 자리이고, 그 보기가 보일 때는 채워져 있습니다. 빗금 친 영역과 점선 판은 ② 차례가 그릴 보기를 "
        "대신합니다. 더 이어지는 목록은 점 세 개로 끝납니다. 틀 위의 눈금은 그 틀의 열 너비입니다.")
    seg = lambda attr, opts: '<span class="seg" role="group">%s</span>' % "".join(
        '<button type="button" %s="%s" aria-pressed="%s">%s</button>' % (attr, v, "true" if i == 0 else "false", lab)
        for i, (v, lab) in enumerate(opts))
    controls = ('<div class="controls"><div><span class="ctl-l">%s</span>%s</div><div><span class="ctl-l">%s</span>%s</div>'
                '<div><span class="ctl-l">%s</span>%s</div></div>') % (
        T("Language", "언어"), seg("data-set-lang", [("en", "English"), ("ko", "한국어")]),
        T("Window", "창"), seg("data-set-win", [("both", T("Both", "둘 다")), ("1280", "1,280"), ("1440", "1,440")]),
        T("Columns", "열"), seg("data-set-fold", [("both", T("Both", "둘 다")), ("shown", T("Shown", "편 모습")),
                                                   ("folded", T("Folded", "접은 모습"))]))
    head = ('<header class="top">\n<p class="eyebrow">%s</p>\n<h1>%s</h1>\n<p class="lede">%s</p>\n%s\n<p class="key">%s</p>\n</header>\n') % (
        T("CORTHEX · NEXUS · stage 09 · the design revision of 2026-11-11", "CORTHEX · NEXUS · 09단계 · 2026-11-11의 설계 수정"),
        T("NEXUS picture stage views", "NEXUS 그림 단계의 네 보기"), lede, controls, key)
    places = '<section class="blk" id="places">\n<h2>%s</h2>\n<ol class="nums">\n%s</ol>\n</section>\n' % (
        T("The places", "자리"),
        "".join("<li>%s<span>%s</span></li>\n" % (co(i + 1), TT(a, b)) for i, (a, b) in enumerate(PLACES)))
    widths = ('<section class="blk" id="widths">\n<h2>%s</h2>\n<p>%s</p>\n%s\n</section>\n') % (
        T("The stage's width", "단계의 너비"),
        TT("What the list of stages, %d pixels, or its rail, %d, and the talk, %d, leave the stage in a window of each width. "
           "From 1,024 to 1,279 pixels the talk is a panel over the stage's right edge and takes no width (stage 08, rule 16). "
           "Bold: drawn on this sheet. Underlined: under %d pixels. Outlined: what a first visit shows, as this sheet "
           "proposes." % (LIST, RAIL, TALK, PHONE_BOX),
           "창의 폭마다 단계 목록(%d픽셀)이나 그 띠(%d), 그리고 대화(%d)가 단계에 남기는 너비입니다. 1,024\\~1,279픽셀에서 대화는 "
           "단계의 오른쪽 가장자리 위로 열리는 패널이라 너비를 차지하지 않습니다(08단계, 규칙 16). 굵은 수: 이 장이 그린 것. "
           "밑줄: %d픽셀보다 좁은 것. 테두리: 이 장이 제안하는 대로, 처음 열 때 보이는 것." % (LIST, RAIL, TALK, PHONE_BOX)),
        widths_table())
    settles = '<section class="blk" id="settles">\n<h2>%s</h2>\n<ol class="notes">\n%s</ol>\n</section>\n' % (
        T("What the sheet settles", "이 장이 정하는 것"), "".join("<li>%s</li>\n" % TB(a, b) for a, b in SETTLES))
    doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           '<!-- Drawn by a script from stage 08\'s words and from the rows of SCR-112 and SCR-111; draw it again when they change. -->\n'
           '<title>NEXUS Picture Stage Views</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
           '<style>%s%s</style>\n</head>\n<body>\n<main id="app" data-lang="en" data-win="both" data-fold="both">\n%s'
           '<nav class="toc" aria-label="Views">\n%s\n</nav>\n%s%s%s%s</main>\n<script>%s</script>\n</body>\n</html>\n') % (
        CSS, EXTRA_CSS, head, "\n".join(toc), places, widths, settles, "".join(sections), JS)
    return doc, nframes


if __name__ == "__main__":
    out = OUT
    if "--out" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--out") + 1])
    doc, nframes = build()
    with open(str(out), "w", encoding="utf8", newline="\n") as file:  # the same bytes on every system
        file.write(doc)
    B.report(out, len(doc.encode("utf8")), "%d frames" % nframes)
