"""The frames of the revision's wireframes: the first page and the workspace's parts, at 390 and 1,440 pixels."""
import html

from wf_base import (SEP, T, W, Wt, also, ban, bt, div, dot, esc, grow, idc, lk, ln, lns, load_words, loop_time,
                     mark24, row, rv, sm, span, tag, tid)

load_words()

PROJECT = "acme-shop"
REMOVED = "old-demo"
COMMIT, COMMIT2 = "9608fa1", "4d2e7b0"
T_PUSH = loop_time("2026-11-11 14:02", "h", 3)
T_READ = loop_time("2026-11-11 09:12", "h", 7)
T_PUSH_OLD = loop_time("2026-11-09 08:30", "d", 2)
T_READ_OLD = loop_time("2026-11-09 08:12", "d", 2)
T_PUSH_3 = loop_time("2026-11-06 17:41", "d", 4)
STAGE_NAMES = ["Domain discovery", "PRD", "User flow", "Functional spec", "ERD", "API", "Sitemap", "Screen states",
               "Mockup", "WBS", "Development", "QA", "Presentation"]
GROUPS = [("Discovery", [1]), ("Definition", [2, 3, 4]), ("Contracts", [5, 6]), ("Screens", [7, 8, 9]),
          ("Building", [10, 11, 12]), ("Presentation", [13])]
ITEMS = {1: 59, 2: 166, 3: 44, 4: 87, 5: 25, 6: 64, 7: 18, 8: 109, 9: 16, 10: 150, 11: 0, 12: 717, 13: 0}
PIC = {1, 5, 7}
H = {390: 800, 1440: 960}
# The open entries of a stage's sample talk: my turn 2 and the agent's turn 4, and on 02 one whose item is gone.
TALK_N = {1: 6, 2: 7}
# Two samples of the loop's times, as they read at about 17:00 on 2026-11-11. False: a session read the to-do this
# morning and pushed at 14:02. True: the last push and read were two days ago, and entries have waited unread since.
TIMES = {False: dict(req="2026-11-11 13:40", reco="2026-11-11 11:05", w1="2026-11-11 15:20", drawn="2026-11-11 14:02"),
         True: dict(req="2026-11-09 08:05", reco="2026-11-09 07:40", w1="2026-11-09 21:40", drawn="2026-11-09 08:30")}


def wf(w, sid, inner, app=False, h=None, k=0):
    cls = "wf w%d%s" % (w, " app" if app else "")
    style = ' style="height:%dpx"' % (h or H[w]) if app else ""
    label = "%s, %s px%s" % (sid, "1,440" if w == 1440 else "390", ", view %d" % (k + 1) if k else "")
    return '<div class="%s" data-state="%s" data-width="%d" data-view="%d" role="img" aria-label="%s"%s>%s</div>' % (
        cls, sid, w, k, html.escape(label, quote=True), style, inner)


def stage_name(no):
    return "%02d " % no + W(STAGE_NAMES[no - 1])


def find_field():
    return div("fld", span("", dot(W("Find by ID or words"), W("e.g. REQ-107"))))


def words_box(filled, left="2,000"):
    box = div("fld area filled", lns("88%", "52%")) if filled else div("fld area")
    return div("col", box, sm(W("{n} characters left", n=left)))


def req_facts(item, line=False, commit=COMMIT):
    """What a checkpoint request shows whole, after its text (rule 22)."""
    return div("kv line" if line else "kv",
               div("", span("sm", W("Look at first")), lk(idc(item) + " " + ln(104))),
               div("", span("ink", W("Commit {commit}", commit=commit))),
               div("", span("sm", W("Left in this stage")),
                   span("ink", dot(W("{n} open discrepancies", n=2), W("{n} other open comments", n=3),
                                   W("{n} pending reflections", n=2)))))


# ------------------------------------------------------------------ SCR-110, the first page
def tb_home(w):
    if w == 390:
        return div("tb", span("brand", W("NEXUS")), grow(), bt(W("Search")), bt(W("Menu")))
    return div("tb", span("brand", W("NEXUS")), lk(W("All projects")), find_field(), grow(), lk(W("Full checks")))


