# CLI Installer Integration Patterns Research
**Research Date:** 2026-03-23
**Context:** Building `npx bmad-expert install` CLI installer for AI agent template
**Goal:** Determine best practices for CLI tools that call platform CLIs, handle installation, and support programmatic usage

---

## 1. CLI Tool Integration with Platform APIs

### Pattern: Spawning External CLIs from Node.js

When building a CLI like `npx bmad-expert install` that needs to call platform CLIs like `happycapy-cli`, use Node.js child process APIs with proper error handling and shell detection.

#### Core Approaches

**A. `child_process.spawn()` - Streaming output (recommended for interactive CLIs)**

```javascript
const { spawn } = require('child_process');

function callPlatformCLI(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit', // 'inherit' shows real-time output
      shell: process.platform === 'win32', // Windows needs shell
      env: { ...process.env, ...options.env }
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      child.stdout?.on('data', (data) => stdout += data);
      child.stderr?.on('data', (data) => stderr += data);
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        const error = new Error(`${command} exited with code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    child.on('error', (err) => {
      // Command not found or execution failed
      reject(err);
    });
  });
}

// Usage example
async function installAgent(agentId, name, model) {
  try {
    // Check if happycapy-cli exists
    await callPlatformCLI('happycapy-cli', ['--version'], { silent: true });

    // Call the add command
    const result = await callPlatformCLI('happycapy-cli', [
      'add',
      agentId,
      name,
      model
    ]);

    console.log('✓ Agent registered successfully');
    return result;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Error: happycapy-cli not found. Please install HappyCapy first.');
      process.exit(1);
    }
    throw error;
  }
}
```

**B. `child_process.execSync()` - Simple synchronous calls**

```javascript
const { execSync } = require('child_process');

function callPlatformCLISync(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      env: { ...process.env, ...options.env }
    });
    return output;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.stderr || error.message);
    process.exit(error.status || 1);
  }
}

// Usage
callPlatformCLISync('happycapy-cli add "bmad-expert" "BMAD Expert" "claude-sonnet-4.5"');
```

**C. `execa` package (modern alternative, recommended for production)**

```javascript
const execa = require('execa');

async function callPlatformCLI(command, args, options = {}) {
  try {
    const result = await execa(command, args, {
      stdout: options.silent ? 'pipe' : 'inherit',
      stderr: options.silent ? 'pipe' : 'inherit',
      preferLocal: true, // Use local node_modules/.bin first
      env: options.env
    });
    return result;
  } catch (error) {
    if (error.exitCode === 127 || error.code === 'ENOENT') {
      throw new Error(`Command not found: ${command}. Please install it first.`);
    }
    throw error;
  }
}
```

#### Best Practices

1. **Check CLI existence before calling**
   ```javascript
   const commandExists = require('command-exists');

   async function ensureCLIExists(cliName) {
     try {
       await commandExists(cliName);
     } catch (error) {
       console.error(`❌ ${cliName} not found`);
       console.log(`\nPlease install ${cliName} first:`);
       console.log(`  npm install -g ${cliName}`);
       process.exit(1);
     }
   }
   ```

2. **Platform-specific path handling**
   ```javascript
   const os = require('os');
   const path = require('path');

   function getAgentInstallPath(platform = process.platform) {
     const homedir = os.homedir();
     switch (platform) {
       case 'win32':
         return path.join(homedir, 'AppData', 'Roaming', '.happycapy', 'agents');
       case 'darwin':
       case 'linux':
         return path.join(homedir, '.happycapy', 'agents');
       default:
         return path.join(homedir, '.happycapy', 'agents');
     }
   }
   ```

3. **Graceful degradation**
   ```javascript
   async function registerAgent(agentId, fallbackToManual = true) {
     try {
       await callPlatformCLI('happycapy-cli', ['add', agentId, 'BMAD Expert', 'claude-sonnet-4.5']);
       console.log('✓ Agent registered via CLI');
     } catch (error) {
       if (fallbackToManual) {
         console.warn('⚠ CLI registration failed, showing manual instructions:');
         console.log(`\n  happycapy-cli add "${agentId}" "BMAD Expert" "claude-sonnet-4.5"\n`);
       } else {
         throw error;
       }
     }
   }
   ```

**Sources:**
- Node.js documentation: https://nodejs.org/api/child_process.html
- execa: https://github.com/sindresorhus/execa
- command-exists: https://github.com/mathisonian/command-exists

---

## 2. npm Package CLI + Install Hooks

### Pattern: Combining bin scripts with postinstall hooks

When creating an npm package like `bmad-expert-installer`, you can provide both a CLI interface (`npx bmad-expert install`) AND automated setup hooks.

#### package.json Structure

```json
{
  "name": "bmad-expert-installer",
  "version": "1.0.0",
  "description": "CLI installer for BMAD Expert agent template",
  "bin": {
    "bmad-expert": "./cli.js"
  },
  "scripts": {
    "postinstall": "node ./postinstall.js"
  },
  "files": [
    "cli.js",
    "postinstall.js",
    "lib/",
    "templates/"
  ],
  "engines": {
    "node": ">=14.0.0"
  },
  "preferGlobal": false
}
```

#### CLI Entry Point (cli.js)

```javascript
#!/usr/bin/env node

