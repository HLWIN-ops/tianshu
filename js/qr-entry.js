import QRCode from 'qrcode';

// 构建时打包为同源静态脚本；运行时不请求第三方服务，也不发送二维码内容。
globalThis.TianshuQR = QRCode;
