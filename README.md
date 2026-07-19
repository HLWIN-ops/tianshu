# 天枢

隐私优先、依据可追溯，把传统命理转译成当下看得懂、做得到、能自己判断的个人报告。

## 部署到 Cloudflare Pages 免费版

本项目是纯静态 HTML/CSS/JavaScript，不需要后端、数据库或常驻端口。

- Production branch：`master`
- Framework preset：`None`
- Build command：留空
- Build output directory：`.`
- Root directory：仓库根目录

`_headers` 提供 CSP、Referrer Policy、Permissions Policy 等安全响应头。部署后应在浏览器 Network 面板确认这些头实际生效。

Cloudflare Web Analytics 可在 Pages 控制台按需开启；当前代码没有内置统计脚本，也不会虚构“已启用”。启用前请同步更新隐私说明，并确保事件不包含出生资料、命盘结果或行动自由文本。

## 本地测试

直接使用（不需要启动端口）：

1. 在文件管理器中双击 `index.html`，或把它拖进浏览器。
2. 排盘、报告、档案与本地试做记录都能在 `file:///` 下工作。
3. 脱敏文字复制和海报保存可离线使用；公网链接和二维码只有部署到 Cloudflare Pages 后才有意义。

本地开发测试：

```bash
npm ci
npx playwright install chromium
npm test
```

`npm run test:file` 是不占端口的 `file://` 闭环测试；`npm run test:e2e` 只在测试进程内绑定随机临时端口，结束（成功或失败）后自动关闭。它不是线上服务；Cloudflare Pages 部署仍然不运行 Node 进程。

测试覆盖：

- 56 项算法回归
- 人物库与产品层冒烟
- 桌面、320px、360px、390px 真实浏览器链路
- 非法输入、原子导入、档案/7 天试做恢复
- T+0/T+8/T+32 到期复盘、结论、下一轮与历史时间轴
- 分享脱敏预览与二维码解码
- 键盘标签、弹层焦点、CSP、水平溢出
- 可选脚本降级与核心脚本故障恢复

## 二维码依赖

分享海报的二维码在浏览器本地生成。更新依赖后运行：

```bash
npm run build:vendor
```

生成的 `js/qr-vendor.js` 必须提交；Cloudflare 部署时不需要再构建。第三方许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 数据边界

- 完成排盘不需要上传出生资料。
- 保存档案或 7 天试做时，资料会以明文写入当前浏览器。
- 默认分享隐藏姓名、生日、时刻、地点与完整四柱。
- 方法、精度与历史时区限制见 [methodology.html](methodology.html)。
- 本地存储、导出与删除规则见 [privacy.html](privacy.html)。

完整产品路线图与验收标准位于 [docs/EXPLOSIVE_PRODUCT_PLAN.md](docs/EXPLOSIVE_PRODUCT_PLAN.md)。