const { program } = require('commander');
const installer = require('./lib/installer');

program
  .name('bmad-expert')
  .description('BMAD Expert agent installer')
  .version('1.0.0');

program
  .command('install')
  .description('Install BMAD Expert agent into HappyCapy')
  .option('-d, --destination <path>', 'Installation directory', process.cwd())
  .option('-m, --model <model>', 'AI model to use', 'claude-sonnet-4.5')
  .option('-y, --yes', 'Skip confirmation prompts', false)
  .option('--json', 'Output machine-readable JSON', false)
  .action(async (options) => {
    try {
      const result = await installer.install(options);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('✓ Installation complete!');
        console.log(`  Agent ID: ${result.agentId}`);
        console.log(`  Location: ${result.installPath}`);
      }

      process.exit(0);
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({ error: error.message, code: error.code }, null, 2));
      } else {
        console.error('✗ Installation failed:', error.message);
      }
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Remove BMAD Expert agent')
  .argument('<agent-id>', 'Agent ID to remove')
  .action(async (agentId, options) => {
    await installer.uninstall(agentId, options);
  });

program.parse();
```

#### Postinstall Hook (postinstall.js)

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Detect if running in global vs local install
const isGlobalInstall = () => {
  const npmConfig = process.env.npm_config_global;
  if (npmConfig === 'true') return true;

  // Check if parent directory is global node_modules
  const installPath = path.resolve(__dirname);
  const globalPrefix = require('child_process')
    .execSync('npm config get prefix')
    .toString()
    .trim();
  return installPath.includes(globalPrefix);
};

// Only run postinstall for global installations
if (isGlobalInstall()) {
  console.log('\n✓ bmad-expert CLI installed globally');
  console.log('\nQuick start:');
  console.log('  bmad-expert install');
  console.log('\nFor help:');
  console.log('  bmad-expert --help\n');
} else {
  // Local install - silent (will be called via npx)
  // Don't output noise during dependency installation
}

// Check for required peer dependencies
const checkDependencies = () => {
  const requiredCommands = ['git'];
  const missing = [];

  requiredCommands.forEach(cmd => {
    try {
      require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' });
    } catch (error) {
      missing.push(cmd);
    }
  });

  if (missing.length > 0 && isGlobalInstall()) {
    console.warn(`\n⚠ Warning: Required commands not found: ${missing.join(', ')}`);
  }
};

checkDependencies();
```

#### When to use npx vs npm install -g

**Use `npx bmad-expert install` (local, ephemeral) when:**
- ✅ Users need to run the tool once or occasionally
- ✅ You want zero installation friction
- ✅ Users shouldn't pollute global namespace
- ✅ Tool version should match project requirements
- ✅ Example: `create-react-app`, `degit`

**Use `npm install -g bmad-expert` (global) when:**
- ✅ Tool is used frequently across multiple projects
- ✅ Tool provides general-purpose utilities (like `git`, `docker`)
- ✅ Command name should be memorable and always available
- ✅ Example: `@angular/cli`, `typescript`, `eslint`

**Hybrid approach (recommended):**
```json
{
  "name": "bmad-expert-installer",
  "preferGlobal": false,
  "bin": {
    "bmad-expert": "./cli.js"
  }
}
```

This allows both:
```bash
# One-time usage (recommended for users)
npx bmad-expert install

# Global installation (for power users)
npm install -g bmad-expert-installer
bmad-expert install
```

#### Postinstall Hook Best Practices

**❌ DON'T:**
- Don't make network requests in postinstall (slow, unreliable)
- Don't prompt for user input (breaks automation)
- Don't write to filesystem outside package directory (security risk)
- Don't execute arbitrary code from dependencies

**✅ DO:**
- Check system requirements (Node version, OS)
- Compile native addons if needed
- Create local cache directories
- Print helpful usage information (only for global installs)
- Keep execution time under 1 second

**Example: Safe postinstall**
```javascript
// postinstall.js
const fs = require('fs');
const path = require('path');
const os = require('os');

// Check Node version
const MIN_NODE_VERSION = 14;
const currentVersion = parseInt(process.version.slice(1).split('.')[0]);
if (currentVersion < MIN_NODE_VERSION) {
  console.error(`Error: Node ${MIN_NODE_VERSION}+ required, found ${process.version}`);
  process.exit(1);
}

// Create cache directory
const cacheDir = path.join(os.homedir(), '.bmad-expert-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Success message
console.log('✓ bmad-expert setup complete');
```

**Sources:**
- npm documentation: https://docs.npmjs.com/cli/v9/using-npm/scripts#life-cycle-scripts
- Avoiding postinstall scripts anti-patterns: https://blog.npmjs.org/post/141702881055/package-install-scripts-vulnerability
- Commander.js: https://github.com/tj/commander.js

---

## 3. Cross-Platform Agent Registration Patterns

### Pattern: Template generators that handle multi-platform installation

