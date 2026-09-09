#!/usr/bin/env node
/**
 * 打包终验脚本(手工验 5.3.32 双包命令的固化版)
 *
 * 用法: node build/bin/verify-pkg.js [dist-dir]   (缺省 dist/)
 *
 * 对目录内每个 ANCHOR-*.exe / ANCHOR-*.dmg:
 *   exe: 解两层 7z → pty.node 为 PE("for MS Windows")
 *        + asar 解包 → assets/js/ 下 basic-<ver>.js / electerm-<ver>.js 与 package.json 版本一致
 *   dmg: 仅 hdiutil verify(mac 包无 PE 概念)
 *   两者均输出 md5
 *
 * 全过: PKG-VERIFY-PASS <文件名>;失败: PKG-VERIFY-FAIL <文件名> <原因> 且 exit 1
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SEVEN_ZZ = '/opt/homebrew/bin/7zz'
const PTY_REL = 'resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node'

function run (cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10 * 60 * 1000, ...opts })
    .toString()
    .trim()
}

/** exe: PE 检查 + asar 版本链检查,失败 throw Error(原因) */
function verifyExe (exe, version, tmp) {
  // 第一层:从 NSIS installer 抽 $PLUGINSDIR/app-arm64.7z
  const l1 = path.join(tmp, 'l1')
  run(SEVEN_ZZ, ['x', exe, '$PLUGINSDIR/app-arm64.7z', '-y', `-o${l1}`])
  const inner7z = path.join(l1, '$PLUGINSDIR', 'app-arm64.7z')
  if (!fs.existsSync(inner7z)) throw new Error('未从 installer 抽出 $PLUGINSDIR/app-arm64.7z')

  // 第二层:全量解 app-64.7z(asar extract 需要 app.asar.unpacked 与 app.asar 旁挂齐全)
  const l2 = path.join(tmp, 'l2')
  run(SEVEN_ZZ, ['x', inner7z, '-y', `-o${l2}`])

  // PE 检查
  const ptyNode = path.join(l2, ...PTY_REL.split('/'))
  if (!fs.existsSync(ptyNode)) throw new Error(`包内缺 ${PTY_REL}`)
  const fileType = run('file', ['-b', ptyNode])
  if (!fileType.includes('for MS Windows')) throw new Error(`pty.node 非 PE: ${fileType}`)

  // asar 版本链
  const asar = path.join(l2, 'resources', 'app.asar')
  const asarx = path.join(tmp, 'asarx')
  run('npx', ['--yes', '@electron/asar', 'extract', asar, asarx])
  const jsDir = path.join(asarx, 'assets', 'js')
  if (!fs.existsSync(jsDir)) throw new Error('asar 内缺 assets/js/')
  for (const base of ['basic', 'electerm']) {
    const f = `${base}-${version}.js`
    if (!fs.existsSync(path.join(jsDir, f))) {
      throw new Error(`asar 内缺 ${f}(现有: ${fs.readdirSync(jsDir).filter(x => x.startsWith(base + '-')).slice(0, 3).join(', ')})`)
    }
  }
}

function main () {
  const distDir = process.argv[2] || 'dist'
  if (!fs.existsSync(distDir)) {
    console.error(`PKG-VERIFY-FAIL ${distDir} 目录不存在`)
    process.exit(1)
  }
  const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version

  const pkgs = fs.readdirSync(distDir)
    .filter(f => /^ANCHOR-.*\.(exe|dmg)$/.test(f))
    .sort()
  if (!pkgs.length) {
    console.error(`PKG-VERIFY-FAIL ${distDir} 无 ANCHOR-*.exe / ANCHOR-*.dmg`)
    process.exit(1)
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-verify-'))
  let failed = false
  try {
    for (const name of pkgs) {
      const file = path.join(distDir, name)
      try {
        if (name.endsWith('.exe')) {
          verifyExe(file, version, tmp)
        } else {
          run('hdiutil', ['verify', file]) // dmg 只验完整性
        }
        console.log(`MD5 ${run('md5', ['-q', file])} ${name}`)
        console.log(`PKG-VERIFY-PASS ${name}`)
      } catch (e) {
        failed = true
        console.log(`PKG-VERIFY-FAIL ${name} ${e.message.split('\n')[0]}`)
      } finally {
        fs.rmSync(path.join(tmp, 'l1'), { recursive: true, force: true })
        fs.rmSync(path.join(tmp, 'l2'), { recursive: true, force: true })
        fs.rmSync(path.join(tmp, 'asarx'), { recursive: true, force: true })
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  if (failed) process.exit(1)
}

main()
