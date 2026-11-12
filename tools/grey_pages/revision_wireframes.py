#!/usr/bin/env python3
"""Draws docs/08-screens/nexus/revision-wireframes.html from the definitions' revision sections.

Run it again when the revision's state rows or its words change, from the repository's root:
python -W error tools/grey_pages/revision_wireframes.py [--out FILE]
tests/test_grey_pages.py draws the page and holds it to the committed file byte for byte; tools/grey_pages/README.md
says how to measure it in a browser.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import wf_base as B  # noqa: E402
from wf_base import T, W, div, md_inline, row, rv, span, bt, ban, tid, also, sm  # noqa: E402
from wf_css import CSS, JS  # noqa: E402
import wf_frames as F  # noqa: E402

DRAWN = "2026-11-12"
OUT = B.ROOT / "revision-wireframes.html"

PATHS = {
    "SCR-110": "/",
    "SCR-111": "/p/{project}/{part}/{stage}",
    "SCR-112": "/p/{project}/{part}/{stage} · 01-domain, 05-erd, 07-sitemap",
    "SCR-113": "/p/{project}/{part}/{stage} · #view=list",
    "SCR-114": "/p/{project}/{part}/{stage}#talk={comment}",
    "SCR-115": "/p/{project}/{part}/{stage}#item={id}",
    "SCR-130": "/p/{project}#data",
}

V_ITEM = ("An item that the talk selected", "대화가 고른 항목")
V_ROW = ("The row that the talk selected", "대화가 고른 행")
V_NARROW = ("The narrowed list does not hold the row", "좁혀 놓은 목록에 그 행이 없을 때")
V_RECORD = ("The stage record with an open checkpoint request", "열린 확인 요청이 있는 단계 기록")
V_FROM_TALK = ("Opened from an entry of the talk", "대화의 줄에서 열었을 때")
V_NOT_SHOWN = ("The stage does not show the item", "단계가 그 항목을 보이지 못할 때")
N_SHEET = ("the sheet of stages open", "단계 시트를 연 모습")
N_PIC_TAB = ("the Picture tab, opened after the entry was picked", "줄을 고른 뒤 연 그림 탭")
N_LIST_TAB = ("the List tab, opened after the entry was picked", "줄을 고른 뒤 연 목록 탭")
N_ITEM_TAB = ("the Item tab", "항목 탭")
N_TALK_TAB = ("the Talk tab", "대화 탭")


def fold_note(*pairs):
    return " · ".join("%s %s" % (g, W(lbl)) for g, lbl in pairs)


def side(*kids):
    return div("side", *kids)


def sheet(inner, tall=True):
    return div("scrim") + div("sheet tall" if tall else "sheet", inner)


def talk_full(w, cur, item, *, show_rv=True, apart=None, fold_rv=False, notice="", plain=False, late=False):
    return (F.talk_head(w, cur, show_rv=fold_rv) + F.halves()
            + F.talk_body(w, item, show_rv=show_rv, apart=apart, plain=plain, late=late)
            + F.talk_box(notice=notice, filled=bool(notice)))


def skeleton_side(w):
    return side(F.talk_head(w, 1, show_rv=True, loading=True), F.halves(),
                div("pb", B.lns("100%", "80%", "92%", "60%"), B.lns("96%", "70%", "88%")), F.talk_box())


# The height of a workspace frame that is drawn taller than a screen, so that a column that would scroll shows whole:
# (state, width, view) -> pixels. measure.js prints the table; a frame that is not here has H's height.
HEIGHT = {
    ("SCR-111#loading", 390, 0): 1220,
    ("SCR-111#normal", 390, 0): 1220,
    ("SCR-111#normal", 1440, 0): 1180,
    ("SCR-112#error", 390, 0): 940,
    ("SCR-112#normal", 390, 1): 1080,
    ("SCR-112#stale", 390, 0): 920,
    ("SCR-113#error", 390, 0): 940,
    ("SCR-113#normal", 390, 1): 1200,
    ("SCR-113#normal", 390, 2): 1080,
    ("SCR-113#normal", 1440, 1): 1120,
    ("SCR-113#stale", 390, 0): 920,
    ("SCR-114#error", 390, 0): 1580,
    ("SCR-114#error", 1440, 0): 1380,
    ("SCR-114#normal", 390, 0): 1800,
    ("SCR-114#normal", 1440, 0): 1540,
    ("SCR-115#normal", 390, 0): 980,
    ("SCR-115#normal", 390, 1): 1240,
    ("SCR-115#normal", 1440, 1): 1160,
    ("SCR-130#empty", 390, 0): 880,
    ("SCR-130#error", 390, 0): 1360,
    ("SCR-130#loading", 390, 0): 880,
    ("SCR-130#normal", 390, 0): 1040,
    ("SCR-130#permission", 390, 0): 1140,
    ("SCR-130#removal", 390, 0): 980,
    ("SCR-130#removal-ready", 390, 0): 1160,
    ("SCR-130#stale", 390, 0): 1080,
}


def fr(w, sid, inner, k=0):
    return F.wf(w, sid, inner, app=True, h=HEIGHT.get((sid, w, k)), k=k)


def pair(sid, k, f390, f1440, **more):
    return dict(f={390: fr(390, sid, f390, k), 1440: fr(1440, sid, f1440, k)}, **more)


def views_of(sid):
    """The views of a state: each a label, the two frames, and what stands beside a frame's width."""
    scr, st = sid.split("#")
    if scr == "SCR-110":
        return [dict(f={w: F.wf(w, sid, F.home(w, st)) for w in (390, 1440)})]
    if scr == "SCR-111":
        if st in ("loading", "normal"):
            ld = st == "loading"
            stage = lambda w: F.pic_stage(w, 1, sk=ld, late=True)
            right = skeleton_side(1440) if ld else side(talk_full(1440, 1, "CTX-003", show_rv=False, fold_rv=True, late=True))
            f1440 = F.ws(1440, 1, stage=stage(1440), side=right, mark=True, loading=ld, show_rv=True)
            f390 = F.ws(390, 1, stage=stage(390), tabs_html=F.tabs("Picture", "stage", cur=1),
                        over=F.stage_sheet(1, mark=True, show_rv=True))
            return [pair(sid, 0, f390, f1440, n390=N_SHEET,
                         note1440=fold_note(("«", "Fold the list of stages"), ("»", "Fold the talk")))]
        f1440 = F.ws(1440, 1, stage=F.pic_stage(1440, 1, talk_btn=True, cols=10, late=True), fold_list=True, mark=True)
        f390 = F.ws(390, 1, stage=F.pic_stage(390, 1, late=True), tabs_html=F.tabs("Picture", "stage", show_rv=True, cur=1))
        return [pair(sid, 0, f390, f1440,
                     note1440=fold_note(("»", "Show the list of stages"), ("◆", "Unread for more than 24 hours")))]
    if scr in ("SCR-112", "SCR-113"):
        pic = scr == "SCR-112"
        cur, item = (1, "CTX-003") if pic else (2, "REQ-107")
        first = "Picture" if pic else "List"

        def stage(w, sel=False, narrowed=False, rvc=False):
            if pic:
                return F.pic_stage(w, cur, sel=((2, 2) if w == 1440 else (1, 2)) if sel else None, rv_counts=rvc)
            return F.doc_stage(w, cur, sel=item if sel else None, narrowed=narrowed)

        def rec(state, k, bars="", **more):
            f1440 = F.ws(1440, cur, stage=stage(1440, rvc=pic), side=side(F.record(1440, cur, state, item)), bars=bars)
            f390 = F.ws(390, cur, stage=stage(390), tabs_html=F.tabs(first, "stage", cur=cur), bars=bars,
                        over=sheet(F.record(390, cur, state, item)))
            return pair(sid, k, f390, f1440, **more)
        if st == "normal":
            kind = "context" if pic else "requirement"
            f1440 = F.ws(1440, cur, stage=stage(1440, sel=True, rvc=pic),
                         side=side(F.item_panel(1440, item, scrolled=True, show_rv=False, kind=kind)))
            f390 = F.ws(390, cur, stage=stage(390, sel=True), tabs_html=F.tabs(first, "stage", item=True, cur=cur))
            out = [pair(sid, 0, f390, f1440, label=V_ITEM if pic else V_ROW, n390=N_PIC_TAB if pic else N_LIST_TAB)]
            if not pic:
                why = "This item is not in the list as you narrowed it."
                g1440 = F.ws(1440, cur, stage=stage(1440, narrowed=True), side=side(F.item_panel(1440, item, why=why, show_rv=False)))
                g390 = F.ws(390, cur, stage=F.item_panel(390, item, why=why, show_rv=False),
                            tabs_html=F.tabs(first, "item", item=True, cur=cur))
                out.append(pair(sid, 1, g390, g1440, label=V_NARROW, n390=N_ITEM_TAB))
            out.append(rec("normal", len(out), label=V_RECORD))
            return out
        if st == "stale":
            return [rec("stale", 0, bars=F.pushed_again_bar())]
        return [rec("error", 0)]
    if scr == "SCR-114":
        cur, item = 2, "REQ-107"
        if st == "normal":
            f1440 = F.ws(1440, cur, stage=F.doc_stage(1440, cur), side=side(talk_full(1440, cur, item, plain=True, apart="picked")))
            f390 = F.ws(390, cur, stage=talk_full(390, cur, item, plain=True, apart="picked"), tabs_html=F.tabs("List", "talk"))
            return [pair(sid, 0, f390, f1440, n390=N_TALK_TAB)]
        if st == "narrowed":
            f1440 = F.ws(1440, cur, stage=F.doc_stage(1440, cur, sel=item, rv_row=False),
                         side=side(F.item_panel(1440, item, scrolled=True)))
            inner = div("pb", F.item_talk(item)) + F.talk_box(item)
            f390 = F.ws(390, cur, stage=inner, tabs_html=F.tabs("List", "talk", item=True))
            return [pair(sid, 0, f390, f1440, n390=N_TALK_TAB)]
        notice = rv(ban("err", span("", W("This stage has an open checkpoint request.")), tid(), row(bt(W("Try again")))))
        f1440 = F.ws(1440, cur, stage=F.doc_stage(1440, cur),
                     side=side(talk_full(1440, cur, item, show_rv=False, apart="listed", notice=notice)))
        f390 = F.ws(390, cur, stage=talk_full(390, cur, item, show_rv=False, apart="listed", notice=notice),
                    tabs_html=F.tabs("List", "talk"))
        return [pair(sid, 0, f390, f1440, n390=N_TALK_TAB)]
    if scr == "SCR-115":
        a1440 = F.ws(1440, 1, stage=F.pic_stage(1440, 1, sel=(2, 2)), side=side(F.item_panel(1440, "CTX-003", scrolled=True, kind="context")))
        a390 = F.ws(390, 1, stage=F.item_panel(390, "CTX-003", kind="context"), tabs_html=F.tabs("Picture", "item", item=True, cur=1))
        why = "The picture is not current, so the list shows this item."
        more = also(sm(W("The picture is not drawn yet, so the list shows this item.")),
                    sm(W("This item is not in the list as you narrowed it.") + " " + B.lk(W("Show all"))))
        lst = lambda w: (F.shead(w, 1, pic=True) + F.tools(w, "list")
                         + F.doc_list(w, sel="TERM-107", prefix="TERM", rv_row=False))
        b1440 = F.ws(1440, 1, stage=lst(1440), side=side(F.item_panel(1440, "TERM-107", why=why, extra=more, show_rv=False, kind="term")))
        b390 = F.ws(390, 1, stage=F.item_panel(390, "TERM-107", why=why, extra=more, show_rv=False, kind="term"),
                    tabs_html=F.tabs("List", "item", item=True, cur=1))
        return [pair(sid, 0, a390, a1440, label=V_FROM_TALK, n390=N_ITEM_TAB),
                pair(sid, 1, b390, b1440, label=V_NOT_SHOWN, n390=N_ITEM_TAB)]
    if scr == "SCR-130":
        return [pair(sid, 0, F.data_frame(390, st), F.data_frame(1440, st))]
    raise KeyError(sid)


