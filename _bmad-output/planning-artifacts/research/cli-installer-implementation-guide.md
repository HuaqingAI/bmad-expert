# CLI Installer Implementation Guide for bmad-expert
**Date:** 2026-03-23
**Purpose:** Practical implementation guide for building `npx bmad-expert install`

---

## Quick Reference: Key Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Distribution** | Git clone from GitHub | Template needs customization, not a library |
| **CLI Pattern** | `npx bmad-expert install` | Zero-friction, no global install needed |
| **Platform CLI calls** | `child_process.spawn()` with `execa` | Clean async API, cross-platform, good error handling |
| **Output modes** | Dual (human + `--json`) | Support both manual and AI agent usage |
| **Exit codes** | Semantic (0-8, 130) | Enable programmatic error handling |
| **Registration** | Call `happycapy-cli add` with fallback | Graceful degradation to manual instructions |

---

## Implementation Roadmap

### Phase 1: Basic CLI Structure
```bash
# File structure
bmad-expert-installer/
├── package.json
├── cli.js              # Entry point
├── lib/
│   └── install.js      # Core logic
└── README.md
```

**package.json:**
```json
{
  "name": "bmad-expert-installer",
  "version": "1.0.0",
  "bin": {
    "bmad-expert": "./cli.js"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "execa": "^8.0.0",
    "chalk": "^5.0.0",
    "fs-extra": "^11.0.0"
  }
}
```

**cli.js (minimal viable):**
```javascript
#!/usr/bin/env node

const { program } = require('commander');
const { installAgent } = require('./lib/install');

program
  .name('bmad-expert')
  .description('BMAD Expert agent installer')
  .version('1.0.0');

program
  .command('install')
  .option('--json', 'Machine-readable output')
  .option('-y, --yes', 'Skip prompts')
  .action(async (options) => {
    try {
      const result = await installAgent(options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('✓ Installation complete!');
      }
      process.exit(0);
    } catch (error) {
      console.error('✗', error.message);
      process.exit(1);
    }
  });

program.parse();
```

### Phase 2: Git Clone + Customization

**lib/install.js:**
```javascript
const execa = require('execa');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function installAgent(options = {}) {
  const agentId = options.agentId || 'bmad-expert';
  const repoUrl = 'https://github.com/your-org/bmad-expert-template.git';

  // Determine install path
  const installPath = path.join(
    os.homedir(),
    '.happycapy',
    'agents',
    agentId
  );

  // Check if already exists
  if (await fs.pathExists(installPath) && !options.force) {
    throw new Error(`Agent ${agentId} already exists at ${installPath}`);
  }

  // Clone repository
  await execa('git', [
    'clone',
    '--depth', '1',
    '--branch', 'main',
    repoUrl,
    installPath
  ]);

  // Remove .git directory
  await fs.remove(path.join(installPath, '.git'));

  // Customize template
  await customizeTemplate(installPath, {
    agentId,
    displayName: options.displayName || 'BMAD Expert',
    model: options.model || 'claude-sonnet-4.5'
  });

  return {
    success: true,
    agentId,
    installPath
  };
}

async function customizeTemplate(installPath, config) {
  const filesToUpdate = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'README.md'];

  for (const file of filesToUpdate) {
    const filePath = path.join(installPath, file);
    if (await fs.pathExists(filePath)) {
      let content = await fs.readFile(filePath, 'utf8');

      // Replace template variables
      content = content
        .replace(/\{\{agentId\}\}/g, config.agentId)
        .replace(/\{\{displayName\}\}/g, config.displayName)
        .replace(/\{\{model\}\}/g, config.model);

      await fs.writeFile(filePath, content);
    }
  }
}

module.exports = { installAgent };
```

### Phase 3: Platform CLI Integration

