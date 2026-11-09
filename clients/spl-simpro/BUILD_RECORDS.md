# SPL Build Records

Resolved, instance-specific values for SPL builds. **Only SPL values belong here.** Never copy values from another client's records or from `shared/knowledge/05_Build_Records.md` (Anicca-internal). Leave a field empty until it is confirmed from SPL's own systems.

Template (copy per automation):

```markdown
## <n>. <Automation name>
*<Source system> → <Destination system>. <N> workflows: <names>. Client: SPL. Instance: <version>. Status: built / tested / live.*

**Workflow IDs**
| Workflow | ID |
|---|---|

**<System A>** — resolved values
**<System B>** — resolved values
**Enum / option maps**
**Trigger definition**
**Known findings and open items**
```

---

## 1. HubSpot ↔ Simpro sync
*HubSpot ↔ Simpro. 15 workflows (see `workflows/`). Client: SPL. Instance: UNKNOWN. Status: live (existing exports).*

**Workflow IDs**
| Workflow | ID |
|---|---|
| (not recorded) | |

**HubSpot** — resolved values
**Simpro** — resolved values
**Enum / option maps**
**Trigger definition**
**Known findings and open items**
- Validator (2026-11-09) on the existing exports: 12 ERRORs. 10 sub-workflow Execute Workflow Triggers lack `inputSource: "passthrough"`; the two real-time router webhooks have no authentication. No workflow sets `settings.errorWorkflow`. Not yet fixed; needs a decision.