Tools like Yeoman, create-react-app, and degit handle copying files to different directories based on OS/tool detection. Here's how they work:

#### Yeoman Generator Pattern

```javascript
const Generator = require('yeoman-generator');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    // CLI arguments
    this.argument('agentName', {
      type: String,
      required: false,
      default: 'bmad-expert'
    });

    this.option('destination', {
      type: String,
      alias: 'd',
      description: 'Installation directory'
    });

    this.option('platform', {
      type: String,
      default: process.platform,
      description: 'Target platform (linux, darwin, win32)'
    });
  }

  // Step 1: Detect environment and prompt for configuration
  async prompting() {
    // Detect available platforms
    const detectedPlatforms = await this._detectPlatforms();

    const answers = await this.prompt([
      {
        type: 'list',
        name: 'targetPlatform',
        message: 'Select installation target:',
        choices: detectedPlatforms,
        default: detectedPlatforms[0]?.value
      },
      {
        type: 'input',
        name: 'agentId',
        message: 'Agent identifier:',
        default: this.options.agentName || 'bmad-expert'
      },
      {
        type: 'input',
        name: 'displayName',
        message: 'Agent display name:',
        default: 'BMAD Expert'
      },
      {
        type: 'list',
        name: 'model',
        message: 'AI model:',
        choices: [
          'claude-sonnet-4.5',
          'claude-opus-4.6',
          'gpt-4o'
        ]
      }
    ]);

    this.config = answers;
  }

  // Step 2: Detect available platforms
  async _detectPlatforms() {
    const platforms = [];

    // Check for HappyCapy
    try {
      await this.spawnCommand('happycapy-cli', ['--version'], { stdio: 'ignore' });
      const happyCapyPath = path.join(os.homedir(), '.happycapy', 'agents');
      if (fs.existsSync(happyCapyPath)) {
        platforms.push({
          name: 'HappyCapy (~/.happycapy/agents)',
          value: 'happycapy',
          path: happyCapyPath
        });
      }
    } catch (e) {
      // HappyCapy not available
    }

    // Check for Claude Code (project-local)
    platforms.push({
      name: 'Claude Code (.claude/ in current directory)',
      value: 'claude-code-local',
      path: path.join(process.cwd(), '.claude')
    });

    // Check for Cursor
    const cursorPath = path.join(process.cwd(), '.cursor');
    if (fs.existsSync(cursorPath)) {
      platforms.push({
        name: 'Cursor (.cursor/ in current directory)',
        value: 'cursor',
        path: cursorPath
      });
    }

    return platforms;
  }

  // Step 3: Copy template files with platform-specific adaptations
  writing() {
    const config = this.config;
    const platform = config.targetPlatform;

    // Determine destination path
    let destinationPath;
    switch (platform) {
      case 'happycapy':
        destinationPath = path.join(
          os.homedir(),
          '.happycapy',
          'agents',
          config.agentId
        );
        break;
      case 'claude-code-local':
        destinationPath = path.join(process.cwd(), '.claude');
        break;
      case 'cursor':
        destinationPath = path.join(process.cwd(), '.cursor');
        break;
      default:
        destinationPath = this.destinationPath(config.agentId);
    }

    // Create directory
    fs.ensureDirSync(destinationPath);

    // Copy template files with EJS templating
    const templateFiles = this._getTemplateFiles(platform);

    templateFiles.forEach(file => {
      this.fs.copyTpl(
        this.templatePath(file.source),
        path.join(destinationPath, file.destination),
        {
          agentId: config.agentId,
          displayName: config.displayName,
          model: config.model,
          platform: platform,
          timestamp: new Date().toISOString()
        }
      );
    });

    this.destinationRoot(destinationPath);
  }

  _getTemplateFiles(platform) {
    const commonFiles = [
      { source: 'SOUL.md.ejs', destination: 'SOUL.md' },
      { source: 'AGENTS.md.ejs', destination: 'AGENTS.md' },
      { source: 'README.md.ejs', destination: 'README.md' }
    ];

    // Platform-specific files
    const platformFiles = {
      'happycapy': [
        { source: 'happycapy/IDENTITY.md.ejs', destination: 'IDENTITY.md' },
        { source: 'happycapy/MEMORY.md.ejs', destination: 'MEMORY.md' },
        { source: 'happycapy/USER.md.ejs', destination: 'USER.md' },
        { source: 'happycapy/BOOTSTRAP.md.ejs', destination: 'BOOTSTRAP.md' }
      ],
      'claude-code-local': [
        { source: 'claude/CLAUDE.md.ejs', destination: 'CLAUDE.md' }
      ],
      'cursor': [
        { source: 'cursor/rules.md.ejs', destination: 'rules/bmad-expert.md' }
      ]
    };

    return [...commonFiles, ...(platformFiles[platform] || [])];
  }

  // Step 4: Run post-installation commands
  async install() {
    const platform = this.config.targetPlatform;

    if (platform === 'happycapy') {
      // Register with HappyCapy CLI
      this.log('Registering agent with HappyCapy...');
      try {
        await this.spawnCommand('happycapy-cli', [
          'add',
          this.config.agentId,
          this.config.displayName,
          this.config.model
        ]);
        this.log('✓ Agent registered successfully');
      } catch (error) {
        this.log('⚠ Auto-registration failed. Please run manually:');
        this.log(`  happycapy-cli add "${this.config.agentId}" "${this.config.displayName}" "${this.config.model}"`);
      }
    }
  }

  // Step 5: Show completion message
  end() {
    this.log('\n' + '='.repeat(50));
    this.log('✓ BMAD Expert agent installed successfully!');
    this.log('='.repeat(50) + '\n');

    const platform = this.config.targetPlatform;
    const messages = {
      'happycapy': `