def home_request(w, st):
    wide = w == 1440
    off = "wait" if st == "loading" else ""
    kind = span("", tag(W("Checkpoint")))
    place = sm(ln(64, True), " · nexus · ", stage_name(2), SEP, W("the stage as a whole"))
    when = sm(W("Agent"), SEP, "2026-11-11 13:40")
    text = lns("100%", "96%", "100%", "92%", "98%", "100%", "58%")
    facts = req_facts("REQ-107", line=wide, commit=COMMIT2 if st == "stale" else COMMIT)
    whole = rv(text, facts, cls="gap") if wide else rv(text, when, facts, cls="gap")
    box, after = [], []
    if st in ("stale", "error", "permission"):
        box.append(rv(words_box(True, "1,870")))
    if st == "stale":
        after.append(rv(ban("warn", span("", W("The project now shows another commit: {commit}. Look again before you pass.",
                                           commit=COMMIT2)), ic="↻")))
        after.append(also(
            sm(W("The checkpoint request changed. Read it again before you pass.")),
            sm(W("The project now shows a newer snapshot. Look again before you pass.")),
            sm(W("This can no longer be answered as recommended: it was answered or closed, or it now asks something else."))))
    if st == "error":
        after.append(rv(ban("err", span("", W("Something went wrong on the server. Try again.")), tid(),
                            row(bt(W("Try again"))))))
        after.append(also(
            sm(W("This project's space is full. Your text stays here.") + " " + lk(W("Open the request"))),
            sm(W("This could not be sent: check the marked field.") + " " + lk(W("Load again"))),
            sm(W("A request from another site is refused. Open this page at the server's own address.") + " "
               + lk(W("Open this page")))))
    if st == "permission":
        after.append(rv(ban("err", span("", W("Only you can do this, signed in yourself.")))))
    acts = div("acts", bt(W("Open the request"), "pri"), bt(W("Pass the stage {n} checkpoint", n="02"), off),
               lk(W("Add your words"), off))
    tail = [div("after", *after)] if after else []
    if wide:
        return div("me rowy", kind, div("mb", place, whole, *box), when, div("actw", rv(acts)), *tail)
    return div("me", row(kind, place), whole, *box, rv(acts), *tail)


def home_request_plain(w):
    """A request that does not show whole, as one stored without the form: only its text and "Open the request"."""
    place = sm(ln(64, True), " · memory · ", stage_name(1), SEP, W("the stage as a whole"))
    return div("me", row(tag(W("Checkpoint")), place), lns("100%", "62%"), sm(W("Agent"), SEP, "2026-11-10 18:22"),
               div("acts", bt(W("Open the request"), "pri")))


def home_request_done(w):
    place = sm(ln(64, True), " · nexus · ", stage_name(4), SEP, W("the stage as a whole"))
    return div("me done", row(tag(W("Checkpoint")), place),
               span("", W("Checkpoint passed. You can withdraw it in the stage record until it is recorded.")),
               row(lk(W("Stage record"))))


def home_reco(w, st):
    off = "wait" if st == "loading" else ""
    kind = span("", tag(W("Recommendation")))
    place = sm(ln(64, True), " · nexus · ", stage_name(5), SEP, idc("TBL-105"), " ", ln(84))
    text = lns("100%", "94%", "40%")
    when = sm(W("Agent"), SEP, "2026-11-11 11:05")
    acts = div("acts", bt(W("As recommended"), off), bt(W("Reply"), off))
    if w == 1440:
        return div("me rowy", kind, div("mb", place, text), when, div("actw", acts))
    return div("me", row(kind, place), when, text, acts)


def my_turn(w, st):
    head = div("", div("h2", W("My turn ({n})", n=2)),
               sm(W("What the agent asked or proposed and waits for your answer")))
    entries = [home_request(w, st), home_reco(w, st)]
    if st == "normal":
        entries.append(also(home_request_plain(w), home_request_done(w)))
    foot = sm(W("When you answer, it becomes the agent's turn. The agent reads it at its next work on the project."))
    return div("sec", head, *entries, foot)


def agent_todo(w, st):
    def proj(times, counts, unread, taken=None):
        rows = [div("cnt2", lk(W(lbl)), span("", str(n))) for lbl, n in counts]
        if taken:
            rows.append(sm(W("{n} taken by a session", n=taken)))
        return div("atp", ln(96, True), rv(*times),
                   div("cnts", div("", *rows), rv(tag(W("{n} not read yet", n=unread)))))
    a = proj([sm(W("Pushed {time}", time=T_PUSH)), sm(W("Read by the agent {time}", time=T_READ))],
             [("Comments that wait for the agent", 3), ("Open discrepancies", 1), ("Pending reflections", 1),
              ("Checkpoints that wait for their records", 1)], 1, taken=1)
    b = proj([sm(W("Pushed {time}", time=T_PUSH_OLD)), sm(W("Not read by the agent yet")), mark24()],
             [("Comments that wait for the agent", 2)], 2)
    foot = sm(W("The agent reads these when its work on the project next starts. The NEXUS server runs no AI."))
    return div("ato", div("h2", W("Agent to-do ({n})", n=8)), a, b, foot)


def card(w, kind):
    if kind == "a":
        times = [sm(dot(esc(COMMIT), W("Pushed {time}", time=T_PUSH))), sm(W("Read by the agent {time}", time=T_READ))]
    elif kind == "b":
        times = [sm(dot("c41f0aa", W("Pushed {time}", time=T_PUSH_OLD))), sm(W("Not read by the agent yet")), mark24()]
    else:
        times = [sm(dot(W("No commit"), W("Pushed {time}", time=T_PUSH_3))), sm(W("No agent to-do yet"))]
    kids = [row(ln(118, True), grow(), bt(W("Open"))), ln(150), rv(*times),
            sm(W("Now: {stage} {state}")), sm(W("Next: {next action}"))]
    if kind == "a":
        kids.append(div("thumbs", *[div("thumb", n) for n in ("01", "05", "07")]))
        chips = "".join("<span><em>%02d</em>%s</span>" % (n, "✓" if n < 2 else ("◐" if n == 2 else "○")) for n in range(1, 14))
        kids.append(div("stg", chips))
        kids.append(sm(dot(W("{n} items", n=365), W("{n} warnings", n=2), W("{n} open comments", n=4))))
    else:
        kids.append(sm(W("No picture yet")))
        kids.append(sm(dot(W("{n} items", n=120 if kind == "b" else 48), W("{n} warnings", n=0))))
    return div("pcard", *kids)


