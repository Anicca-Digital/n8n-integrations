#!/usr/bin/env python3
"""
validate_workflow.py — mechanical QA for an n8n workflow export.

Runs the automated half of QA_Validation_Checklist.md against one or more
exported workflow JSON files. Catches the failures that are silent in n8n:
wrong fan-out mode, IF-after-HTTP reading bare $json, $() references to nodes
that aren't ancestors on every path, retryOnFail on creates, stale second
credentials, and a zero-field Execute Workflow Trigger.

Usage:
    python3 validate_workflow.py workflow.json [more.json ...]
    python3 validate_workflow.py --json workflow.json     # machine-readable
    python3 validate_workflow.py --strict workflow.json   # warnings exit 1

Exit codes: 0 clean (or warnings only), 1 errors found, 2 could not read input.

What it CANNOT check: whether typeVersions suit the target instance, whether
credential names match that instance, whether the logic matches the spec, or
whether an expression returns the right value. Those stay human.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict, deque

# Node types exempt from the "must have an incoming connection" rule.
TRIGGER_SUFFIXES = (
    "trigger", "webhook", "errortrigger", "executeworkflowtrigger",
    "scheduletrigger", "manualtrigger", "cron", "interval", "start", "chattrigger",
)
NO_INPUT_TYPES = {"n8n-nodes-base.stickynote"}

# Nodes that can emit more than one item from a single input item.
# A fan-out returns a mapped collection (`return deals.map(...)`) or a plural
# variable. `return [{ json: {...} }]` is a single item even if .map() appears
# inside it, so the identifier must come directly after `return`.
FANOUT_CODE_HINT = re.compile(
    r"return\s+[A-Za-z_$][\w$.]*\s*\.(map|flatMap)\s*\(|"
    r"return\s+(results|items|out|rows|records|deals|entries|list|arr)\s*;",
    re.I,
)

SEVERITY_ORDER = {"ERROR": 0, "WARN": 1, "INFO": 2}


class Finding:
    def __init__(self, severity, check, node, message):
        self.severity = severity
        self.check = check
        self.node = node
        self.message = message

    def as_dict(self):
        return {"severity": self.severity, "check": self.check,
                "node": self.node, "message": self.message}


class WorkflowValidator:
    def __init__(self, path):
        self.path = path
        self.findings = []
        self.wf = None
        self.nodes = []
        self.by_name = {}
        self.node_check = shutil.which("node")

    # ---------- helpers ----------

    def add(self, severity, check, node, message):
        self.findings.append(Finding(severity, check, node, message))

    @staticmethod
    def ntype(node):
        return str(node.get("type", "")).lower()

    def is_trigger(self, node):
        t = self.ntype(node)
        return t.endswith(TRIGGER_SUFFIXES) or "trigger" in t.rsplit(".", 1)[-1]

    @staticmethod
    def walk_strings(obj, path=""):
        """Yield (json_path, string) for every string in a nested structure."""
        if isinstance(obj, str):
            yield path, obj
        elif isinstance(obj, dict):
            for k, v in obj.items():
                yield from WorkflowValidator.walk_strings(v, f"{path}.{k}" if path else str(k))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                yield from WorkflowValidator.walk_strings(v, f"{path}[{i}]")

    # ---------- load ----------

    def load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                self.wf = json.load(fh)
        except json.JSONDecodeError as exc:
            self.add("ERROR", "json-parse", None, f"File is not valid JSON: {exc}")
            return False
        except OSError as exc:
            self.add("ERROR", "json-parse", None, f"Could not read file: {exc}")
            return False

        if not isinstance(self.wf, dict) or "nodes" not in self.wf:
            self.add("ERROR", "json-parse", None,
                     "Not an n8n workflow export (no top-level 'nodes' array).")
            return False

        self.nodes = [n for n in self.wf.get("nodes", []) if isinstance(n, dict)]
        for n in self.nodes:
            name = n.get("name")
            if name:
                self.by_name.setdefault(name, n)
        return True

    # ---------- graph ----------

    def build_graph(self):
        """Adjacency built from the connections object, plus reverse edges."""
        self.out_edges = defaultdict(list)
        self.in_edges = defaultdict(list)
        conns = self.wf.get("connections", {})
        if not isinstance(conns, dict):
            self.add("ERROR", "connections-shape", None, "'connections' is not an object.")
            return
        for src, outputs in conns.items():
            if src not in self.by_name:
                self.add("ERROR", "connections-source", src,
                         f"'connections' has a key for '{src}', which is not a node name.")
            if not isinstance(outputs, dict):
                continue
            for _kind, slots in outputs.items():
                if not isinstance(slots, list):
                    continue
                for slot in slots:
                    if not isinstance(slot, list):
                        continue
                    for target in slot:
                        if not isinstance(target, dict):
                            continue
                        tname = target.get("node")
                        if tname not in self.by_name:
                            self.add("ERROR", "connections-target", src,
                                     f"'{src}' connects to '{tname}', which is not a node name.")
                            continue
                        self.out_edges[src].append(tname)
                        self.in_edges[tname].append(src)

    def ancestors_on_every_path(self, target):
        """
        Names that appear on EVERY path from any entry node to `target`.
        A $('X') reference to a node outside this set can throw
        "Node 'X' hasn't been executed" on some branches.
        Computed as a forward dominator intersection; cycle-tolerant.
        """
        entries = [n["name"] for n in self.nodes
                   if n.get("name") and not self.in_edges.get(n["name"])]
        if not entries:
            return None  # cyclic or malformed; skip the check

        dom = {}
        order = []
        seen = set()
        dq = deque(entries)
        while dq:  # topological-ish order, tolerant of cycles
            cur = dq.popleft()
            if cur in seen:
                continue
            seen.add(cur)
            order.append(cur)
            for nxt in self.out_edges.get(cur, []):
                dq.append(nxt)

        for name in order:
            preds = [p for p in self.in_edges.get(name, []) if p in dom]
            if not preds:
                dom[name] = {name}
            else:
                acc = set(dom[preds[0]])
                for p in preds[1:]:
                    acc &= dom[p]
                acc.add(name)
                dom[name] = acc
        return dom.get(target, set())

    def fanout_nodes(self):
        """Nodes that plausibly emit more than one item per input item."""
        out = set()
        for n in self.nodes:
            t = self.ntype(n)
            name = n.get("name")
            if t == "n8n-nodes-base.code":
                code = n.get("parameters", {}).get("jsCode", "") or ""
                if n.get("parameters", {}).get("mode") != "runOnceForEachItem" \
                        and FANOUT_CODE_HINT.search(code):
                    out.add(name)
            elif t in ("n8n-nodes-base.splititems", "n8n-nodes-base.itemlists",
                       "n8n-nodes-base.splitout"):
                out.add(name)
        return out

    def downstream_of(self, starts):
        seen = set()
        dq = deque(starts)
        while dq:
            cur = dq.popleft()
            for nxt in self.out_edges.get(cur, []):
                if nxt not in seen:
                    seen.add(nxt)
                    dq.append(nxt)
        return seen

    # ---------- checks ----------

    def check_names(self):
        counts = defaultdict(int)
        for n in self.nodes:
            name = n.get("name")
            if not name:
                self.add("ERROR", "node-name", None, "A node has no 'name'.")
                continue
            counts[name] += 1
        for name, c in counts.items():
            if c > 1:
                self.add("ERROR", "node-name-unique", name,
                         f"{c} nodes share the name '{name}'. Every $('{name}') "
                         "and connection entry is ambiguous.")
            if re.search(r"\d$", name) and re.sub(r"\d+$", "", name) in counts:
                self.add("WARN", "import-append", name,
                         f"'{name}' looks like an import-append artifact "
                         f"(a duplicate of '{re.sub(chr(92)+'d+$', '', name)}').")

    def check_orphans(self):
        for n in self.nodes:
            name, t = n.get("name"), self.ntype(n)
            if not name or t in NO_INPUT_TYPES or self.is_trigger(n):
                continue
            if not self.in_edges.get(name):
                self.add("ERROR", "orphan-node", name,
                         "No incoming connection — this node will never run.")

    def check_code_nodes(self):
        for n in self.nodes:
            if self.ntype(n) != "n8n-nodes-base.code":
                continue
            name = n.get("name")
            code = n.get("parameters", {}).get("jsCode", "")
            if not code:
                self.add("WARN", "code-empty", name, "Code node has no jsCode.")
                continue
            if re.search(r"\\U[0-9a-fA-F]{4,8}", code):
                self.add("ERROR", "code-unicode-escape", name,
                         r"Contains a \U escape. JS has none — this ships as literal text "
                         r"(use the character itself or a \uXXXX surrogate pair).")
            if "process.env" in code:
                self.add("WARN", "code-env-access", name,
                         "Reads process.env — blocked by default on n8n 2.x self-hosted. "
                         "Move the value into the Config node.")
            if self.node_check:
                self.syntax_check(name, code)

    def syntax_check(self, name, code):
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                         encoding="utf-8") as fh:
            # n8n's globals aren't defined at parse time, but --check is syntax-only.
            fh.write(code)
            tmp = fh.name
        try:
            res = subprocess.run([self.node_check, "--check", tmp],
                                 capture_output=True, text=True, timeout=20)
            if res.returncode != 0:
                first = (res.stderr or "").strip().splitlines()
                detail = next((l for l in first if "SyntaxError" in l), first[-1] if first else "")
                self.add("ERROR", "code-syntax", name, f"jsCode fails node --check: {detail}")
        except (subprocess.SubprocessError, OSError) as exc:
            self.add("INFO", "code-syntax", name, f"Could not syntax-check: {exc}")
        finally:
            os.unlink(tmp)

    def check_expressions(self):
        for n in self.nodes:
            name = n.get("name")
            for jpath, val in self.walk_strings(n.get("parameters", {})):
                if not isinstance(val, str):
                    continue
                # jsCode is plain JavaScript, not an n8n expression: '}}' there
                # (e.g. return [{ json: { a: 1 } }]) is normal, so skip it.
                if jpath == "jsCode" or jpath.endswith(".jsCode"):
                    continue
                if val.startswith("= =") or val.startswith("=="):
                    self.add("ERROR", "expr-double-equals", name,
                             f"{jpath} starts with a doubled '=' prefix — a paste artifact "
                             "that corrupts the resolved value.")
                if val.count("{{") != val.count("}}"):
                    self.add("ERROR", "expr-braces", name,
                             f"{jpath} has unbalanced {{{{ }}}}.")
                for expr in re.findall(r"\{\{(.*?)\}\}", val, flags=re.S):
                    stripped = expr.strip()
                    if stripped.startswith("{") and not stripped.startswith("({"):
                        self.add("ERROR", "expr-object-literal", name,
                                 f"{jpath} has an unparenthesised object literal — "
                                 "use ={{ ({ ... }) }} or it parses as a code block.")

    def check_node_references(self):
        """$('X') must point at a real node that is an ancestor on every path."""
        pattern = re.compile(r"\$\(\s*['\"]([^'\"]+)['\"]\s*\)")
        for n in self.nodes:
            name = n.get("name")
            if not name:
                continue
            blob = json.dumps(n.get("parameters", {}))
            refs = set(pattern.findall(blob))
            if not refs:
                continue
            doms = self.ancestors_on_every_path(name)
            for ref in refs:
                if ref not in self.by_name:
                    self.add("ERROR", "ref-unknown-node", name,
                             f"References $('{ref}'), which is not a node in this workflow.")
                elif doms is not None and ref not in doms and ref != name:
                    self.add("WARN", "ref-not-ancestor", name,
                             f"References $('{ref}'), which is not upstream on every path "
                             "reaching this node — can throw \"hasn't been executed\" on some "
                             "branches. Use $input, or confirm the branch always runs.")

    def check_fanout_modes(self):
        fan = self.fanout_nodes()
        if not fan:
            return
        affected = self.downstream_of(fan)
        for n in self.nodes:
            name = n.get("name")
            if name not in affected:
                continue
            t = self.ntype(n)
            if t == "n8n-nodes-base.code":
                mode = n.get("parameters", {}).get("mode")
                if mode != "runOnceForEachItem":
                    self.add("WARN", "fanout-mode", name,
                             f"Code node downstream of a fan-out ({', '.join(sorted(fan))}) "
                             "is not runOnceForEachItem. Bare $json is ambiguous here, and "
                             ".first() pairs every lane with item 0.")
                code = n.get("parameters", {}).get("jsCode", "") or ""
                for ref in re.findall(r"\$\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\.first\(\)", code):
                    if ref in fan:
                        self.add("ERROR", "fanout-first", name,
                                 f"Uses $('{ref}').first() where '{ref}' fans out — "
                                 "returns item 0 for every lane. Use .item instead.")
            if self.is_side_effect(n):
                self.add("WARN", "fanout-side-effect", name,
                         "Side-effecting node sits downstream of a fan-out, so it runs once "
                         "per item. If it must run once per record, move it before the fan-out.")

    @staticmethod
    def is_side_effect(node):
        t = str(node.get("type", "")).lower()
        if t != "n8n-nodes-base.httprequest":
            return False
        method = str(node.get("parameters", {}).get("method", "GET")).upper()
        return method in ("POST", "PUT", "PATCH", "DELETE")

    def check_if_after_http(self):
        for n in self.nodes:
            if self.ntype(n) not in ("n8n-nodes-base.if", "n8n-nodes-base.switch"):
                continue
            name = n.get("name")
            parents = self.in_edges.get(name, [])
            http_parents = [p for p in parents
                            if self.ntype(self.by_name[p]) == "n8n-nodes-base.httprequest"]
            if not http_parents:
                continue
            blob = json.dumps(n.get("parameters", {}))
            if "$json" in blob and "$(" not in blob:
                self.add("WARN", "if-after-http", name,
                         f"Reads bare $json directly after HTTP node "
                         f"'{http_parents[0]}' — that's the API response, not your data. "
                         "String(undefined) routes TRUE. Name the producing node explicitly, "
                         "unless you deliberately mean that response.")

    def check_if_conditions(self):
        for n in self.nodes:
            if self.ntype(n) != "n8n-nodes-base.if":
                continue
            name = n.get("name")
            conds = n.get("parameters", {}).get("conditions", {})
            inner = conds.get("conditions", []) if isinstance(conds, dict) else []
            if len(inner) > 1:
                self.add("WARN", "if-stacked-conditions", name,
                         f"Holds {len(inner)} conditions combined with "
                         f"'{conds.get('combinator', 'and')}'. Confirm every one is intended — "
                         "the editor hides extras and a leftover silently vetoes the visible one.")
            for c in inner:
                left = str(c.get("leftValue", ""))
                op = (c.get("operator") or {})
                if op.get("type") == "boolean" and "String(" not in left and "{{" in left:
                    self.add("INFO", "if-type-safety", name,
                             "Boolean condition without String(...) coercion — a type mismatch "
                             "routes to FALSE without comparing.")

    def check_credentials(self):
        self._cred_ids = set()
        for n in self.nodes:
            name = n.get("name")
            creds = n.get("credentials")
            if not isinstance(creds, dict):
                continue
            if len(creds) > 1:
                self.add("ERROR", "stale-credential", name,
                         f"{len(creds)} credential entries ({', '.join(creds)}). Exactly one "
                         "per node — the extra is invisible in the editor and reactivates if "
                         "the auth-mode dropdown is flipped back.")
            for ctype, cval in creds.items():
                if isinstance(cval, dict) and cval.get("id"):
                    self._cred_ids.add(name)
                nm = (cval or {}).get("name", "") if isinstance(cval, dict) else ""
                if re.fullmatch(r"(Header Auth|Basic Auth|OAuth2) account\s*\d*", str(nm).strip()):
                    self.add("WARN", "credential-default-name", name,
                             f"Credential '{nm}' still has n8n's auto-generated name. These get "
                             "auto-attached to the wrong node — rename for its contents.")
            params = n.get("parameters", {})
            nct = params.get("nodeCredentialType")
            if nct and nct not in creds:
                self.add("ERROR", "credential-key-mismatch", name,
                         f"nodeCredentialType is '{nct}' but credentials has "
                         f"{list(creds) or 'nothing'} — the key must match exactly.")
        if self._cred_ids:
            self.add("INFO", "credential-id", None,
                     f"{len(self._cred_ids)} node(s) carry a credential 'id' from another "
                     "instance — harmless (n8n re-prompts), but omit 'id' in generated files.")

    def check_retry_on_creates(self):
        for n in self.nodes:
            if not n.get("retryOnFail"):
                continue
            name = n.get("name")
            if self.ntype(n) != "n8n-nodes-base.httprequest":
                continue
            method = str(n.get("parameters", {}).get("method", "GET")).upper()
            if method == "POST":
                url = str(n.get("parameters", {}).get("url", "")).lower()
                idempotent_hint = any(k in url for k in (
                    "/search", "/query", "/batch/read", "generatecontent",
                    "/field/", "/token", "/login", "/completions"))
                if idempotent_hint:
                    self.add("INFO", "retry-on-post", name,
                             "retryOnFail on a POST that reads or sets a value rather than "
                             "creating one. Likely fine — confirm it's idempotent.")
                else:
                    self.add("WARN", "retry-on-create", name,
                             "retryOnFail on a POST. If this creates a record, a retry after a "
                             "lost response creates it twice — remove retryOnFail. Only keep it "
                             "if the endpoint is genuinely idempotent.")

    def check_triggers_and_settings(self):
        settings = self.wf.get("settings", {}) or {}
        is_error_handler = any(self.ntype(n) == "n8n-nodes-base.errortrigger"
                               for n in self.nodes)
        if not settings.get("errorWorkflow") and not is_error_handler:
            self.add("WARN", "no-error-workflow", None,
                     "settings.errorWorkflow is not set. n8n surfaces nothing when a "
                     "production run fails. (Expected if the consultant sets it after import — "
                     "make sure it's in the delivery notes.)")
        if self.wf.get("active") is True:
            self.add("WARN", "active-true", None,
                     "'active': true — ship false and let the consultant publish.")

        for n in self.nodes:
            t, name = self.ntype(n), n.get("name")
            params = n.get("parameters", {}) or {}
            if t == "n8n-nodes-base.executeworkflowtrigger":
                if params.get("inputSource") != "passthrough":
                    self.add("ERROR", "trigger-zero-field-schema", name,
                             "Execute Workflow Trigger without inputSource: 'passthrough'. On "
                             "import this becomes a zero-field schema that silently drops every "
                             "dispatched record.")
            if t == "n8n-nodes-base.executeworkflow":
                if params.get("mode") == "each":
                    self.add("ERROR", "execute-workflow-each-mode", name,
                             "mode: 'each' is deprecated (removed in 3.0) and hangs the parent "
                             "in 'Waiting' on multi-item runs from 2.16+. Use Loop Over Items "
                             "(batch 1, reset:false) + run-once-with-all-items.")
                if n.get("onError") != "continueRegularOutput":
                    self.add("INFO", "dispatch-continue-on-fail", name,
                             "No onError: 'continueRegularOutput' — one bad record halts the batch.")
            if t == "n8n-nodes-base.webhook":
                auth = params.get("authentication", "none")
                if auth not in ("headerAuth", "basicAuth"):
                    self.add("ERROR", "webhook-no-auth", name,
                             f"Webhook authentication is '{auth}'. Anyone who guesses the path "
                             "can fire this workflow.")
            if t == "n8n-nodes-base.splitinbatches":
                if (params.get("options") or {}).get("reset") is not False:
                    self.add("WARN", "loop-reset", name,
                             "Loop Over Items without options.reset = false — a return wire "
                             "restarts the loop forever.")

    def check_secrets(self):
        patterns = [
            (r"\bpat[0-9A-Z]{10,}\b", "ClickUp personal token"),
            (r"\bpat-(na|eu)\d-[0-9a-f-]{20,}\b", "HubSpot private-app token"),
            (r"\bsk-[A-Za-z0-9]{20,}\b", "OpenAI-style key"),
            (r"\bAIza[0-9A-Za-z_\-]{20,}\b", "Google API key"),
            (r"\bxox[baprs]-[0-9A-Za-z-]{10,}\b", "Slack token"),
            (r"\bghp_[0-9A-Za-z]{20,}\b", "GitHub token"),
            (r"(?i)\b(api[_-]?key|token|password|secret)\s*[:=]\s*['\"][^'\"\s]{16,}['\"]", "credential-shaped literal"),
        ]
        blob = json.dumps(self.wf)
        for pat, label in patterns:
            for m in set(re.findall(pat, blob)):
                sample = m if isinstance(m, str) else str(m)
                self.add("ERROR", "secret-in-json", None,
                         f"Possible {label} in the file: {sample[:12]}… — never ship a secret "
                         "in workflow JSON; reference a credential instead, and rotate it.")

    def check_stickies(self):
        has_sticky = any(self.ntype(n) == "n8n-nodes-base.stickynote" for n in self.nodes)
        if not has_sticky:
            self.add("INFO", "no-sticky-note", None,
                     "No sticky note on the canvas — the manual-completion checklist should "
                     "live on the canvas as well as in chat.")
        if self.fanout_nodes() and not has_sticky:
            self.add("WARN", "fanout-unmarked", None,
                     "This workflow fans out but has no sticky note. A fan-out is invisible "
                     "on the canvas.")

    # ---------- run ----------

    def run(self):
        if not self.load():
            return self.findings
        self.build_graph()
        self.check_names()
        self.check_orphans()
        self.check_code_nodes()
        self.check_expressions()
        self.check_node_references()
        self.check_fanout_modes()
        self.check_if_after_http()
        self.check_if_conditions()
        self.check_credentials()
        self.check_retry_on_creates()
        self.check_triggers_and_settings()
        self.check_secrets()
        self.check_stickies()
        return self.findings


COLORS = {"ERROR": "\033[31m", "WARN": "\033[33m", "INFO": "\033[36m"}
RESET = "\033[0m"


def report(path, findings, use_color):
    name = os.path.basename(path)
    counts = defaultdict(int)
    for f in findings:
        counts[f.severity] += 1
    print(f"\n=== {name} ===")
    if not findings:
        print("  clean — no mechanical issues found")
    for f in sorted(findings, key=lambda x: (SEVERITY_ORDER[x.severity], x.check)):
        tag = f"{COLORS[f.severity]}{f.severity:<5}{RESET}" if use_color else f"{f.severity:<5}"
        where = f" [{f.node}]" if f.node else ""
        print(f"  {tag} {f.check}{where}\n        {f.message}")
    print(f"  -- {counts['ERROR']} error(s), {counts['WARN']} warning(s), "
          f"{counts['INFO']} note(s)")
    return counts


def main():
    ap = argparse.ArgumentParser(description="Mechanical QA for n8n workflow exports.")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--strict", action="store_true", help="warnings also exit 1")
    ap.add_argument("--no-color", action="store_true")
    args = ap.parse_args()

    results, total = {}, defaultdict(int)
    for path in args.files:
        if not os.path.exists(path):
            print(f"No such file: {path}", file=sys.stderr)
            sys.exit(2)
        findings = WorkflowValidator(path).run()
        results[path] = findings
        for f in findings:
            total[f.severity] += 1

    if args.json:
        print(json.dumps(
            {p: [f.as_dict() for f in fs] for p, fs in results.items()}, indent=2))
    else:
        use_color = not args.no_color and sys.stdout.isatty()
        for path, findings in results.items():
            report(path, findings, use_color)
        print(f"\nTOTAL: {total['ERROR']} error(s), {total['WARN']} warning(s), "
              f"{total['INFO']} note(s) across {len(results)} file(s)")

    if total["ERROR"] or (args.strict and total["WARN"]):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