Your agent is ready to use in HappyCapy.

Next steps:
  1. Create a new desktop in HappyCapy
  2. Select "${this.config.displayName}" as your agent
  3. Start your first conversation!
`,
      'claude-code-local': `
Your agent configuration is at: .claude/

Next steps:
  1. Open this directory in Claude Code
  2. The agent will be automatically loaded
  3. Start coding!
`,
      'cursor': `
Your agent rules are at: .cursor/rules/bmad-expert.md

Next steps:
  1. Open this project in Cursor
  2. The rules will be automatically applied
  3. Start coding!
`
    };

    this.log(messages[platform] || 'Installation complete!');
  }
};
```

#### create-react-app Pattern (Simpler, direct approach)

```javascript
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

async function createAgent(agentName, options = {}) {
  // Resolve destination
  const root = path.resolve(
    options.destination || path.join(os.homedir(), '.happycapy', 'agents', agentName)
  );

  // Check if directory already exists
  if (fs.existsSync(root)) {
    console.error(chalk.red(`Error: Directory already exists: ${root}`));
    console.log('Please choose a different agent name or remove the existing directory.');
    process.exit(1);
  }

  console.log(`Creating agent at ${chalk.green(root)}...`);

  // Create directory
  fs.ensureDirSync(root);

  // Copy template files
  const templateDir = path.join(__dirname, '..', 'templates', 'agent');
  await fs.copy(templateDir, root);

  // Update template variables
  const packagePath = path.join(root, 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = require(packagePath);
    packageJson.name = agentName;
    fs.writeJsonSync(packagePath, packageJson, { spaces: 2 });
  }

  // Process EJS templates
  const templateFiles = ['SOUL.md', 'AGENTS.md', 'README.md'];
  for (const file of templateFiles) {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content
        .replace(/{{agentName}}/g, agentName)
        .replace(/{{timestamp}}/g, new Date().toISOString());
      fs.writeFileSync(filePath, content);
    }
  }

  console.log(chalk.green('✓ Agent created successfully!\n'));

  // Show next steps
  console.log('Next steps:');
  console.log(`  cd ${chalk.cyan(root)}`);
  console.log(`  happycapy-cli add "${agentName}" "My Agent" "claude-sonnet-4.5"`);

  return { root, agentName };
}

module.exports = { createAgent };
```

#### degit Pattern (Git-based template cloning)

```javascript
const degit = require('degit');
const path = require('path');
const os = require('os');

async function installAgentFromGit(repoUrl, agentId, options = {}) {
  const destination = options.destination || path.join(
    os.homedir(),
    '.happycapy',
    'agents',
    agentId
  );

  // Clone from git without history
  const emitter = degit(repoUrl, {
    cache: true,
    force: options.force || false,
    verbose: options.verbose || false
  });

  // Progress events
  emitter.on('info', info => {
    console.log(info.message);
  });

  emitter.on('warn', warning => {
    console.warn('⚠', warning.message);
  });

  try {
    await emitter.clone(destination);
    console.log('✓ Agent template cloned');

    // Post-clone customization
    await customizeTemplate(destination, agentId, options);

    return { destination, agentId };
  } catch (error) {
    console.error('✗ Clone failed:', error.message);
    throw error;
  }
}

async function customizeTemplate(destination, agentId, options) {
  const fs = require('fs-extra');

  // Update agent-specific files
  const configPath = path.join(destination, 'agent.config.json');
  if (fs.existsSync(configPath)) {
    const config = await fs.readJson(configPath);
    config.id = agentId;
    config.name = options.displayName || agentId;
    config.model = options.model || 'claude-sonnet-4.5';
    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  // Run template initialization script if exists
  const initScript = path.join(destination, 'scripts', 'init.js');
  if (fs.existsSync(initScript)) {
    require(initScript)({ agentId, options });
  }
}

module.exports = { installAgentFromGit };
```

**Sources:**
- Yeoman: https://yeoman.io/authoring/
- create-react-app: https://github.com/facebook/create-react-app/tree/main/packages/create-react-app
- degit: https://github.com/Rich-Harris/degit

---

## 4. Git Clone as Distribution Mechanism

### Pattern: Using git clone for template distribution with setup automation

Many modern tools use git repositories as the source of truth for templates, avoiding the need for npm publishing.

#### Simple Git Clone + Setup Pattern