def projects(w, st):
    kinds = ["a", "b", "c"]
    head = row(div("h2", W("Projects ({n})", n=len(kinds))), grow(),
               span("seg2 wait" if st == "loading" else "seg2", span("on", W("By name")), span("", W("By last push"))))
    return div("sec", head, div("pcards", *[card(w, k) for k in kinds]))


def home(w, st):
    bar = ""
    if st == "removed":
        bar = div("nbar", rv(ban("", span("", W("{project} was removed from this server. Its sources stay in Git, and the files on your devices stay.",
                                             project=REMOVED)), row(bt(W("Close"))), ic="i")))
    body = div("hp", div("hcols", my_turn(w, st), agent_todo(w, st)), projects(w, st))
    return tb_home(w) + div("hpw", bar, body)


# ------------------------------------------------------------------ SCR-111, the workspace
def shape(no, cur):
    return "✓" if no < cur else ("◐" if no == cur else "○")


def tb_ws(w, cur):
    if w == 390:
        return div("tb", span("ib", "‹"), span("grow h3", stage_name(cur), " ▾"), bt(W("Search")))
    crumb = span("crumb", lk(W("All projects")), "›", ln(84, True), "›", span("", stage_name(cur)))
    return div("tb", span("brand", W("NEXUS")), crumb, find_field(), grow(), lk(W("Full checks")))


def whead(w, *, mark=False, fold=True, loading=False, show_rv=False, space=True):
    if not space:
        times = [sm(dot(esc(COMMIT), W("Pushed {time}", time=T_PUSH_OLD))), sm(W("No agent to-do yet"))]
    elif mark:
        times = [sm(dot(esc(COMMIT), W("Pushed {time}", time=T_PUSH_OLD))),
                 sm(W("Read by the agent {time}", time=T_READ_OLD)), mark24()]
    else:
        times = [sm(dot(esc(COMMIT), W("Pushed {time}", time=T_PUSH))), sm(W("Read by the agent {time}", time=T_READ))]
    data = bt(W("Project data")) if w == 390 else row(lk(W("Project data")))
    ctl = span("ib wait" if loading else "ib", "«") if (fold and w == 1440) else ""
    if ctl and show_rv:
        ctl = rv(ctl)
    block = rv(*times, data) if show_rv else div("col", *times, data)
    return div("whead", row(ln(120, True), grow(), ctl), ln(150), block)


def part_switch():
    return div("psw", span("on", "nexus"), span("", "memory"))


def stage_list(w, cur, mt=True):
    rows = []
    for g, nos in GROUPS:
        rows.append(div("sg", W(g)))
        for no in nos:
            kids = [span("", shape(no, cur)), span("n", "%02d" % no), span("", W(STAGE_NAMES[no - 1]))]
            if no in PIC:
                kids.append(span("", "▣"))
            kids.append(span("c", str(ITEMS[no])))
            if no == cur and mt:
                kids.append(span("mt", "2"))
            rows.append(div("sr on" if no == cur else "sr", *kids))
    return div("sl", *rows)


def legend():
    return div("leg", dot(W("✓ done"), W("◐ in progress"), W("○ not started"), W("– skipped"), W("? not recorded"),
                          "▣ " + W("picture")))


def list_col(w, cur, *, space=True, **kw):
    return div("cl", whead(w, space=space, **kw), part_switch(), stage_list(w, cur, mt=space), legend())


def rail(cur, mark):
    kids = [div("rs top", span("ib", "»"))]
    if mark:
        kids.append(div("rs", span("dia")))
    for no in range(1, 14):
        k = [span("", "%02d" % no), span("shp", shape(no, cur))]
        if no == cur:
            k.append(span("mt", "2"))
        kids.append(div("rs on" if no == cur else "rs", *k))
    return div("rail rvo", *kids)


def stage_sheet(cur, *, mark=False, show_rv=False):
    return div("scrim") + div("sheet tall", whead(390, mark=mark, show_rv=show_rv), part_switch(), stage_list(390, cur))


def tabs(first, on, *, item=False, show_rv=False, cur=2, space=True):
    t1 = div("tab on" if on == "stage" else "tab", W(first))
    k2 = [span("", W("Talk {n}", n=TALK_N[cur] if space else 0))]
    if space:
        k2.append(span("sub", W("My turn {n}", n=2)))
    t2 = div(("tab on" if on == "talk" else "tab") + (" rvo" if show_rv else ""), *k2)
    t3 = div("tab on" if on == "item" else "tab", W("Item")) if item else ""
    return div("tabs", t1, t2, t3)


