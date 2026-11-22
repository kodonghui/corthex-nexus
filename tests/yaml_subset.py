"""Read the YAML subset that `api/openapi.yaml` is written in, with Python alone.

The contract is written in plain block YAML so that it reads well and any YAML tool loads it: block mappings and
block sequences indented by two spaces, flow sequences of scalars (`[a, b]`), `{}` and `[]`, and scalars that are
plain or double-quoted with JSON escapes. Anything else raises `ValueError`, so the file stays inside the subset
and the tests never misread it.
"""

import json
import re

KEY = re.compile(r'^("(?:[^"\\]|\\.)*"|[^\s"#:][^:#]*?):(?: (.*))?$')
PLAIN_NUMBER = re.compile(r"^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?$")


def scalar(text):
    text = text.strip()
    if text.startswith('"'):
        value, end = json.JSONDecoder().raw_decode(text)
        if text[end:].strip():
            raise ValueError("text after a quoted scalar: %r" % text)
        return value
    if text in ("null", "~"):
        return None
    if text == "true":
        return True
    if text == "false":
        return False
    if text == "{}":
        return {}
    if text == "[]":
        return []
    if text.startswith("["):
        if not text.endswith("]"):
            raise ValueError("an unclosed flow sequence: %r" % text)
        inner = text[1:-1].strip()
        if not inner:
            return []
        items, depth, start, quoted, escaped = [], 0, 0, False, False
        for index, char in enumerate(inner):
            if quoted:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    quoted = False
            elif char == '"':
                quoted = True
            elif char in "[{":
                raise ValueError("a nested flow collection: %r" % text)
            elif char == ",":
                items.append(inner[start:index])
                start = index + 1
        items.append(inner[start:])
        return [scalar(item) for item in items]
    if text[:1] in "{&*!|>%@`'":
        raise ValueError("a scalar outside the subset: %r" % text)
    if PLAIN_NUMBER.match(text):
        return float(text) if any(c in text for c in ".eE") else int(text)
    if " #" in text:
        raise ValueError("a comment after a value: %r" % text)
    return text


def key_of(text):
    return scalar(text) if text.startswith('"') else text.strip()


def load(text):
    lines = []
    for number, raw in enumerate(text.splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise ValueError("line %d: a tab in the indentation" % number)
        lines.append((number, len(raw) - len(raw.lstrip(" ")), raw.strip()))
    value, index = block(lines, 0, 0)
    if index != len(lines):
        raise ValueError("line %d: unexpected indentation" % lines[index][0])
    return value


def block(lines, index, indent):
    number, level, text = lines[index]
    if level != indent:
        raise ValueError("line %d: expected indentation %d" % (number, indent))
    if text.startswith("- ") or text == "-":
        result = []
        while index < len(lines) and lines[index][1] == indent and (lines[index][2].startswith("- ") or lines[index][2] == "-"):
            number, _, text = lines[index]
            rest = text[2:].strip()
            if not rest:
                value, index = block(lines, index + 1, indent + 2)
            elif KEY.match(rest) and not rest.startswith('"') or (rest.startswith('"') and KEY.match(rest)):
                # A mapping that starts on the dash line: read it as if the dash were two spaces.
                lines[index] = (number, indent + 2, rest)
                value, index = block(lines, index, indent + 2)
            else:
                value, index = scalar(rest), index + 1
            result.append(value)
        return result, index
    result = {}
    while index < len(lines) and lines[index][1] == indent and not lines[index][2].startswith("- "):
        number, _, text = lines[index]
        match = KEY.match(text)
        if not match:
            raise ValueError("line %d: not a key: %r" % (number, text))
        key = key_of(match.group(1))
        if key in result:
            raise ValueError("line %d: the key %r again" % (number, key))
        rest = match.group(2)
        if rest is None or not rest.strip():
            if index + 1 < len(lines) and lines[index + 1][1] > indent:
                result[key], index = block(lines, index + 1, lines[index + 1][1])
            elif index + 1 < len(lines) and lines[index + 1][1] == indent and lines[index + 1][2].startswith("- "):
                result[key], index = block(lines, index + 1, indent)
            else:
                raise ValueError("line %d: a key without a value" % number)
        else:
            result[key], index = scalar(rest), index + 1
    return result, index
