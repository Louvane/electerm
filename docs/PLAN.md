# ANCHOR 实施计划

对应 SPEC.md。每阶段完成即提交;UI 逻辑走 TDD(先写 e2e 断言)。

## P0 骨架(本阶段)
- [x] 克隆 electerm → anchor,包名改 anchor
- [x] docs/SPEC.md、PLAN.md
- [ ] 新 `layout/` 组件:ANCHOR 布局壳(遥测栏占位/标签栏/内容区),替换 electerm Layout
- [ ] dev 启动冒烟:electron 窗口显示新壳,store/worker 桥接正常(读一条配置)

## P1 数据层
- [x] bookmark/group CRUD 封装(anchor-api.js,自包含数组操作,manate 原生追踪)
- [x] 历史记录(history)读写(getRecents/clearRecents)
- [x] 单测 14 项全过(node --test src/test/unit-ci/anchor-api.spec.js)
- [ ] 认证门保留,样式套 ANCHOR token

## P2 连接管理器
- [x] 树组件(分组实体 + 主机,搜索高亮/键盘导航/右键菜单/内联编辑)
- [x] 表单抽屉(四段/下拉分组/跳板链引用列表/编辑预填)
- [x] 删除撤销 toast、非空删除确认框(antd Modal.confirm)
- [x] e2e 9 项全过(e2e/p2-manager.spec.js,_electron 驱动真 app)

## P3 快速连接页
- [x] 历史列表(getRecents)+ 双击连接 + 清空 + 空状态引导
- [x] 活跃会话状态点(host+username 反查,history 副本无 srcId)
- [x] e2e 11 项全过(e2e/p3-quick.spec.js)

## P4 终端标签
- [x] 复用 electerm SessionsWrap/Session/Term 全链路(TermView 量测尺寸)
- [x] 视图切换:主页 ↔ 终端(+/标签点击/连接回调)
- [x] 真实 SSH 服务器连通验证(首连需在终端应答 trust 信任指纹)
- [x] e2e 4/4(e2e/p4-real.local.js,凭据走环境变量不入库)

## P5 监控栏
- [ ] exec-cmd 轮询 /proc + 环形缓冲 + SVG 曲线(移植 demo 逻辑)
- [ ] 仅 ssh 标签显示、折叠/关闭
- e2e:占位/点亮/数值断言

## P6 主题
- [x] token 体系(anchor-theme.js 注入 documentElement,antd 浮层 CSS 覆盖)
- [x] 应用双主题(暗默认/亮),切换按钮 + localStorage 持久化 + 跟随系统
- [x] 终端配色走 electerm 内置终端主题系统(设置面板可换,不重复造)
- [x] e2e 7/7(切换/变量注入/持久化/light 下终端渲染/浮层随主题)

## P7 打包
- [ ] electron-builder:应用名/图标/userData=anchor
- [ ] npm run b 出 macOS 包,安装验证