def figure(w, frame, note=None, fnote=""):
    px = "1,440 px" if w == 1440 else "390 px"
    extra = " · " + T(*note) if note else ""
    fit = '<button type="button" class="fit" aria-pressed="false">%s</button>' % T("Actual size", "실제 크기") if w == 1440 else ""
    tail = '<p class="fnote">%s</p>' % fnote if fnote else ""
    return '<figure class="f%d"><figcaption><span>%s%s</span>%s</figcaption><div class="vp" data-w="%d">%s</div>%s</figure>' % (
        w, px, extra, fit, w, frame, tail)


def article(en, ko):
    sid = en["id"]
    assert ko["id"] == sid, (sid, ko["id"])
    aid = sid.lower().replace("#", "-")
    cap = ('<div class="cap"><div class="txt">%s</div><p class="from">%s</p>'
           '<button type="button" class="more" aria-expanded="false"><span class="m1">%s</span><span class="m2">%s</span></button></div>') % (
        '<span class="en" lang="en">%s</span><span class="ko" lang="ko">%s</span>' % (md_inline(en["text"]), md_inline(ko["text"])),
        '<span class="en" lang="en">From: %s · Status: %s</span><span class="ko" lang="ko">이어지는 응답: %s · 진행: %s</span>' % (
            md_inline(en["from"]), md_inline(en["status"]), md_inline(ko["from"]), md_inline(ko["status"])),
        T("Show the whole row", "행 전체 보기"), T("Show less", "줄여 보기"))
    body, n = "", 0
    for v in views_of(sid):
        if v.get("label"):
            body += '<p class="view">%s</p>' % T(*v["label"])
        body += '<div class="frames">%s%s</div>' % (
            figure(390, v["f"][390], v.get("n390"), v.get("note390", "")),
            figure(1440, v["f"][1440], v.get("n1440"), v.get("note1440", "")))
        n += 2
    return '<article class="state" id="%s">\n<h3>%s</h3>\n%s\n%s</article>\n' % (aid, sid, cap, body), n