**lib/platform.js:**
```javascript
const execa = require('execa');

async function checkCLIExists(command) {
  try {
    await execa(command, ['--version']);
    return true;
  } catch (error) {
    return false;
  }
}

async function registerWithHappyCapy(agentId, displayName, model) {
  const hasHappyCapy = await checkCLIExists('happycapy-cli');

  if (!hasHappyCapy) {
    return {
      registered: false,
      reason: 'happycapy-cli not found',
      manualCommand: `happycapy-cli add "${agentId}" "${displayName}" "${model}"`
    };
  }

  try {
    await execa('happycapy-cli', ['add', agentId, displayName, model]);
    return { registered: true };
  } catch (error) {
    return {
      registered: false,
      reason: error.message,
      manualCommand: `happycapy-cli add "${agentId}" "${displayName}" "${model}"`
    };
  }
}

module.exports = { registerWithHappyCapy, checkCLIExists };
```

**Update lib/install.js:**
```javascript
const { registerWithHappyCapy } = require('./platform');

async function installAgent(options = {}) {
  // ... existing clone + customize code ...

  // Register with platform
  const registration = await registerWithHappyCapy(
    agentId,
    options.displayName || 'BMAD Expert',
    options.model || 'claude-sonnet-4.5'
  );

  return {
    success: true,
    agentId,
    installPath,
    registration
  };
}
```

### Phase 4: JSON Output + Exit Codes

**lib/exit-codes.js:**
```javascript
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  DEPENDENCY_ERROR: 3,
  NETWORK_ERROR: 4,
  FILE_ERROR: 5,
  ALREADY_EXISTS: 6,
  NOT_FOUND: 7,
  VALIDATION_ERROR: 8
};

class CLIError extends Error {
  constructor(message, exitCode = EXIT_CODES.GENERAL_ERROR, details = {}) {
    super(message);
    this.exitCode = exitCode;
    this.details = details;
  }
}

module.exports = { EXIT_CODES, CLIError };
```

**lib/output.js:**
```javascript
class OutputFormatter {
  constructor(jsonMode = false) {
    this.jsonMode = jsonMode;
  }

  success(data) {
    if (this.jsonMode) {
      console.log(JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      console.log('✓ Installation complete!');
      console.log(`  Agent ID: ${data.agentId}`);
      console.log(`  Location: ${data.installPath}`);

      if (!data.registration?.registered) {
        console.log('\n⚠ Manual registration required:');
        console.log(`  ${data.registration.manualCommand}`);
      }
    }
  }

  error(error) {
    if (this.jsonMode) {
      console.error(JSON.stringify({
        success: false,
        error: {
          message: error.message,
          code: error.exitCode || 1,
          details: error.details || {}
        },
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      console.error('✗', error.message);
    }
  }
}

module.exports = { OutputFormatter };
```

**Update cli.js:**
```javascript
const { OutputFormatter } = require('./lib/output');
const { EXIT_CODES, CLIError } = require('./lib/exit-codes');

program
  .command('install')
  .option('--json', 'Machine-readable output')
  .option('-y, --yes', 'Skip prompts')
  .option('--force', 'Overwrite existing installation')
  .action(async (options) => {
    const output = new OutputFormatter(options.json);

    try {
      const result = await installAgent(options);
      output.success(result);
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      output.error(error);
      process.exit(error.exitCode || EXIT_CODES.GENERAL_ERROR);
    }
  });
```

---

## Testing Strategy

### Unit Tests
```javascript
// tests/install.test.js
const { installAgent } = require('../lib/install');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

describe('installAgent', () => {
  const testDir = path.join(os.tmpdir(), 'bmad-test');

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('installs agent to default location', async () => {
    const result = await installAgent({
      agentId: 'test-agent',
      destination: testDir
    });

    expect(result.success).toBe(true);
    expect(await fs.pathExists(result.installPath)).toBe(true);
  });

  test('throws error if agent already exists', async () => {
    await installAgent({ agentId: 'test', destination: testDir });

    await expect(
      installAgent({ agentId: 'test', destination: testDir })
    ).rejects.toThrow('already exists');
  });

  test('overwrites with --force flag', async () => {
    await installAgent({ agentId: 'test', destination: testDir });

    const result = await installAgent({
      agentId: 'test',
      destination: testDir,
      force: true
    });

    expect(result.success).toBe(true);
  });
});
```