def pushed_again_bar():
    return div("nbar", ban("", span("", W("This project was pushed again at {time}. Load again to see it.", time="2026-11-11 16:48")),
                           row(bt(W("Load again"))), ic="i"))


# ------------------------------------------------------------------ SCR-112 and SCR-113, the stage
def talk_button(cur, show_rv=True):
    b = bt(dot(W("Talk ({n})", n=TALK_N[cur]), W("My turn {n}", n=2)))
    return rv(b) if show_rv else b


def shead(w, cur, *, pic, talk_btn=False, rv_counts=False, rv_talk=True, late=False):
    drawn = TIMES[late]["drawn"]
    name = span("h2", stage_name(cur))
    state = span("sm", W("◐ in progress"))
    cp = W("Last checkpoint {date}", date="2026-11-08")
    if pic:
        counts = dot(W("{n} contexts", n=7), W("{n} terms", n=42), W("{n} open hotspots", n=3))
        commit = dot(cp, W("Commit {commit}", commit=COMMIT), W("drawn {time}", time=drawn))
    else:
        counts = W("{n} requirements", n=166)
        commit = dot(cp, W("Commit {commit}", commit=COMMIT), drawn)
    tb = talk_button(cur, rv_talk) if talk_btn else ""
    if w == 1440:
        c = span("sm ink", counts)
        if rv_counts:
            c = rv(c)
        if pic:
            l1 = div("l1", name, state, grow(), c, tb)
        else:
            l1 = div("l1", name, state, grow(), c, bt(W("Stage record")), tb)
        return div("sh", l1, sm(commit))
    return div("sh", sm(dot(W("◐ in progress"), commit)), row(sm(counts), grow(), bt(W("Stage record"))))


def tools(w, view="picture"):
    """The tools' line: Picture and List, the tools of the view that shows, and Stage record. The zoom, Fit and Go to
    are the picture's and do not show with the list (SCR-112's layout of the revision; stage 09's sheet of the views)."""
    seg = span("seg2", span("on" if view == "picture" else "", W("Picture")), span("on" if view == "list" else "", W("List")))
    pic = view == "picture"
    if w == 1440:
        own = [span("ib", "−"), sm("100%"), span("ib", "+"), bt(W("Fit")), bt(W("Go to"))] if pic else []
        return div("tools", seg, *own, grow(), bt(W("Stage record")))
    return div("tools", seg, *([bt(W("Fit")), bt(W("Go to"))] if pic else []))


def picture(w, *, sel=None, cols=None, sk=False):
    if sk:
        return div("pc sk")
    cols = cols or (3 if w == 390 else 6)
    nrows = 6 if w == 390 else 8
    nodes = []
    for j in range(nrows):
        for i in range(cols):
            if (i * 7 + j * 3) % 5 == 4:
                continue
            x, y = 20 + i * 128 + (j % 2) * 24, 20 + j * 92
            cls = "nd" + (" k2" if (i + 2 * j) % 4 == 0 else "") + (" sel" if sel == (i, j) else "")
            nodes.append(div(cls, ln("78%", True), ln("52%"), style="left:%dpx;top:%dpx" % (x, y)))
    extra = div("map", "<i></i>")
    extra += div("pleg", ln(120)) if w == 1440 else div("zb", span("ib", "−"), span("ib", "+"))
    return div("pc", *nodes, extra)


def pic_stage(w, cur, *, sel=None, talk_btn=False, rv_counts=False, cols=None, sk=False, rv_talk=True, late=False):
    return (shead(w, cur, pic=True, talk_btn=talk_btn, rv_counts=rv_counts, rv_talk=rv_talk, late=late) + tools(w)
            + picture(w, sel=sel, cols=cols, sk=sk))


def doc_list(w, *, sel=None, narrowed=False, nrows=16, prefix="REQ", rv_row=True, space=True):
    def chip(lbl, n, on=False):
        return span("chip on" if on else "chip", span("", W(lbl)), span("sm", str(n)))
    req = prefix == "REQ"
    total, talk, left = (166, 12, 9) if req else (59, 5, 4)
    if not space:
        talk = 0
    f = [chip("All", total, not narrowed), chip("With talk", talk), chip("My turn", 1 if space else 0, narrowed),
         chip("What is left", left)]
    f.append(div("frow", div("fld", W("Search in this stage")), bt(W("By context") + " ▾")))
    # At 390 the list is drawn scrolled, so that the selected row is in sight.
    first = 3 if (w == 390 and sel and not narrowed) else 0
    rows = [] if (narrowed or first) else [div("gr", idc("CTX-003"), ln(110, True), span("sm", "9"))]
    for k in range(first, nrows):
        rid = "%s-%d" % (prefix, 101 + k)
        on = rid == sel and not narrowed
        mine = span("mt", "1") if k == 11 and space else ""
        cm = span("f", W("{n} comments", n=3 if k == 2 else 2)) if k in (2, 6, 11) and space else ""
        if req:
            fields = span("f", dot(W("Priority") + " Must", W("Status") + " built"))
        else:
            fields = span("f", ln(64), " ", ln(40))
        text = ln("%d%%" % (52 + (k * 13) % 44))
        cls = ("ir on rvo" if rv_row else "ir on") if on else "ir"
        if k == 9:
            rows.append(div("gr", idc("CTX-004"), ln(90, True), span("sm", "1" if narrowed else "12")))
        if narrowed and k != 11:
            continue
        if w == 1440:
            rows.append(div(cls, span("i", idc(rid)), span("t", text), fields, cm, mine))
        else:
            rows.append(div(cls, span("i", idc(rid), mine), span("t", text), div("row", fields, cm)))
    if not narrowed:
        # The list goes on: the stage has more rows than a frame draws.
        rows.append(div("goon", "<i></i><i></i><i></i>"))
    return div("flt", *f) + div("il", *rows)


