#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
  .action(async (_options) => {
    // TODO: Story 2.x 实现完整安装逻辑
    // 实现时参考架构文档：lib/installer.js → platform.js → adapter → output.js
    console.log('install command - to be implemented in Story 2.x')
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

program.parseAsync().catch(err => {
  process.stderr.write(`${err.message}\n`)
  process.exit(1)
})
