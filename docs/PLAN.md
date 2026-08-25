# ANCHOR 实施计划

对应 SPEC.md。每阶段完成即提交;UI 逻辑走 TDD(先写 e2e 断言)。

## P0 骨架(本阶段)
- [x] 克隆 electerm → anchor,包名改 anchor
- [x] docs/SPEC.md、PLAN.md
- [ ] 新 `layout/` 组件:ANCHOR 布局壳(遥测栏占位/标签栏/内容区),替换 electerm Layout
- [ ] dev 启动冒烟:electron 窗口显示新壳,store/worker 桥接正常(读一条配置)

## P1 数据层
- [ ] bookmark/group CRUD 封装(走现有 store API)
- [ ] 历史记录(history)读写
- [ ] 认证门保留,样式套 ANCHOR token

## P2 连接管理器
- [ ] 树组件(分组实体 + 主机,搜索高亮/键盘导航/右键菜单/内联编辑)
- [ ] 表单抽屉(四段/下拉分组/跳板链引用列表/编辑预填)
- [ ] 删除撤销 toast、非空删除确认框
- e2e:迁移 full-test.js 管理器 18 项断言

## P3 快速连接页
- [ ] 历史列表 + 双击连接 + 清空 + 空状态
- [ ] 会话建立自动关主页
- e2e:6 项断言

## P4 终端标签
- [ ] xterm.js 接 session ws(electerm terminal 组件改造复用)
- [ ] 标签栏(状态点/关闭/切换)
- e2e:终端渲染断言

## P5 监控栏
- [ ] exec-cmd 轮询 /proc + 环形缓冲 + SVG 曲线(移植 demo 逻辑)
- [ ] 仅 ssh 标签显示、折叠/关闭
- e2e:占位/点亮/数值断言

## P6 主题
- [ ] token 体系(antd theme + CSS vars 双层)
- [ ] 应用双主题 + 终端 5 预设,持久化
- e2e:切换/持久化/终端独立断言

## P7 打包
- [ ] electron-builder:应用名/图标/userData=anchor
- [ ] npm run b 出 macOS 包,安装验证