```javascript
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

async function installAgentFromGitRepo(options = {}) {
  const {
    repoUrl = 'https://github.com/your-org/bmad-expert-template.git',
    agentId = 'bmad-expert',
    branch = 'main',
    destination = null
  } = options;

  // Determine installation path
  const installPath = destination || path.join(
    os.homedir(),
    '.happycapy',
    'agents',
    agentId
  );

  console.log(chalk.blue('Installing BMAD Expert agent...'));
  console.log(`Repository: ${repoUrl}`);
  console.log(`Destination: ${installPath}\n`);

  // Step 1: Clone repository
  console.log('Cloning template...');
  try {
    // Use --depth 1 for faster clone (no history)
    execSync(
      `git clone --depth 1 --branch ${branch} "${repoUrl}" "${installPath}"`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error(chalk.red('✗ Clone failed'));
    throw error;
  }

  // Step 2: Remove .git directory (template is no longer tracked)
  const gitDir = path.join(installPath, '.git');
  if (fs.existsSync(gitDir)) {
    await fs.remove(gitDir);
    console.log(chalk.gray('Removed .git directory'));
  }

  // Step 3: Run setup script if exists
  const setupScript = path.join(installPath, 'setup.js');
  if (fs.existsSync(setupScript)) {
    console.log('\nRunning setup script...');
    const setup = require(setupScript);
    await setup({ agentId, installPath, ...options });
  }

  // Step 4: Register with platform CLI
  if (options.register !== false) {
    await registerWithPlatform(agentId, options);
  }

  console.log(chalk.green('\n✓ Installation complete!'));
  return { installPath, agentId };
}

async function registerWithPlatform(agentId, options) {
  const { displayName = 'BMAD Expert', model = 'claude-sonnet-4.5' } = options;

  try {
    console.log('\nRegistering with HappyCapy...');
    execSync(
      `happycapy-cli add "${agentId}" "${displayName}" "${model}"`,
      { stdio: 'inherit' }
    );
    console.log(chalk.green('✓ Agent registered'));
  } catch (error) {
    console.log(chalk.yellow('⚠ Auto-registration failed'));
    console.log('Please register manually:');
    console.log(`  happycapy-cli add "${agentId}" "${displayName}" "${model}"`);
  }
}

module.exports = { installAgentFromGitRepo };
```

#### Setup Script Template (setup.js in repo)

```javascript
#!/usr/bin/env node

/**
 * This script runs after the template is cloned
 * Place this in your template repository as setup.js
 */

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setup(options = {}) {
  console.log('\n=== BMAD Expert Setup ===\n');

  const { agentId, installPath } = options;

  // 1. Prompt for customization
  const displayName = options.displayName ||
    await question('Agent display name [BMAD Expert]: ') || 'BMAD Expert';

  const model = options.model ||
    await question('AI model [claude-sonnet-4.5]: ') || 'claude-sonnet-4.5';

  // 2. Customize template files
  console.log('\nCustomizing template files...');

  const filesToCustomize = [
    'SOUL.md',
    'IDENTITY.md',
    'AGENTS.md',
    'README.md'
  ];

  for (const file of filesToCustomize) {
    const filePath = path.join(installPath, file);
    if (fs.existsSync(filePath)) {
      let content = await fs.readFile(filePath, 'utf8');

      // Replace template variables
      content = content
        .replace(/\{\{agentId\}\}/g, agentId)
        .replace(/\{\{displayName\}\}/g, displayName)
        .replace(/\{\{model\}\}/g, model)
        .replace(/\{\{installDate\}\}/g, new Date().toISOString());

      await fs.writeFile(filePath, content);
    }
  }

  // 3. Remove setup script (one-time use)
  await fs.remove(__filename);
  console.log('✓ Template customized');

  // 4. Create agent-specific directories
  const dirsToCreate = ['memory', 'output'];
  for (const dir of dirsToCreate) {
    const dirPath = path.join(installPath, dir);
    await fs.ensureDir(dirPath);
  }

  console.log('✓ Directories created');

  rl.close();
  return { displayName, model };
}

// Allow running directly or as module
if (require.main === module) {
  setup({
    agentId: process.argv[2] || 'bmad-expert',
    installPath: __dirname
  }).catch(console.error);
} else {
  module.exports = setup;
}
```

#### Advanced: Git Clone with Sparse Checkout

For large repositories where you only need a subdirectory:

```javascript
const { execSync } = require('child_process');
const path = require('path');

function cloneSparseDirectory(repoUrl, subdirectory, destination) {
  const tempDir = path.join(destination, '.temp-clone');

  try {
    // Initialize empty repo
    execSync(`git init "${tempDir}"`, { stdio: 'pipe' });

    // Configure sparse checkout
    execSync('git config core.sparseCheckout true', {
      cwd: tempDir,
      stdio: 'pipe'
    });

    // Specify which directory to checkout
    const sparseCheckoutFile = path.join(tempDir, '.git', 'info', 'sparse-checkout');
    require('fs').writeFileSync(sparseCheckoutFile, `${subdirectory}/\n`);

    // Add remote and pull
    execSync(`git remote add origin "${repoUrl}"`, {
      cwd: tempDir,
      stdio: 'pipe'
    });

    execSync('git pull --depth 1 origin main', {
      cwd: tempDir,
      stdio: 'inherit'
    });

    // Move subdirectory contents to destination
    const sourcePath = path.join(tempDir, subdirectory);
    require('fs-extra').copySync(sourcePath, destination);

    // Cleanup
    require('fs-extra').removeSync(tempDir);

    console.log(`✓ Cloned ${subdirectory} from repository`);
  } catch (error) {
    console.error('Sparse checkout failed:', error.message);
    throw error;
  }
}

// Usage
cloneSparseDirectory(
  'https://github.com/your-org/mono-repo.git',
  'packages/bmad-expert-agent',
  '/home/user/.happycapy/agents/bmad-expert'
);
```

