"""Checks that pydantic cannot express: graph shape, references and earned reveals.

Errors make a question unusable. Warnings are content gaps a reviewer should see.
"""

import re
from dataclasses import dataclass, field

from .content import EXIT, Node, Stage, TermItem, TutorQuestion
from .session import OFF_TOPIC, UNCLEAR

RESERVED = {UNCLEAR, OFF_TOPIC}


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def successors(node: Node) -> list[str]:
    if node.kind == "probe":
        return [b.next for b in node.branches()]
    return [node.next] if node.next else []


def _reaches(stage: Stage, target: str) -> set[str]:
    """Node ids from which `target` is reachable (target excluded)."""
    found: set[str] = set()
    changed = True
    while changed:
        changed = False
        for nid, node in stage.nodes.items():
            if nid in found or nid == target:
                continue
            if any(s == target or s in found for s in successors(node)):
                found.add(nid)
                changed = True
    return found


def _stage_reveals(stage: Stage) -> set[str]:
    items = {r.item for r in stage.intro.reveal}
    for node in stage.nodes.values():
        items |= {r.item for r in node.line.reveal}
        for h in node.hints:
            items |= {r.item for r in h.reveal}
        for b in node.branches():
            items |= set(b.reveal)
    return items


def _phrases(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower())


def validate(q: TutorQuestion) -> Report:
    r = Report()
    board = set(q.board)
    metrics = {m.id for m in q.metrics}
    catalogue = {m.id for m in q.misconceptions}
    terms = {t.id for t in q.terms}

    def need_item(item: str, where: str):
        if item not in board:
            r.errors.append(f"{where}: unknown board item {item}")

    for p in q.pinned:
        need_item(p, "pinned")
    for key, item in q.board.items():
        if isinstance(item, TermItem) and item.termId not in terms:
            r.errors.append(f"board {key}: term {item.termId} not in terms")
    for lang in q.speech:
        if lang not in q.languages:
            r.errors.append(f"speech mode for {lang}, which is not a question language")
    for lang in q.languages:
        if lang not in q.speech:
            r.errors.append(f"no speech mode for {lang}")
        if lang not in q.review.languages:
            r.errors.append(f"no review state for {lang}")

    seen_nodes: dict[str, str] = {}
    stage_ids = [s.id for s in q.stages]
    if len(set(stage_ids)) != len(stage_ids):
        r.errors.append("stage ids must be unique")

    for stage in q.stages:
        where = f"stage {stage.id}"
        if stage.start not in stage.nodes:
            r.errors.append(f"{where}: start {stage.start} is not a node")
            continue
        for item in stage.intro.reveal:
            need_item(item.item, f"{where} intro")
        for nid, node in stage.nodes.items():
            at = f"{where}/{nid}"
            if nid in seen_nodes:
                r.errors.append(f"{at}: node id also used in stage {seen_nodes[nid]}")
            seen_nodes[nid] = stage.id
            for rv in node.line.reveal:
                need_item(rv.item, at)
            for f in node.line.focus:
                need_item(f, at)
            for s in successors(node):
                if s != EXIT and s not in stage.nodes:
                    r.errors.append(f"{at}: next {s} is not a node in this stage")
            if node.kind != "probe":
                continue
            ids = [b.id for b in node.branches()]
            if len(set(ids)) != len(ids):
                r.errors.append(f"{at}: branch ids repeat")
            if node.expect[0].level != "ok":
                r.errors.append(f"{at}: the first expect branch must be level ok (forced advance)")
            for b in node.expect:
                if b.id in catalogue:
                    r.errors.append(f"{at}: expect {b.id} is a catalogue misconception")
            for b in node.misconceptions:
                if b.id not in catalogue:
                    r.errors.append(f"{at}: misconception {b.id} is not in the catalogue")
            for b in node.branches():
                if b.id in RESERVED:
                    r.errors.append(f"{at}: branch id {b.id} is reserved")
                if b.metric not in metrics:
                    r.errors.append(f"{at}: branch {b.id} uses unknown metric {b.metric}")
                for item in b.reveal:
                    need_item(item, f"{at}/{b.id}")
            for h in node.hints:
                for rv in h.reveal:
                    need_item(rv.item, f"{at} hint {h.rung}")
            for c in node.chips:
                if c.route not in ids and c.route != UNCLEAR:
                    r.errors.append(f"{at}: chip routes to {c.route}, not a branch of this node")
            for a in node.answerItems:
                need_item(a, f"{at} answerItems")
            if not node.chips:
                r.warnings.append(f"{at}: no chips (no fallback without a model)")
            if not node.mustNotReveal:
                r.warnings.append(f"{at}: no mustNotReveal phrases")

        # reachability and acyclicity from start
        reach, stack = set(), [stage.start]
        while stack:
            n = stack.pop()
            if n in reach or n == EXIT or n not in stage.nodes:
                continue
            reach.add(n)
            stack.extend(successors(stage.nodes[n]))
        for nid in stage.nodes:
            if nid not in reach:
                r.errors.append(f"{where}/{nid}: unreachable from start")
        if not _acyclic(stage):
            r.errors.append(f"{where}: the graph has a cycle")
        if not any(EXIT in successors(n) for n in stage.nodes.values()):
            r.errors.append(f"{where}: no path reaches {EXIT}")

    graph_broken = any(
        k in e for e in r.errors
        for k in ("not a node in this stage", "is not a node", "cycle", "unreachable", "no path")
    )
    if graph_broken:
        return r   # leak analysis needs a sound graph; reference errors alone don't block it

    # answers only once earned (conservative over all paths)
    earlier: set[str] = set(q.pinned)
    for stage in q.stages:
        for pid, probe in stage.nodes.items():
            if probe.kind != "probe" or not probe.answerItems:
                continue
            answers = set(probe.answerItems)
            before = set(earlier) | {r_.item for r_ in stage.intro.reveal}
            for aid in _reaches(stage, pid):
                anc = stage.nodes[aid]
                before |= {r_.item for r_ in anc.line.reveal}
                for h in anc.hints:
                    before |= {r_.item for r_ in h.reveal}
                for b in anc.branches():
                    if b.next == pid or b.next in _reaches(stage, pid):
                        before |= set(b.reveal)
            before |= {r_.item for r_ in probe.line.reveal}
            for h in probe.hints:
                if h.rung != "answer":
                    before |= {r_.item for r_ in h.reveal}
            leaked = sorted(answers & before)
            if leaked:
                r.errors.append(f"stage {stage.id}/{pid}: answer items shown before earned: {leaked}")
            earned = set().union(*(set(b.reveal) for b in probe.branches()))
            answer_rung = {r_.item for h in probe.hints if h.rung == "answer" for r_ in h.reveal}
            if not answers & (earned | answer_rung):
                r.warnings.append(f"stage {stage.id}/{pid}: answer items are never revealed by its branches")
            # spoken leaks in KiKi's own scripted lines
            spoken = [probe.line.say] + [h.say for h in probe.hints if h.rung in ("question", "nudge")]
            for text in spoken:
                for lang_text in filter(None, (text.en, text.or_)):
                    for phrase in probe.mustNotReveal:
                        if _phrases(phrase) in _phrases(lang_text):
                            r.errors.append(
                                f"stage {stage.id}/{pid}: scripted line says forbidden '{phrase}'"
                            )
        earlier |= _stage_reveals(stage)

    for step in q.nextSteps:
        if step.whenMetric and step.whenMetric not in metrics:
            r.errors.append(f"nextStep {step.id}: unknown metric {step.whenMetric}")
        if step.whenMisconception and step.whenMisconception not in catalogue:
            r.errors.append(f"nextStep {step.id}: unknown misconception {step.whenMisconception}")

    revealed_anywhere = set(q.pinned).union(*(_stage_reveals(s) for s in q.stages))
    for item in sorted(board - revealed_anywhere):
        r.warnings.append(f"board item {item} is never revealed")
    if "or" in q.languages:
        missing = _missing_odia(q)
        if missing:
            r.warnings.append(f"{missing} learner lines have no Odia rendition")
    return r


def _acyclic(stage: Stage) -> bool:
    state: dict[str, int] = {}

    def visit(n: str) -> bool:
        if n == EXIT or n not in stage.nodes:
            return True
        if state.get(n) == 1:
            return False
        if state.get(n) == 2:
            return True
        state[n] = 1
        ok = all(visit(s) for s in successors(stage.nodes[n]))
        state[n] = 2
        return ok

    return all(visit(n) for n in stage.nodes)


def _missing_odia(q: TutorQuestion) -> int:
    lines = [q.framing] + [s.intro.say for s in q.stages]
    for s in q.stages:
        for n in s.nodes.values():
            lines.append(n.line.say)
            lines.extend(h.say for h in n.hints)
    return sum(1 for t in lines if t.or_ is None)
