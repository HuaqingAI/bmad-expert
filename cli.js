#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { EXIT_CODES } from './lib/exit-codes.js'
import { BmadError } from './lib/errors.js'
import { printError } from './lib/output.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))

const program = new Command()

program
  .name('bmad-expert')
  .description('BMAD Agent 安装器与新手教练 - 一条命令完成跨平台 BMAD 安装')
  .version(pkg.version)

program
  .command('install')
  .description('平台感知完整安装 BMAD agent')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--yes', '非交互模式，跳过所有确认提示')
  .action(async (options) => {
    const { detectPlatform, getAdapter } = await import('./lib/platform.js')
    const { checkInstallStatus } = await import('./lib/installer.js')
    const { printProgress } = await import('./lib/output.js')

    printProgress('正在检测平台...')
    const platform = await detectPlatform(options.platform ?? null)
    printProgress('正在检测平台...', true)

    const adapter = getAdapter(platform)
    await checkInstallStatus(adapter, options.agentId)

    // TODO(Story 2.4): 实现完整安装流程（文件复制、变量替换、happycapy-cli 注册）
  })

// Growth 阶段命令占位（Story 6.x 实现，勿提前实现逻辑）
program
  .command('update')
  .description('安全更新框架文件，保留用户 memory 与个性化配置（Growth）')
  .action(() => {
    // TODO: Story 6.1 实现
  })

program
  .command('status')
  .description('检查当前安装健康度（Growth）')
  .action(() => {
    // TODO: Story 6.2 实现
  })

const CODE_TO_EXIT = {
  E001: EXIT_CODES.GENERAL_ERROR,
  E002: EXIT_CODES.INVALID_ARGS,
  E003: EXIT_CODES.MISSING_DEPENDENCY,
  E004: EXIT_CODES.PERMISSION_DENIED,
  E005: EXIT_CODES.NETWORK_ERROR,
  E006: EXIT_CODES.ALREADY_INSTALLED,
}

program.parseAsync().catch(err => {
  if (err instanceof BmadError && err.bmadCode === 'E006') {
    // ALREADY_INSTALLED 是正常状态：消息已由 checkInstallStatus 打印到 stdout
    // 不走 printError（不是真正的错误），直接以 exit code 6 退出
    process.exit(EXIT_CODES.ALREADY_INSTALLED)
  } else {
    printError(err)
    if (err instanceof BmadError) {
      process.exit(CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
    } else {
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
  }
})