#### Comparison: Git Clone vs npm Package

| Aspect | Git Clone | npm Package |
|--------|-----------|-------------|
| **Distribution** | GitHub/GitLab release | npm registry |
| **Version control** | Git tags/branches | Semantic versioning |
| **Size** | Full repo (can be large) | Only published files |
| **Updates** | `git pull` in directory | `npm update` |
| **Dependencies** | Manual installation | Automatic via package.json |
| **Customization** | Edit directly after clone | Harder (in node_modules) |
| **Best for** | Templates, one-time setup | Reusable packages, libraries |

**Recommendation for bmad-expert:**
Use git clone for the agent template distribution because:
- Users need to customize files (SOUL.md, AGENTS.md)
- Template is static after installation (not a library)
- No runtime dependencies to manage
- Direct file editing is expected workflow

**Sources:**
- Git sparse checkout: https://git-scm.com/docs/git-sparse-checkout
- degit (git clone alternative): https://github.com/Rich-Harris/degit
- Template distribution patterns: https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository

---

## 5. Exit Codes and Machine-Readable CLI Output

### Pattern: Designing CLIs for both human and programmatic consumption

When building CLIs that will be called by AI agents or automation scripts, structured output and meaningful exit codes are critical.

#### Exit Code Standards

```javascript
// exit-codes.js - Define semantic exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  MISUSE: 2,              // Invalid arguments
  DEPENDENCY_ERROR: 3,     // Required tool not found
  NETWORK_ERROR: 4,        // Connection failed
  FILE_ERROR: 5,           // File not found, permission denied
  ALREADY_EXISTS: 6,       // Resource already exists
  NOT_FOUND: 7,            // Resource not found
  VALIDATION_ERROR: 8,     // Input validation failed
  INTERRUPTED: 130,        // Ctrl+C (128 + SIGINT)
};

class CLIError extends Error {
  constructor(message, exitCode = EXIT_CODES.GENERAL_ERROR, details = {}) {
    super(message);
    this.name = 'CLIError';
    this.exitCode = exitCode;
    this.details = details;
  }
}

module.exports = { EXIT_CODES, CLIError };
```

#### Dual Output Mode Pattern

```javascript
const { Command } = require('commander');
const chalk = require('chalk');
const { EXIT_CODES, CLIError } = require('./exit-codes');

class CLIRunner {
  constructor(options = {}) {
    this.jsonOutput = options.json || false;
    this.verbose = options.verbose || false;
    this.silent = options.silent || false;
  }

  // Print to stdout (machine-readable when --json)
  output(data) {
    if (this.silent) return;

    if (this.jsonOutput) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      // Human-friendly output
      if (typeof data === 'string') {
        console.log(data);
      } else {
        this.prettyPrint(data);
      }
    }
  }

  // Print error to stderr
  error(error, exitCode = EXIT_CODES.GENERAL_ERROR) {
    if (this.jsonOutput) {
      const errorOutput = {
        success: false,
        error: {
          message: error.message || error,
          code: error.exitCode || exitCode,
          type: error.name || 'Error',
          details: error.details || {}
        }
      };
      console.error(JSON.stringify(errorOutput, null, 2));
    } else {
      console.error(chalk.red('✗'), error.message || error);
      if (this.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  // Pretty print object (human mode only)
  prettyPrint(data) {
    if (data.success !== undefined) {
      console.log(data.success ? chalk.green('✓') : chalk.red('✗'), data.message || '');
    }

    if (data.details) {
      Object.entries(data.details).forEach(([key, value]) => {
        console.log(`  ${chalk.cyan(key)}: ${value}`);
      });
    }
  }
}

// Usage in CLI command
program
  .command('install')
  .option('--json', 'Output machine-readable JSON')
  .option('--verbose', 'Verbose output')
  .option('--silent', 'No output except errors')
  .action(async (options) => {
    const cli = new CLIRunner(options);

    try {
      const result = await installAgent(options);

      cli.output({
        success: true,
        message: 'Agent installed successfully',
        details: {
          agentId: result.agentId,
          path: result.installPath,
          model: result.model,
          timestamp: new Date().toISOString()
        }
      });

      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      cli.error(error, error.exitCode || EXIT_CODES.GENERAL_ERROR);
      process.exit(error.exitCode || EXIT_CODES.GENERAL_ERROR);
    }
  });
```