def build():
    sections, toc, nstates, nframes = [], [], 0, 0
    for scr, name in B.SCREENS:
        en, ko = B.read_def(name, "en"), B.read_def(name, "ko")
        assert [r["id"] for r in en["rows"]] == [r["id"] for r in ko["rows"]], name
        arts = ""
        for a, b in zip(en["rows"], ko["rows"]):
            h, n = article(a, b)
            arts += h
            nstates += 1
            nframes += n
        sid = scr.lower()
        toc.append('<a href="#%s"><b>%s</b>%s</a>' % (sid, scr, T(en["title"], ko["title"])))
        sections.append(
            '<section class="screen" id="%s">\n<h2><span class="sid">%s</span>%s</h2>\n<p class="meta">%s · %s</p>\n'
            '<p class="purpose"><span class="en" lang="en">%s</span><span class="ko" lang="ko">%s</span></p>\n'
            '<div class="na"><span class="en" lang="en">%s</span><span class="ko" lang="ko">%s</span></div>\n%s</section>\n' % (
                sid, scr, T(en["title"], ko["title"]), B.esc(PATHS[scr]), B.esc(name + ".md"),
                md_inline(en["purpose"]), md_inline(ko["purpose"]), md_inline(en["note"]), md_inline(ko["note"]), arts))
    lede_en = ("Grey wireframes of what the design revision of 2026-11-11 adds or changes: frames for each of its %d state rows on "
               "seven screens, at 390 and 1,440 pixels, drawn from the last section of the definitions of SCR-110 to SCR-115 and from "
               "the definition of SCR-130 in docs/08-screens/nexus/ of the corthex-nexus repository. The definitions are the source: "
               "where a frame and its definition differ, the definition holds. Nothing here is built, and the revision's checkpoint "
               "passed on 2026-11-12; stage 09 draws these states in the redesign's look after it. Drawn on %s." % (nstates, DRAWN))
    lede_ko = ("2026-11-11의 설계 수정이 더하거나 바꾸는 것을 그린 회색 와이어프레임입니다. 화면 일곱 개에 걸친 상태 행 %d개마다 390픽셀과 "
               "1,440픽셀의 틀이 있고, corthex-nexus 저장소의 docs/08-screens/nexus/에 있는 SCR-110~SCR-115 정의서의 마지막 절과 "
               "SCR-130 정의서에서 그렸습니다. 원본은 정의서이며, 틀과 정의서가 다르면 정의서를 따릅니다. 여기 있는 것은 아직 만들지 않았고, "
               "설계 수정의 확인 지점은 2026-11-12에 통과했습니다. 그 뒤에 09단계가 이 상태들을 다시 디자인의 모습으로 그립니다. %s에 그렸습니다."
               % (nstates, DRAWN))
    key_en = ("Grey bars stand for the projects' own text. The words in the frames are the final words of the definitions' words files; "
              "the dates, counts, commits and names are examples, and a name in braces, such as {time}, comes from the data. "
              "A dotted outline surrounds what the revision adds or changes on a screen that exists; on SCR-130, which is new, the "
              "whole panel is the revision's. A dashed outline is a control that waits, or with ↻ a notice that something changed "
              "meanwhile; a heavy outline with ! is an error or a "
              "refusal; a dashed box labelled Also in this state shows the state's other cases. A list that goes on ends in three "
              "dots. A workspace frame is drawn taller "
              "than a screen where a column would scroll, so that the whole column shows; the page that waits behind a panel is "
              "cut where the screen ends.")
    key_ko = ("회색 막대는 프로젝트 자신의 글입니다. 틀 속의 말은 정의서의 말 표에 있는 최종 문구이고, 날짜, 수, 커밋, 이름은 예시이며, "
              "{time} 같은 중괄호 속 이름은 자료에서 채웁니다. 점으로 된 테두리는 이미 있는 화면에서 설계 수정이 더하거나 바꾸는 것을 "
              "둘러싸고, 새 화면인 SCR-130에서는 패널 전체가 설계 수정의 것입니다. 점선 테두리는 기다리는 조작이거나, ↻ 가 있으면 그사이 무언가 바뀌었다는 알림이고, ! 가 있는 굵은 테두리는 "
              "오류나 거절이며, '이 상태의 다른 경우'라고 적힌 점선 상자는 그 상태의 다른 경우입니다. 더 이어지는 목록은 점 세 개로 "
              "끝납니다. 작업 공간의 틀은 열이 스크롤되는 "
              "곳에서 열 전체가 보이도록 화면보다 길게 그렸고, 패널 뒤에서 기다리는 페이지는 화면이 끝나는 곳에서 잘립니다.")
    head = ('<header class="top">\n<p class="eyebrow">%s</p>\n<h1>%s</h1>\n<p class="lede">%s</p>\n'
            '<div class="controls"><div><span class="ctl-l">%s</span><span class="seg" role="group">'
            '<button type="button" data-set-lang="en" aria-pressed="true">English</button>'
            '<button type="button" data-set-lang="ko" aria-pressed="false">한국어</button></span></div>'
            '<div><span class="ctl-l">%s</span><span class="seg" role="group">'
            '<button type="button" data-set-widths="both" aria-pressed="true">%s</button>'
            '<button type="button" data-set-widths="390" aria-pressed="false">390</button>'
            '<button type="button" data-set-widths="1440" aria-pressed="false">1440</button></span></div></div>\n'
            '<p class="key">%s</p>\n</header>\n') % (
        T("CORTHEX · NEXUS · stage 08 · the design revision of 2026-11-11", "CORTHEX · NEXUS · 08단계 · 2026-11-11의 설계 수정"),
        T("NEXUS revision wireframes", "NEXUS 설계 수정 와이어프레임"), T(lede_en, lede_ko),
        T("Language", "언어"), T("Widths", "폭"), T("Both", "둘 다"), T(key_en, key_ko))
    doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           '<!-- Drawn from the revision sections of the screen definitions beside this file; draw it again when they change. -->\n'
           '<title>NEXUS Revision Wireframes</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
           '<style>%s</style>\n</head>\n<body>\n<main id="app" data-lang="en" data-widths="both">\n%s'
           '<nav class="toc" aria-label="Screens">\n%s\n</nav>\n%s</main>\n<script>%s</script>\n</body>\n</html>\n') % (
        CSS, head, "\n".join(toc), "".join(sections), JS)
    return doc, nstates, nframes


if __name__ == "__main__":
    out = OUT
    if "--out" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--out") + 1])
    doc, nstates, nframes = build()
    with open(str(out), "w", encoding="utf8", newline="\n") as file:  # the same bytes on every system
        file.write(doc)
    B.report(out, len(doc.encode("utf8")), "%d states, %d frames" % (nstates, nframes))