def doc_stage(w, cur, *, sel=None, narrowed=False, talk_btn=False, rv_row=True, late=False, space=True):
    return (shead(w, cur, pic=False, talk_btn=talk_btn, late=late)
            + doc_list(w, sel=sel, narrowed=narrowed, rv_row=rv_row, space=space))


# ------------------------------------------------------------------ SCR-114, the talk
def talk_head(w, cur, *, fold=True, show_rv=False, loading=False):
    ctl = ""
    if fold and w == 1440:
        ctl = span("ib wait" if loading else "ib", "»")
        if show_rv:
            ctl = rv(ctl)
    return div("ph", span("", W("Talk")), span("sm", stage_name(cur)), grow(), ctl)


def halves(mine=2, agent=4):
    return div("halves", span("", W("My turn {n}", n=mine)), span("", W("The agent's turn {n}", n=agent)))


def talk_request(w, item, show_rv=True, late=False):
    r = rv if show_rv else (lambda *k, **kw: div("col", *k))
    return div("ent", row(tag(W("Checkpoint")), sm(W("the stage as a whole"))), sm(W("Agent"), SEP, TIMES[late]["req"]),
               r(lns("100%", "95%", "100%", "90%", "62%"), row(sm(W("Look at first")), lk(idc(item) + " " + ln(90))), cls="gap"),
               div("acts", r(bt(W("Stage record"), "pri")), bt(W("Reply"))))


def sample(item):
    """The items of a stage's sample talk: those of 01 for a context or a term, those of 02 otherwise."""
    p = "TERM" if item.startswith(("CTX", "TERM")) else "REQ"
    return {"reco": p + "-112", "proposal": p + "-140", "taken": p + "-125", "gone": p + "-099"}


def talk_request_plain():
    """A request stored without the form shows as it is, without "Look at first"."""
    return div("ent", row(tag(W("Checkpoint")), sm(W("the stage as a whole"))), sm(W("Agent"), SEP, "2026-11-10 18:22"),
               lns("100%", "62%"), div("acts", bt(W("Stage record"), "pri"), bt(W("Reply"))))


def talk_reco(item, late=False):
    return div("ent", row(tag(W("Recommendation")), idc(item), ln(90)), sm(W("Agent"), SEP, TIMES[late]["reco"]),
               lns("100%", "70%"), div("acts", bt(W("As recommended")), bt(W("Reply"))))


def agent_entry(item, wait, unread, kind=None, show_rv=True):
    head = [tag(W(kind))] if kind else []
    head += [idc(item), ln(110)]
    st = [sm(wait)]
    if unread:
        t = tag(W("Not read by the agent yet"))
        st.append(rv(t) if show_rv else t)
    return div("ent", row(*head), ln("86%"), row(*st))


def talk_box(target=None, notice="", filled=False):
    ph = W("Comment on {id}", id=target) if target else W("Comment on the stage as a whole")
    box = div("fld area filled", lns("90%", "46%")) if filled else div("fld area", ph)
    return div("pf", notice, box,
               row(sm(W("The agent reads this at its next work on the project."), cls="grow"), bt(W("Leave"))))