#### Structured JSON Output Schema

```javascript
// Define consistent output schema for machine consumption
const OutputSchema = {
  // Success response
  success: {
    success: true,
    data: {
      // Command-specific data
      agentId: 'string',
      installPath: 'string',
      // ... other fields
    },
    metadata: {
      command: 'string',
      version: 'string',
      timestamp: 'ISO8601 string',
      duration: 'number (ms)'
    }
  },

  // Error response
  error: {
    success: false,
    error: {
      message: 'string',
      code: 'number',
      type: 'string',
      details: {
        // Context-specific error details
      }
    },
    metadata: {
      command: 'string',
      version: 'string',
      timestamp: 'ISO8601 string'
    }
  }
};

// Implementation
class StructuredOutput {
  constructor(command, version) {
    this.command = command;
    this.version = version;
    this.startTime = Date.now();
  }

  success(data) {
    return {
      success: true,
      data,
      metadata: {
        command: this.command,
        version: this.version,
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.startTime
      }
    };
  }

  error(error, code = EXIT_CODES.GENERAL_ERROR) {
    return {
      success: false,
      error: {
        message: error.message || String(error),
        code: error.exitCode || code,
        type: error.name || 'Error',
        details: error.details || {}
      },
      metadata: {
        command: this.command,
        version: this.version,
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.startTime
      }
    };
  }
}

// Usage
async function runInstallCommand(options) {
  const output = new StructuredOutput('install', '1.0.0');

  try {
    const result = await installAgent(options);

    if (options.json) {
      console.log(JSON.stringify(output.success(result), null, 2));
    } else {
      console.log(chalk.green('✓ Installation complete'));
      console.log(`Agent ID: ${result.agentId}`);
      console.log(`Path: ${result.installPath}`);
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    if (options.json) {
      console.error(JSON.stringify(output.error(error), null, 2));
    } else {
      console.error(chalk.red('✗ Installation failed:'), error.message);
    }

    process.exit(error.exitCode || EXIT_CODES.GENERAL_ERROR);
  }
}
```

#### AI Agent-Friendly CLI Design

When designing CLIs that will be called by AI agents:

```javascript
/**
 * AI Agent-Friendly CLI Best Practices
 */

// 1. Provide --dry-run mode for validation
program
  .command('install')
  .option('--dry-run', 'Validate without making changes')
  .action(async (options) => {
    if (options.dryRun) {
      const validation = await validateInstallation(options);
      console.log(JSON.stringify({
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      }, null, 2));
      process.exit(validation.valid ? 0 : EXIT_CODES.VALIDATION_ERROR);
    }

    // ... actual installation
  });

// 2. Provide --check command for pre-flight validation
program
  .command('check')
  .description('Check system requirements and dependencies')
  .option('--json', 'Output JSON')
  .action(async (options) => {
    const checks = await runSystemChecks();

    if (options.json) {
      console.log(JSON.stringify(checks, null, 2));
    } else {
      printCheckResults(checks);
    }

    const allPassed = checks.every(c => c.passed);
    process.exit(allPassed ? EXIT_CODES.SUCCESS : EXIT_CODES.DEPENDENCY_ERROR);
  });

// 3. Provide idempotent operations
async function installAgent(options) {
  const { agentId, force = false } = options;
  const installPath = getInstallPath(agentId);

  if (fs.existsSync(installPath)) {
    if (force) {
      await fs.remove(installPath);
      console.log('Removed existing installation');
    } else {
      throw new CLIError(
        `Agent ${agentId} already exists`,
        EXIT_CODES.ALREADY_EXISTS,
        { path: installPath, agentId }
      );
    }
  }

  // ... proceed with installation
}

// 4. Support non-interactive mode
program
  .command('install')
  .option('-y, --yes', 'Skip all prompts (use defaults)')
  .option('--agent-id <id>', 'Agent identifier')
  .option('--model <model>', 'AI model to use')
  .action(async (options) => {
    let config;

    if (options.yes) {
      // Non-interactive: use CLI args or defaults
      config = {
        agentId: options.agentId || 'bmad-expert',
        model: options.model || 'claude-sonnet-4.5',
        // ... other defaults
      };
    } else {
      // Interactive: prompt user
      config = await promptForConfig();
    }

    await installAgent(config);
  });

// 5. Provide machine-parseable progress updates
function createProgressReporter(jsonMode) {
  if (jsonMode) {
    return {
      start: (step, total) => {
        console.error(JSON.stringify({ type: 'progress', step, total, status: 'started' }));
      },
      update: (step, total, message) => {
        console.error(JSON.stringify({ type: 'progress', step, total, status: 'running', message }));
      },
      complete: (step, total) => {
        console.error(JSON.stringify({ type: 'progress', step, total, status: 'completed' }));
      }
    };
  } else {
    // Human-friendly progress bar
    return {
      start: (step, total) => console.log(`[${step}/${total}] Starting...`),
      update: (step, total, message) => console.log(`[${step}/${total}] ${message}`),
      complete: (step, total) => console.log(`[${step}/${total}] ✓ Complete`)
    };
  }
}

// Usage
const progress = createProgressReporter(options.json);
progress.start(1, 3);
await cloneRepository();
progress.complete(1, 3);
progress.start(2, 3);
await customizeTemplate();
progress.complete(2, 3);
progress.start(3, 3);
await registerAgent();
progress.complete(3, 3);
```

