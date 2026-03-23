# CLI Integration Patterns - Quick Reference Card
**For:** Building `npx bmad-expert install` CLI installer
**Updated:** 2026-03-23

---

## 1. Calling External CLIs (happycapy-cli)

### Quick Answer
Use `execa` package for best cross-platform support:

```javascript
const execa = require('execa');

async function registerAgent(agentId, name, model) {
  try {
    await execa('happycapy-cli', ['add', agentId, name, model], {
      stdio: 'inherit'  // Show real-time output
    });
    return { success: true };
  } catch (error) {
    if (error.exitCode === 127) {
      throw new Error('happycapy-cli not found');
    }
    throw error;
  }
}
```

### Check if CLI exists first
```javascript
async function checkCLI(command) {
  try {
    await execa(command, ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
```

---

## 2. npm Package Structure

### Quick Answer
Use `bin` entry, avoid `postinstall` hooks:

```json
{
  "name": "bmad-expert-installer",
  "version": "1.0.0",
  "bin": {
    "bmad-expert": "./cli.js"
  },
  "preferGlobal": false
}
```

### CLI Entry Point Template
```javascript
#!/usr/bin/env node

const { program } = require('commander');

program
  .name('bmad-expert')
  .version('1.0.0')
  .command('install')
  .option('--json', 'JSON output')
  .option('-y, --yes', 'No prompts')
  .action(async (options) => {
    // ... install logic
  });

program.parse();
```

### When to use npx vs global install
- **npx** (recommended): One-time usage, zero friction
- **Global**: Frequent use across projects

---

## 3. Cross-Platform Installation

### Quick Answer
Detect platform, copy files to appropriate locations:

```javascript
const os = require('os');
const path = require('path');

function getInstallPath(platform = process.platform) {
  const home = os.homedir();

  switch (platform) {
    case 'happycapy':
      return path.join(home, '.happycapy', 'agents', agentId);
    case 'win32':
      return path.join(home, 'AppData', 'Roaming', '.happycapy', 'agents', agentId);
    default:
      return path.join(home, '.happycapy', 'agents', agentId);
  }
}
```

### Auto-detect available platforms
```javascript
async function detectPlatforms() {
  const platforms = [];

  // Check HappyCapy
  if (await checkCLI('happycapy-cli')) {
    platforms.push({ name: 'HappyCapy', value: 'happycapy' });
  }

  // Check Cursor
  if (fs.existsSync('.cursor')) {
    platforms.push({ name: 'Cursor', value: 'cursor' });
  }

  return platforms;
}
```

---

## 4. Git Clone Distribution

### Quick Answer
Use `git clone --depth 1` for fast template distribution:

```javascript
const execa = require('execa');
const fs = require('fs-extra');

async function cloneTemplate(repoUrl, destination) {
  // Clone without history
  await execa('git', [
    'clone',
    '--depth', '1',
    '--branch', 'main',
    repoUrl,
    destination
  ]);

  // Remove .git directory (no longer tracked)
  await fs.remove(path.join(destination, '.git'));

  // Customize template
  await customizeFiles(destination);

  return destination;
}

async function customizeFiles(dir) {
  const files = ['SOUL.md', 'AGENTS.md'];

  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = await fs.readFile(filePath, 'utf8');

    content = content
      .replace(/\{\{agentId\}\}/g, 'bmad-expert')
      .replace(/\{\{model\}\}/g, 'claude-sonnet-4.5');

    await fs.writeFile(filePath, content);
  }
}
```

### Why git clone vs npm package?
- **Git clone**: Templates needing customization (RECOMMENDED for agents)
- **npm package**: Reusable libraries and tools

---

## 5. Machine-Readable Output

### Quick Answer
Support `--json` flag with semantic exit codes:

```javascript
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  DEPENDENCY_MISSING: 3,
  NETWORK_ERROR: 4,
  FILE_ERROR: 5,
  ALREADY_EXISTS: 6
};

class OutputFormatter {
  constructor(jsonMode) {
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
      console.log('✓ Success!');
    }
  }

  error(error) {
    if (this.jsonMode) {
      console.error(JSON.stringify({
        success: false,
        error: {
          message: error.message,
          code: error.exitCode || 1
        }
      }, null, 2));
    } else {
      console.error('✗', error.message);
    }
  }
}

// Usage
program
  .command('install')
  .option('--json')
  .action(async (options) => {
    const output = new OutputFormatter(options.json);
    try {
      const result = await install();
      output.success(result);
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      output.error(error);
      process.exit(error.exitCode || EXIT_CODES.ERROR);
    }
  });
```

### Test exit codes
```javascript
const { spawnSync } = require('child_process');

const result = spawnSync('bmad-expert', ['install', '--json']);
console.log('Exit code:', result.status);

if (result.status === 0) {
  const output = JSON.parse(result.stdout);
  console.log('Success:', output);
}
```

---

## Complete Minimal Example

```javascript
#!/usr/bin/env node
// cli.js

const { program } = require('commander');
const execa = require('execa');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const EXIT_CODES = { SUCCESS: 0, ERROR: 1, ALREADY_EXISTS: 6 };

async function install(options) {
  const agentId = 'bmad-expert';
  const installPath = path.join(os.homedir(), '.happycapy', 'agents', agentId);

  // Check if exists
  if (await fs.pathExists(installPath) && !options.force) {
    const error = new Error('Agent already exists');
    error.exitCode = EXIT_CODES.ALREADY_EXISTS;
    throw error;
  }

  // Clone template
  await execa('git', [
    'clone',
    '--depth', '1',
    'https://github.com/your-org/bmad-expert-template.git',
    installPath
  ]);

  // Cleanup
  await fs.remove(path.join(installPath, '.git'));

  // Register with platform
  if (await checkCLI('happycapy-cli')) {
    await execa('happycapy-cli', ['add', agentId, 'BMAD Expert', 'claude-sonnet-4.5']);
  }

  return { agentId, installPath };
}

async function checkCLI(cmd) {
  try {
    await execa(cmd, ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

program
  .name('bmad-expert')
  .version('1.0.0')
  .command('install')
  .option('--json', 'JSON output')
  .option('--force', 'Overwrite existing')
  .action(async (options) => {
    try {
      const result = await install(options);

      if (options.json) {
        console.log(JSON.stringify({ success: true, data: result }, null, 2));
      } else {
        console.log('✓ Installed to:', result.installPath);
      }

      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({
          success: false,
          error: { message: error.message, code: error.exitCode || 1 }
        }, null, 2));
      } else {
        console.error('✗', error.message);
      }

      process.exit(error.exitCode || EXIT_CODES.ERROR);
    }
  });

program.parse();
```

**Usage:**
```bash
# Install (human)
npx bmad-expert install

# Install (AI agent)
npx bmad-expert install --json --yes

# Force reinstall
npx bmad-expert install --force
```

---

## Dependencies to Install

```bash
npm install commander execa chalk fs-extra
```

---

## Key Takeaways

1. **Use execa for subprocess calls** - Better than child_process native APIs
2. **Always check CLI exists before calling** - Graceful error handling
3. **Support --json flag** - Enable AI agent programmatic usage
4. **Use semantic exit codes** - 0=success, 1-8=specific errors
5. **Git clone for templates** - npm packages for libraries
6. **Avoid postinstall hooks** - Use explicit commands instead
7. **Cross-platform paths** - Use os.homedir() and path.join()
8. **Non-interactive mode** - --yes flag for automation

---

## Full Documentation

See companion files:
- `cli-installer-integration-patterns-research.md` - Deep dive on all patterns
- `cli-installer-implementation-guide.md` - Step-by-step implementation
- `technical-agent-install-and-bmad-extension-research-2026-03-23.md` - Platform survey