def talk_body(w, item, *, show_rv=True, apart=None, plain=False, late=False):
    """The stage's talk by turn. apart: None, "listed" or "picked", for the entry whose item is gone."""
    s = sample(item)
    wait = lambda t: W("Waiting for the agent since {time}", time=t)
    kids = [div("gh", W("My turn ({n})", n=2)), talk_request(w, item, show_rv, late)]
    if plain:
        kids.append(also(talk_request_plain()))
    kids += [talk_reco(s["reco"], late),
             div("gh", W("The agent's turn ({n})", n=4)),
             agent_entry(item, wait(TIMES[late]["w1"]), True, show_rv=show_rv),
             agent_entry(s["proposal"], W("Accepted, not yet reflected"), True, kind="Proposal", show_rv=show_rv)]
    if late:
        kids += [agent_entry(s["taken"], wait("2026-11-10 22:05"), True, show_rv=show_rv),
                 agent_entry(item, wait("2026-11-08 19:30"), False)]
    else:
        kids += [agent_entry(s["taken"], W("Taken by the agent at {time}", time="2026-11-11 09:14"), False),
                 agent_entry(item, wait("2026-11-10 22:05"), False)]
    if apart:
        kids.append(div("gh", W("Apart: comments whose item is gone ({n})", n=1)))
        e = [row(idc(s["gone"]), ln(110)), ln("70%"), sm(W("User"), SEP, "2026-11-08 10:31")]
        if apart == "picked":
            e += [rv(sm(W("{id} is no longer in this stage.", id=s["gone"]), cls="ink")), div("acts", bt(W("Reply")))]
        kids.append(div("ent open" if apart == "picked" else "ent", *e))
    kids.append(div("gh", W("Closed ({n})", n=6)))
    return div("pb", *kids)


def talk_side(w, cur, item, *, late=False, space=True):
    """The talk as the workspace's side, as it is beside any stage."""
    if not space:
        none = sm(W("No talk on this stage yet. Select an item to talk about it, or write about the stage as a whole."))
        return div("side", talk_head(w, cur), halves(0, 0), div("pb"), talk_box(notice=none))
    return div("side", talk_head(w, cur), halves(),
               talk_body(w, item, show_rv=False, apart="listed" if cur == 2 else None, late=late), talk_box())


# ------------------------------------------------------------------ SCR-115, the item
def open_entry(item, show_rv=False):
    unread = tag(W("Not read by the agent yet"))
    e = div("ent open", row(idc(item), ln(96)), lns("100%", "78%"), sm(W("User"), SEP, "2026-11-10 21:40"),
            div("rep", sm(W("Agent"), SEP, "2026-11-11 09:20"), lns("96%", "64%")),
            div("rep", sm(W("User"), SEP, "2026-11-11 15:20"), lns("82%")),
            row(sm(W("Waiting for the agent since {time}", time="2026-11-11 15:20")), rv(unread) if show_rv else unread),
            div("acts", bt(W("Reply"))))
    return e


def item_talk(item, show_rv=True):
    head = div("gh", span("h3", W("Talk on {id}", id=item)), grow(), lk(W("All talk of the stage")))
    kids = [head, open_entry(item),
            div("ent", row(idc(item), ln(80)), ln("72%"), sm(W("Waiting for the agent since {time}", time="2026-11-10 22:05")))]
    return rv(*kids) if show_rv else div("col", *kids)


def item_head(item, kind="requirement", on="Item"):
    return div("ph", idc(item), span("sm", W(kind)), grow(),
               span("seg2", span("on" if on == "Talk" else "", W("Talk")), span("on" if on == "Item" else "", W("Item"))),
               bt(W("Close")))


def item_panel(w, item, *, why=None, scrolled=False, show_rv=True, extra="", kind="requirement"):
    kids = []
    if why:
        b = [span("", W(why))]
        if "narrowed" in why:
            b.append(row(bt(W("Show all"))))
        kids.append(rv(ban("", *b, ic="i")))
    if extra:
        kids.append(extra)
    req = kind == "requirement"
    if not scrolled:
        kids.append(lns("100%", "92%", "64%"))
        if req:
            kids.append(div("fields", sm(W("Priority")), span("", "Must"), sm(W("Status")), span("", "built"),
                            sm(W("Part of")), span("", "nexus")))
        else:
            # The fields of a context or a term are the source's own: their names and values are the project's text.
            kids.append(div("fields", ln(64), ln(120), ln(48), ln(88)))
        if kind != "context":
            kids.append(sm(W("Context: {id} {name}", id="CTX-003")))
        kids.append(sm(W("Source: {path}, line {n}")))
        if kind != "context":
            kids += [div("gh", W("Comes from")), row(idc("CTX-003"), ln(140))]
    leads = [("FL-106", 150), ("SPEC-119", 120), ("SCR-112", 96)] if req else [("REQ-107", 150), ("FL-106", 120), ("SPEC-119", 96)]
    kids += [div("gh", W("Leads to"))] + [row(idc(i), ln(n)) for i, n in leads]
    kids.append(item_talk(item, show_rv))
    return item_head(item, kind) + div("pb", *kids) + talk_box(item)


# ------------------------------------------------------------------ the stage record
def bd(browser, device):
    b, d = Wt(browser), Wt(device)
    return T("%s, %s" % (b[0], d[0]), "%s, %s" % (b[1], d[1]))


