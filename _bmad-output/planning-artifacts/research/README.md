# CLI Installer Research - Documentation Index
**Date:** 2026-03-23
**Purpose:** Research findings for building `npx bmad-expert install`

---

## Document Overview

### 1. **technical-agent-install-and-bmad-extension-research-2026-03-23.md**
**What:** Platform survey of AI coding tools (HappyCapy, Cursor, Continue, Claude Code, GitHub Copilot)
**Key findings:**
- All platforms use Markdown for configuration
- Most use auto-discovery (convention over configuration)
- HappyCapy is unique in requiring CLI registration
- BMAD module architecture and extension patterns

**When to read:** First - get context on the ecosystem

---

### 2. **cli-installer-integration-patterns-research.md** (44KB)
**What:** Comprehensive research on 5 CLI integration patterns with code examples
**Covers:**
1. CLI tool integration with platform APIs (calling happycapy-cli from Node.js)
2. npm package CLI + install hooks best practices
3. Cross-platform agent registration patterns (Yeoman, create-react-app, degit)
4. Git clone as distribution mechanism
5. Exit codes and machine-readable CLI output

**When to read:** Second - deep dive on each pattern

**Key code examples:**
- `child_process.spawn()` vs `execa` for calling external CLIs
- package.json structure for bin + postinstall
- Yeoman generator pattern for cross-platform installation
- Git clone + template customization
- JSON output + semantic exit codes

---

### 3. **cli-installer-implementation-guide.md** (13KB)
**What:** Phase-by-phase implementation roadmap for `npx bmad-expert install`
**Covers:**
- Phase 1: Basic CLI structure
- Phase 2: Git clone + customization
- Phase 3: Platform CLI integration
- Phase 4: JSON output + exit codes
- Testing strategy
- Common issues & solutions

**When to read:** Third - when ready to implement

**Includes:**
- Ready-to-use code snippets
- File structure recommendations
- Unit and integration test examples
- Deployment checklist

---

### 4. **cli-patterns-quick-reference.md** (7KB)
**What:** Quick reference card with copy-paste code snippets
**Covers:**
- Minimal working examples for each pattern
- Key decision summaries
- Complete minimal CLI example (single file)
- Dependencies list

**When to read:** During implementation - quick lookup

---

## Key Decisions Summary

| Decision | Recommendation | Source Document |
|----------|---------------|-----------------|
| **Distribution method** | Git clone from GitHub | #2, #3 |
| **CLI pattern** | `npx bmad-expert install` | #2, #3 |
| **Subprocess library** | `execa` package | #2, #4 |
| **Output modes** | Dual (human + --json) | #2, #3, #4 |
| **Exit codes** | Semantic (0-8) | #2, #3, #4 |
| **Platform registration** | Call happycapy-cli with fallback | #1, #2, #3 |
| **Template customization** | Replace variables in Markdown files | #2, #3, #4 |
| **Install location** | `~/.happycapy/agents/{agentId}` | #1, #3 |

---

## Quick Start (5-minute overview)

1. Read quick reference (#4) for code snippets
2. Skim implementation guide (#3) for architecture
3. Reference patterns research (#2) for specific questions
4. Review platform survey (#1) for context

---

## Code Examples Hierarchy

```
Quick Reference (#4)
├── Minimal working example (single file)
└── Copy-paste snippets

Implementation Guide (#3)
├── Phase 1: Basic CLI
├── Phase 2: Git clone
├── Phase 3: Platform integration
└── Phase 4: JSON output

Patterns Research (#2)
├── Pattern 1: Calling external CLIs
│   ├── spawn() approach
│   ├── execSync() approach
│   └── execa approach (recommended)
├── Pattern 2: npm package structure
│   ├── bin entry
│   ├── postinstall hooks
│   └── npx vs global install
├── Pattern 3: Cross-platform installation
│   ├── Yeoman generator pattern
│   ├── create-react-app pattern
│   └── Platform detection
├── Pattern 4: Git clone distribution
│   ├── Simple clone + customize
│   ├── Setup script pattern
│   └── Sparse checkout
└── Pattern 5: Machine-readable output
    ├── Exit code standards
    ├── Dual output mode
    ├── JSON schema
    └── AI agent-friendly design

Platform Survey (#1)
├── Cursor
├── Continue.dev
├── Claude Code
├── GitHub Copilot
├── HappyCapy
└── BMAD architecture
```

---

## Implementation Checklist

- [ ] Read all 4 documents in order
- [ ] Set up npm package structure (#3, Phase 1)
- [ ] Implement git clone logic (#2, Pattern 4; #3, Phase 2)
- [ ] Add platform CLI integration (#2, Pattern 1; #3, Phase 3)
- [ ] Add JSON output mode (#2, Pattern 5; #3, Phase 4)
- [ ] Write unit tests (#3, Testing section)
- [ ] Write integration tests (#3, Testing section)
- [ ] Test on multiple platforms (#1 for reference)
- [ ] Create GitHub template repository
- [ ] Publish npm package
- [ ] Update bmad-expert README

**Estimated time:** 2-3 days for MVP, 1 week production-ready

---

## Dependencies Required

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "execa": "^8.0.0",
    "chalk": "^5.0.0",
    "fs-extra": "^11.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

---

## Related Resources

**External:**
- Node.js child_process: https://nodejs.org/api/child_process.html
- execa: https://github.com/sindresorhus/execa
- Commander.js: https://github.com/tj/commander.js
- CLI Guidelines: https://clig.dev/
- Yeoman: https://yeoman.io/authoring/

**Internal:**
- bmad-expert AGENTS.md
- story-dev-workflow.md
- BMAD module documentation

---

## Questions & Next Steps

**Questions answered:**
✅ How to call happycapy-cli from Node.js?
✅ npx vs npm install -g?
✅ How to handle cross-platform installation?
✅ How to distribute agent templates?
✅ How to support AI agent programmatic usage?

**Next steps:**
1. Create GitHub repository for bmad-expert-template
2. Build CLI installer package
3. Test installation flow
4. Publish to npm
5. Document in main README

---

## Contact & Contribution

This research was conducted on 2026-03-23 for the bmad-expert agent installer project.

For questions or updates, refer to the individual research documents or the main project documentation.
