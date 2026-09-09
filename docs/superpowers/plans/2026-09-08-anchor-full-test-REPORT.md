# ANCHOR 全量功能测试 — 回归报告

- 计划：`docs/superpowers/plans/2026-09-08-anchor-full-test.md`
- 基线：`f1ed7cb`（5.3.32 + 冲突弹窗中文修复）→ HEAD `442b8fd`
- 执行方式：SDD（每 task 独立 implementer + 独立评审，fix loop 1 轮触发 1 次）
- 环境：dev Electron (CDP 9222) + orb-ubuntu本地机（192.168.139.214，密钥登录）真机链路

## 总结果：12 域全过（11 PASS + 1 SKIP 说明），2 个产品缺陷入池（1 已修）

| # | 域 | 结果 | commit | 关键证据 |
|---|---|---|---|---|
| 1 | e2e 脚手架 | ✅ PASS | 8ac7508 | smoke 两次 SMOKE-PASS，helper 6 函数导出 |
| 2 | 启动/窗口/退出 | ✅ PASS | 85cbc02 | splash #eef1f5、退出确认接线、取消路径实测（截图 /tmp/exit-confirm.png） |
| 3 | 连接管理（书签 CRUD/搜索/分组） | ✅ PASS | 82f0459 | 8/8 检查 OK，建→显→搜→改→删全链；跳板由单测 17/17 作证 |
| 4 | 终端 | ✅ PASS | 1247374 | tab status=success；`echo "**abc**"` 不丢 `*`（zmodem 回归）✓ |
| 5 | 遥测侧栏 | ✅ PASS | a672a49 | 无滚动 828≤828、顺序 TARGET/HEALTH/DISK/TREND/NET、TREND=100、DISK 浮层 380px；截图 /tmp/e2e-rail.png |
| 6 | SFTP 浏览 | ✅ PASS | b194a41 | mkdir/rename/cleaned + 权限 chmod600 + 排序/过滤/右键/三弹窗 |
| 7 | 文件传输（8 场景） | ✅ PASS | 091bd22 | dl/up md5 双向一致；mix ⇅+双色行；pause 冻结/恢复；limit avg 2.39@2；conflict 弹窗→跳过→无残留；cancel id 移除无假活；expand rows==n→完成自动消失（尾帧回归）✓ |
| 8 | 设置 | ✅ PASS | 7ea94a4 | 23 断言：--ink0 #eef1f5/#0f141d、--termBg 跟随、debounce、原值恢复；截图 e2e-light/dark.png |
| 9 | 快捷命令/通知/布局 | ✅ PASS | 4bf0e02 + 8cdc4a0 | QM 全生命周期（建→执行落终端→删→撤销→删→freq 清理）、confirm 双路径、c1↔c2 拆分回退、rail chartMode |
| 10 | 持久化/迁移（单测） | ✅ PASS | 8775e5b | 12/12：sqlite CRUD roundtrip、加密落盘（enc: 前缀+明文不出现）、4 版本迁移不丢字段、transfer-history |
| 11 | 打包终验脚本 | ✅ PASS | 442b8fd | verify-pkg.js 对 5.3.32 双包实跑 EXIT=0（exe PE+版本链+md5；dmg hdiutil VALID） |
| 12 | 本报告 | ✅ | — | — |

SKIP 说明：rdp/vnc/spice/web/ai/batch-op 为 electerm 上游遗留、slim 未启用，不在测试范围（计划 Self-Review 已声明）。

## 产品缺陷（测试发现）

| ID | 描述 | 状态 |
|---|---|---|
| DEFECT-1 | ConnectionManager 不自刷新：新建书签入库后面板不自动出现，需手动刷新/重开 | **待修**（证据 task-3-report.md） |
| DEFECT-2 | file-info-modal 缺 uidTree 疑似整页 crash | **待复现确认**（reviewer 判证据不足，降级） |
| DEFECT-3 | translate(undefined) → capitalizeFirstLetter.charAt 崩掉整棵 React 树（e2e 数据缺 type 字段触发） | **已修**：capitalizeFirstLetter 容错（7fdc92b）+ helper 数据补全 |

## Deferred minor（不阻塞，已记 ledger）

- T1: crash 断言沿用英文串；gotoSftp/pushDownload 首消费者已验证
- T2: 确认→真退出路径仅静态验证（共享实例约束）
- T4: exec 通道/升级禁用/搜索/重连/粘贴无 e2e 断言（brief 原生缺口）
- T5: HEALTH gauge 数未锁；Tooltip 无真实弹出断言；挂载数分支
- T8: Select 选择器依赖 DOM 顺序；probe 非合法主题 id
- T11: 内层包名写死 app-arm64.7z；7zz 路径硬编码

## 执行期环境事件（不影响结论）

- muse/deepseek-flash 模型多次 403/400 → 按模型路由降级重派（glm-5.3 兜底）
- OrbStack VM 两次假死（ping 通但 ssh banner 超时）→ OrbStack 完全重启恢复；e2e ssh 全部加 20s 超时保护
- 9-02 孤儿 dev-server（版本冻 5.3.11）→ 重起修复；dev-server 必须 cwd=build/vite 启动

## Rulings（controller 裁定记录）

1. 不建 worktree，直接 slim 跑——e2e 依赖本目录 node_modules + 单实例 Electron + 共享 userData
2. e2e implementer 串行派发——单实例锁 + 真机并发限制
3. implementer 只 commit 不 push，controller 收尾统一 push
4. e2e 推传输数据必须含 type/modifyTime（DEFECT-3 根因）
5. 限速精度判定用窗口增量测速，不用 speed 字段（累计均速口径偏低）
6. 恢复的旧 tab session ws 已失效，e2e 必须 freshSession

## 遗留工作

- DEFECT-1 修复（ConnectionManager 自刷新）
- DEFECT-2 复现确认
- 可选：上游 electerm 提 zmodem 修复 PR
- Windows 侧 5.3.31→5.3.32 回归（需 Windows 真机）
