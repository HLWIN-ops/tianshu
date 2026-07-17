# Third-party notices

天枢的运行时代码包含以下本地打包依赖：

- `qrcode` 1.5.4 — MIT License — <https://github.com/soldair/node-qrcode>

二维码库被打包到 `js/qr-vendor.js`，只在浏览器本地把当前站点地址编码为二维码，不会向第三方服务发送 URL 或命盘数据。

开发与测试依赖 `esbuild`、`Playwright` 和 `jsQR` 不会作为远程脚本注入生产页面；其许可信息可在对应 npm 包中查阅。