def record(w, cur, st, item):
    n = "%02d" % cur
    wide = w == 1440
    head = div("ph", span("", W("Stage record")), span("sm", stage_name(cur)), grow(), lk(W("Back to the talk")))
    kids = [row(span("sm", W("◐ in progress")), span("sm", W("Next action")), ln(120))]
    kids.append(rv(div("ent", row(tag(W("Checkpoint")), sm(W("Agent"), SEP, "2026-11-11 13:40")),
                       lns("100%", "95%", "100%", "90%", "62%"), req_facts(item))))
    off = ""
    if st == "stale":
        kids.append(rv(ban("warn", span("", W("The project now shows another commit: {commit}. Look again before you pass.",
                                             commit=COMMIT2)), row(bt(W("Load again"))), ic="↻")))
        kids.append(also(sm(W("The checkpoint request changed. Read it again before you pass.")),
                         sm(W("This stage now has a checkpoint request. Read it before you pass."))))
        off = "wait"
    if st == "error":
        kids.append(rv(ban("err", span("", W("This project's space is full. Your text stays here.")), tid(),
                           row(bt(W("Try again"))))))
        kids.append(also(sm(W("This comment is not on the server.")),
                         sm(W("This comment holds as many replies as it may ({limit}). Leave a new comment.")),
                         sm(W("This could not be sent: check the marked field.") + " " + lk(W("Load again")))))
    kids.append(words_box(st != "normal", "1,870" if st != "normal" else "2,000"))
    kids.append(rv(bt(W("Pass the stage {n} checkpoint", n=n), "pri" if not off else off)))
    if st == "normal":
        line = wide
        kv = "kv line" if line else "kv"
        # Passed and recorded before the open request was written; the head's last checkpoint is the newest of them.
        kids += [div("gh", W("Checkpoints")),
                 div("ent", sm(span("ink", "2026-11-08 16:20"), SEP, W("User")),
                     rv(div(kv, div("", W("Commit {commit}", commit="5b7c2e9")), div("", lk(W("Answers the request"))),
                            div("", bd("Safari", "phone"))))),
                 div("ent", sm(span("ink", "2026-11-05 11:02"), SEP, W("User")),
                     rv(div(kv, div("", W("Snapshot {n}", n=412)), div("", bd("Chrome", "desktop")),
                            div("", W("Software drove the browser"))))),
                 div("ent", sm(span("ink", "2026-11-02 17:41"), SEP, W("User"))),
                 div("gh", W("Checks")), lns("90%", "60%")]
    return head + div("pb", *kids)


# ------------------------------------------------------------------ the workspace, put together
def ws(w, cur, *, stage, side="", tabs_html="", bars="", fold_list=False, mark=False, over="", loading=False,
       show_rv=False, space=True):
    if w == 1440:
        left = rail(cur, mark) if fold_list else list_col(w, cur, mark=mark, loading=loading, show_rv=show_rv, space=space)
        return tb_ws(w, cur) + bars + div("ws", left, div("cs", stage), side) + over
    return tb_ws(w, cur) + bars + tabs_html + div("tabc", stage) + over


# ------------------------------------------------------------------ SCR-130, the project's data
def data_times(w, st):
    push = div("drow", span("sm", W("Last push")),
               span("", T(*T_PUSH_OLD) if st != "stale-push" else T(*T_PUSH), SEP, W("Commit {commit}", commit=COMMIT)))
    if st == "empty":
        read = div("drow", span("sm", W("Last read by the agent")), span("", W("No agent to-do yet")))
        return [push, read]
    read = div("drow", span("sm", W("Last read by the agent")),
               span("", T(*T_READ_OLD), SEP, W("Session {label}", label="claude-code-4f2a91")))
    return [push, read, div("col", mark24())]


OPEN_COMMENTS = ["nc_3a6d9g2j5m8r", "nc_8k1n4q7s0v3y", "nc_5s8v1y4b7e0h", "nc_7b0e3h6k9n2q", "nc_4m7p0s3v6y9c", "nc_9d2g5j8m1p4s",
                 "nc_6t9w2z5c8f1j", "nc_1h4k7n0q3t6w", "nc_0r3u6x9a2d5g"]


def data_counts(zero=False):
    vals = [("Comments", 23), ("Replies", 40), ("Recorded decisions", 6), ("Proposals", 5), ("Reflections", 3),
            ("Checkpoints passed in NEXUS", 4)]
    return [div("dcnt", span("", W(k)), span("", "0" if zero else str(v))) for k, v in vals]


def data_acts(w, *, off=False, running=False, export_note="", remove_note=""):
    o = "wait" if off else ""
    ex = bt(W("Preparing the file…"), "wait") if running else bt(W("Export"), o)
    a1 = div("dact", sm(W("One JSON file with this project's comments, proposals, reflections and checkpoints. It is your own copy: the server keeps none, and NEXUS reads no export back in.")), ex)
    a2 = div("dact", sm(W("Deletes this project's snapshot and space from this server. Its sources stay in Git, and the files on your devices stay.")),
             bt(W("Remove this project"), o))
    return [export_note, a1, remove_note, a2]


def id_list(label, ids, total):
    more = " " + span("sm", W("{n} of {total}", n=len(ids), total=total)) if total > len(ids) else ""
    return div("", div("gh", W(label), span("sm", str(total))), div("idl", "".join(idc(i) for i in ids) + more))