#### Exit Code Documentation

Document exit codes in CLI help and README:

```javascript
program
  .command('exit-codes')
  .description('Show exit code documentation')
  .action(() => {
    console.log(`
Exit Codes:

  0   Success
  1   General error
  2   Invalid arguments or command misuse
  3   Required dependency not found (e.g., git, happycapy-cli)
  4   Network error (e.g., git clone failed)
  5   File system error (e.g., permission denied)
  6   Resource already exists
  7   Resource not found
  8   Validation error
  130 Interrupted (Ctrl+C)

Examples:

  # Check exit code in shell
  bmad-expert install --agent-id test
  echo $?

  # Check exit code in Node.js
  const { spawnSync } = require('child_process');
  const result = spawnSync('bmad-expert', ['install', '--agent-id', 'test']);
  console.log('Exit code:', result.status);

  # Parse JSON output
  bmad-expert install --agent-id test --json > output.json
  if [ $? -eq 0 ]; then
    echo "Success"
  else
    echo "Failed with code $?"
  fi
`);
  });
```

#### Testing CLI Exit Codes

```javascript
// tests/cli.test.js
const { spawnSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'cli.js');

describe('CLI exit codes', () => {
  test('exits with 0 on successful install', () => {
    const result = spawnSync('node', [CLI, 'install', '--dry-run', '--yes'], {
      encoding: 'utf8'
    });
    expect(result.status).toBe(0);
  });

  test('exits with 2 on invalid arguments', () => {
    const result = spawnSync('node', [CLI, 'install', '--invalid-flag'], {
      encoding: 'utf8'
    });
    expect(result.status).toBe(2);
  });

  test('exits with 6 when agent already exists', () => {
    const result = spawnSync('node', [CLI, 'install', '--agent-id', 'existing'], {
      encoding: 'utf8'
    });
    expect(result.status).toBe(6);
  });

  test('outputs valid JSON in --json mode', () => {
    const result = spawnSync('node', [CLI, 'install', '--json', '--dry-run'], {
      encoding: 'utf8'
    });

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('success');
    expect(output).toHaveProperty('metadata');
  });
});
```

**Sources:**
- Exit code conventions: https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html
- Advanced Bash-Scripting Guide: https://tldp.org/LDP/abs/html/exitcodes.html
- CLI JSON output patterns: https://clig.dev/#output
- Commander.js error handling: https://github.com/tj/commander.js#error-handling

---

## Summary: Recommended Architecture for bmad-expert Installer

Based on this research, here's the recommended architecture for `npx bmad-expert install`:

### Package Structure
```
bmad-expert-installer/
├── package.json           # bin: "bmad-expert", no postinstall
├── cli.js                 # Commander CLI entry point
├── lib/
│   ├── installer.js       # Main installation logic
│   ├── git-clone.js       # Git clone utilities
│   ├── platform-detect.js # HappyCapy/Cursor/Claude detection
│   ├── exit-codes.js      # Semantic exit codes
│   └── output.js          # Dual mode output (human/JSON)
├── templates/             # Fallback templates (if git clone fails)
└── README.md
```

### Installation Flow
1. **Detect platform** - Check for `happycapy-cli`, `.cursor/`, Claude Code project
2. **Clone template** - `git clone --depth 1` from GitHub
3. **Customize** - Run setup script, replace template variables
4. **Register** - Call platform CLI if available (graceful fallback)
5. **Report** - Exit with semantic code + JSON/human output

### Key Features
- ✅ `npx bmad-expert install` - Zero global installation
- ✅ `--json` flag for AI agent consumption
- ✅ Semantic exit codes (0-8, 130)
- ✅ Idempotent operations (--force to overwrite)
- ✅ Non-interactive mode (--yes)
- ✅ Dry-run validation (--dry-run)
- ✅ Multi-platform support (auto-detect HappyCapy/Cursor/Claude)
- ✅ Git clone for distribution (no npm package needed for template)

### Example Usage

```bash
# Interactive install (human)
npx bmad-expert install

# Non-interactive install (AI agent)
npx bmad-expert install \
  --agent-id bmad-expert \
  --model claude-sonnet-4.5 \
  --yes \
  --json

# Check system requirements
npx bmad-expert check --json

# Validate before install
npx bmad-expert install --dry-run --json
```

This architecture combines the best patterns from modern CLI tools while being optimized for AI agent consumption.

---

## Additional Resources

- **CLI Guidelines**: https://clig.dev/
- **12 Factor CLI Apps**: https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46
- **Node.js CLI Best Practices**: https://github.com/lirantal/nodejs-cli-apps-best-practices
- **Commander.js Documentation**: https://github.com/tj/commander.js
- **Yeoman Best Practices**: https://yeoman.io/authoring/best-practices.html