### Integration Tests
```javascript
// tests/cli.integration.test.js
const { spawnSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'cli.js');

describe('CLI integration', () => {
  test('--json flag produces valid JSON', () => {
    const result = spawnSync('node', [CLI, 'install', '--json', '--dry-run'], {
      encoding: 'utf8'
    });

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('success');
    expect(output).toHaveProperty('timestamp');
  });

  test('exits with 0 on success', () => {
    const result = spawnSync('node', [CLI, 'install', '--dry-run']);
    expect(result.status).toBe(0);
  });

  test('exits with 6 if agent exists', () => {
    // First install
    spawnSync('node', [CLI, 'install', '--agent-id', 'test']);

    // Second install (should fail)
    const result = spawnSync('node', [CLI, 'install', '--agent-id', 'test']);
    expect(result.status).toBe(6);
  });
});
```

---

## Usage Examples

### For Humans (Interactive)
```bash
# Simple install
npx bmad-expert install

# Custom configuration
npx bmad-expert install \
  --agent-id my-expert \
  --display-name "My Custom Expert" \
  --model claude-opus-4.6

# Force reinstall
npx bmad-expert install --force
```

### For AI Agents (Programmatic)
```bash
# Non-interactive install with JSON output
npx bmad-expert install \
  --agent-id bmad-expert \
  --display-name "BMAD Expert" \
  --model claude-sonnet-4.5 \
  --yes \
  --json

# Check system requirements
npx bmad-expert check --json

# Dry-run validation
npx bmad-expert install --dry-run --json
```

### From Node.js Scripts
```javascript
const { spawnSync } = require('child_process');

function installBmadExpert() {
  const result = spawnSync('npx', [
    'bmad-expert',
    'install',
    '--agent-id', 'bmad-expert',
    '--yes',
    '--json'
  ], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    const error = JSON.parse(result.stderr);
    throw new Error(`Installation failed: ${error.error.message}`);
  }

  const output = JSON.parse(result.stdout);
  console.log('Installed to:', output.data.installPath);

  return output.data;
}
```

---

## Deployment Checklist

- [ ] Create GitHub repository for agent template
- [ ] Add setup.js to template repo
- [ ] Create npm package for installer CLI
- [ ] Add package.json with bin entry
- [ ] Implement core install.js logic
- [ ] Add platform detection (happycapy-cli check)
- [ ] Implement dual output modes (human/JSON)
- [ ] Add semantic exit codes
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Add CLI documentation (README)
- [ ] Add exit code documentation
- [ ] Test on Linux/macOS/Windows
- [ ] Publish to npm
- [ ] Document usage in bmad-expert README

---

## Common Issues & Solutions

### Issue: Git not found
```javascript
// In lib/install.js
const { checkCLIExists } = require('./platform');

async function installAgent(options) {
  if (!await checkCLIExists('git')) {
    throw new CLIError(
      'git is required but not found',
      EXIT_CODES.DEPENDENCY_ERROR,
      { required: ['git'] }
    );
  }
  // ... continue
}
```

### Issue: Network timeout during clone
```javascript
// Add timeout to git clone
await execa('git', [
  'clone',
  '--depth', '1',
  '--branch', 'main',
  repoUrl,
  installPath
], {
  timeout: 30000, // 30 seconds
  killSignal: 'SIGTERM'
});
```

### Issue: Permission denied
```javascript
// Check write permissions before install
const installDir = path.dirname(installPath);
try {
  await fs.access(installDir, fs.constants.W_OK);
} catch (error) {
  throw new CLIError(
    `No write permission to ${installDir}`,
    EXIT_CODES.FILE_ERROR,
    { path: installDir }
  );
}
```

---

## Next Steps

1. **Create template repository** - Set up GitHub repo with SOUL.md, AGENTS.md, etc.
2. **Build installer package** - Implement the CLI following Phase 1-4
3. **Test locally** - Use `npm link` to test before publishing
4. **Publish to npm** - `npm publish bmad-expert-installer`
5. **Document** - Add usage guide to bmad-expert README

**Estimated effort:** 2-3 days for MVP, 1 week for production-ready with tests.