def removal(w, st):
    name = PROJECT
    ready = st == "removal-ready"
    kids = [div("h2", W("Remove {project} from this server", project=name))]
    if st == "stale":
        kids.append(ban("warn", span("", W("What this removal deletes changed while this was open. Check it again.")), ic="↻"))
    kids += [span("", W("This deletes:")),
             sm(W("The snapshot, with {n} pictures and {m} discrepancies. A push makes these again.", n=5, m=21), cls="ink"),
             sm(W("The project space, with what Git does not hold:"), cls="ink"),
             sm(dot(*[W(k) + " " + str(v) for k, v in [("Comments", 24 if st == "stale" else 23), ("Replies", 40), ("Recorded decisions", 6),
                                                       ("Proposals", 5), ("Reflections", 3), ("Checkpoints passed in NEXUS", 4)]])),
             div("two",
                 id_list("Open comments", OPEN_COMMENTS + (["nc_2f5h8k1n4q7t"] if st == "stale" else []), 10 if st == "stale" else 9),
                 id_list("Open proposals", ["np_2b5e8g1j4m7p"], 1),
                 id_list("Pending reflections", ["ne_9c3f6h2k5n8q"], 1),
                 id_list("Checkpoints not yet recorded", ["nk_5q8t1w4z7c2f"], 1)),
             row(bt(W("Export first"))),
             sm(W("A removed project comes back only by a first push that you agree to in a session, with an empty space."), cls="ink")]
    field = div("fld filled" if ready else "fld", esc(name) if ready else "")
    go = bt(W("Remove {project} from this server", project=name), "pri" if ready else "wait")
    foot = [span("sm ink", W("Type the project's name to confirm: {project}", project=name)), field]
    foot.append(div("acts", bt(W("Cancel")), go))
    if ready:
        foot.append(also(div("acts", bt(W("Cancel"), "wait"), bt(W("Removing…"), "wait"))))
    return div("pb", *kids) + div("pf", *foot)


def data_body(w, st):
    head = div("ph", span("", W("Project data")), span("sm ink", PROJECT), grow(), bt(W("Close")))
    if st in ("removal", "removal-ready", "stale"):
        return head + removal(w, st)
    kids = []
    if st == "loading":
        kids += [div("drow", ln(110), ln(220)), div("drow", ln(140), ln(250)), div("gh", ln(180, True))]
        kids += [div("dcnt", ln(90 + 12 * i), ln(24)) for i in range(6)]
        kids += data_acts(w, off=True)
        kids.append(also(*data_acts(w, running=True)[:2]))
    elif st == "normal":
        kids += data_times(w, st)
        kids.append(div("gh", W("On this server, and not in Git")))
        kids += data_counts()
        kids.append(also(ban("", span("", W("Your browser has the file {file}.", file="nexus-acme-shop-2026-11-11.json")), ic="i")))
        kids += data_acts(w)
    elif st == "empty":
        kids += data_times(w, st)
        kids.append(div("gh", W("On this server, and not in Git")))
        kids += data_counts(zero=True)
        kids.append(span("", W("This project has no space yet: nothing here is missing from Git.")))
        kids += data_acts(w)
    elif st == "error":
        kids += data_times(w, st)
        kids.append(div("gh", W("On this server, and not in Git")))
        kids += data_counts()
        note = ban("err", span("", W("No file was made.")), span("", W("Something went wrong on the server. Try again.")), tid(),
                   row(bt(W("Try again"))))
        kids += data_acts(w, export_note=note)
        kids.append(also(sm(W("A request from another site is refused. Open this page at the server's own address.") + " "
                            + lk(W("Open this page"))),
                         ban("err", span("", W("Something went wrong on the server. Try again.")), tid(), row(bt(W("Try again"))))))
    elif st == "permission":
        kids += data_times(w, st)
        kids.append(div("gh", W("On this server, and not in Git")))
        kids += data_counts()
        note = ban("err", span("", W("Only you can do this, signed in yourself.")))
        kids += data_acts(w, export_note=note)
        kids.append(also(sm(W("This sign-in cannot write here. Check the Access policy.")),
                         sm(W("Your sign-in has expired. Sign in again: what you wrote stays here.") + " " + lk(W("Sign in again")))))
    elif st == "gone":
        kids.append(ban("err", span("", W("This project is not on the server.")), span("", W("There is nothing to export.")),
                        row(lk(W("All projects")))))
        kids += data_acts(w, off=True)
        kids.append(also(sm(W("There is nothing to remove."))))
    return head + div("pb", *kids)


def data_frame(w, st):
    """The panel over the workspace that waits behind it; the project of SCR-130#empty has no space."""
    body = data_body(w, st)
    sp = st != "empty"
    if w == 1440:
        base = ws(1440, 2, stage=doc_stage(1440, 2, late=True, space=sp), side=talk_side(1440, 2, "REQ-107", late=True, space=sp),
                  mark=sp, space=sp)
        return base + div("scrim") + div("dp", body)
    base = ws(390, 2, stage=doc_stage(390, 2, late=True, space=sp), tabs_html=tabs("List", "stage", space=sp))
    return base + div("scrim") + div("sheet", body)
