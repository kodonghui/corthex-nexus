"""Shared pieces of the grey pages: the words, small HTML helpers, the captions.

The pages are stage 08's revision-wireframes.html and stage 09's picture-stage-views.html. They read the definitions
and the words tables of this checkout, by paths from the repository's root."""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "docs" / "08-screens" / "nexus"


def cells(line):
    return [c.strip() for c in re.split(r"(?<!\\)\|", line.strip().strip("|"))]


# ---- the words: every label of a frame comes from a words table ----
PAIRS = {}
CONFLICTS = []
USED = set()


def _add(en, ko, src):
    en, ko = en.strip(), ko.strip()
    if not en:
        return
    if en in PAIRS:
        if PAIRS[en] != ko and (en, ko, src) not in [(c[0], c[2], c[3]) for c in CONFLICTS]:
            CONFLICTS.append((en, PAIRS[en], ko, src))
        return
    PAIRS[en] = ko


def report(out, size, counts):
    """What a generator says when it has drawn its page, with each label that two words tables translate otherwise:
    a frame that draws it takes the first table's form."""
    print("%s: %d bytes, %s, %d labels of the words files used; labels that another words file translates otherwise: %d"
          % (out, size, counts, len(USED), len(CONFLICTS)))
    for en, first, other, src in CONFLICTS:
        print('  "%s": "%s", %s; %s gives "%s"' % (en, first, "drawn" if en in USED else "not drawn here", src, other))


def load_words():
    for f, want in [("revision-words.md", 5), ("redesign-words.md", 4), ("README.md", 4)]:
        for l in (ROOT / f).read_text(encoding="utf8").split("\n"):
            if not l.startswith("| ") or l.startswith("| ---"):
                continue
            c = cells(l)
            if len(c) != want or c[2] == "English":
                continue
            en, ko = c[2], c[3]
            ep, kp = en.split(" · "), ko.split(" · ")
            if len(ep) == len(kp):
                for a, b in zip(ep, kp):
                    _add(a, b, f)
            _add(en, ko, f)


def esc(s):
    return html.escape(str(s), quote=False)


def T(en, ko=None):
    """Text in both languages; one argument is text that is the same in both."""
    if ko is None:
        return esc(en)
    return '<span class="en" lang="en">%s</span><span class="ko" lang="ko">%s</span>' % (esc(en), esc(ko))


def Wt(en, **kw):
    """The pair (English, Korean) of a label of the words files, its braces filled."""
    if en not in PAIRS:
        raise KeyError("not a label of the words files: %r" % en)
    USED.add(en)
    ko = PAIRS[en]
    names = set(re.findall(r"\{([^}]*)\}", en))
    for k in kw:
        if k not in names and k.replace("_", " ") not in names:
            raise KeyError("%r has no {%s}" % (en, k))

    def fill(s, i):
        def rep(m):
            k = m.group(1)
            for key in (k, k.replace(" ", "_")):
                if key in kw:
                    v = kw[key]
                    return v[i] if isinstance(v, tuple) else str(v)
            return m.group(0)
        return re.sub(r"\{([^}]*)\}", rep, s)

    return (fill(en, 0), fill(ko, 1))


def W(en, **kw):
    return T(*Wt(en, **kw))


def loop_time(date, unit, n=None):
    """A time of the loop (rule 19): the date and time, then how long ago."""
    key = {"now": "just now", "min": "{n} min ago", "h": "{n} h ago", "d": "{n} d ago"}[unit]
    ago = Wt(key) if n is None else Wt(key, n=n)
    return Wt("{date} ({ago})", date=date, ago=ago)


# ---- small HTML helpers ----
def el(tag, cls, *kids, **attrs):
    a = "".join(' %s="%s"' % (k.rstrip("_").replace("_", "-"), html.escape(str(v), quote=True)) for k, v in attrs.items())
    c = ' class="%s"' % cls if cls else ""
    return "<%s%s%s>%s</%s>" % (tag, c, a, "".join(kids), tag)


def div(cls, *kids, **attrs):
    return el("div", cls, *kids, **attrs)


def span(cls, *kids, **attrs):
    return el("span", cls, *kids, **attrs)


def ln(w, dk=False):
    return '<i class="ln%s" style="width:%s"></i>' % (" dk" if dk else "", w if isinstance(w, str) else "%dpx" % w)


def lns(*ws):
    return span("lns", *[ln(w) for w in ws])


def bt(label, cls=""):
    return span(("bt " + cls).strip(), span("", label))


def lk(label, cls=""):
    return span(("lk " + cls).strip(), label)


def sm(*kids, cls=""):
    return div(("sm " + cls).strip(), *kids)


def idc(x):
    return span("id", esc(x))


def tag(x):
    return span("tag", x)


def row(*kids, cls=""):
    return div(("row " + cls).strip(), *kids)


def grow():
    return span("grow")


def ban(kind, *kids, ic="!"):
    return div(("ban " + kind).strip(), span("ic", esc(ic)), div("bx", *kids))


def also(*kids):
    return div("also", span("al", T("Also in this state", "이 상태의 다른 경우")), *kids)


def rv(*kids, cls=""):
    """What the revision adds or changes: a dotted outline around it."""
    return div(("rv " + cls).strip(), *kids)


def tid():
    return span("tid", W("Trace ID {traceId}"))


SEP = " · "


def dot(*parts):
    return SEP.join(p for p in parts if p)


def mark24(line=True):
    """The mark of a long wait (rule 20): a shape and words, then its line."""
    m = div("m24", span("dia"), span("", W("Unread for more than 24 hours")))
    if not line:
        return m
    return m + sm(W("Either no session is at work on this project, or its session cannot reach this server."))


# ---- captions, from the definitions ----
def md_inline(s):
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = s.replace("\\~", "~").replace("\\|", "|")
    out = esc(s)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", out)


SCREENS = [
    ("SCR-110", "SCR-110-home"),
    ("SCR-111", "SCR-111-project-workspace"),
    ("SCR-112", "SCR-112-picture-stage"),
    ("SCR-113", "SCR-113-document-stage"),
    ("SCR-114", "SCR-114-talk"),
    ("SCR-115", "SCR-115-item"),
    ("SCR-130", "SCR-130-project-data"),
]


def read_def(name, lang):
    """A definition's title, purpose, and the revision's state rows with the note under them."""
    path = ROOT / (name + (".md" if lang == "en" else ".ko.md"))
    L = path.read_text(encoding="utf8").split("\n")
    title = L[0][2:].split(" ", 1)[1]
    purpose = next(l for l in L if l.startswith("Purpose:" if lang == "en" else "목적:"))
    # SCR-130, which the revision adds, holds its rows without a status column: planned whole, and
    # built whole by TASK-312 on 2026-11-14, so each of its frames gives that status.
    new = name.startswith("SCR-130")
    if new:
        head = "## States" if lang == "en" else "## 상태"
    else:
        head = "### States of the revision" if lang == "en" else "### 설계 수정의 상태"
    i = next(k for k, l in enumerate(L) if l.strip() == head)
    rows, note = [], ""
    for l in L[i + 1:]:
        if l.startswith("#"):
            break
        if l.startswith("| SCR-"):
            c = cells(l)
            want = 3 if new else 4
            if len(c) != want:
                raise ValueError("%s: a state row of %d cells: %s" % (path.name, len(c), c[0]))
            rows.append({"id": c[0], "text": c[1], "from": c[2], "status": c[3] if not new else "built (TASK-312)"})
        elif l.strip() and not l.startswith("|") and rows and not note:
            note = l.strip()
    return {"title": title, "purpose": purpose, "rows": rows, "note": note}
