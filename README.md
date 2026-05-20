# Energy Zero

TRON 单页转账应用，使用 TronLink 登录，通过 SunSwap UniversalRouter 的
`execute(bytes,bytes[],uint256)` 发送 Permit2 batch transfer。

## 本地运行

```bash
npm run dev
```

打开 `http://localhost:5173`。

## Vercel 部署

项目是纯静态单页应用，已提供 `vercel.json`。在 Vercel 导入仓库后使用默认配置即可：

- Build Command: `npm run build`
- Output Directory: `dist`

## 授权路径

这条 SunSwap 路径有两层授权：

1. TRC20 `approve(Permit2, amount)`。
2. Permit2 `approve(token, UniversalRouter, amount, expiration)`。

页面会自动检测并在主按钮上切换状态：未授权时提示授权指定金额，已授权后直接广播。
授权提示区会提供 Permit2 和 UniversalRouter 的 Tronscan 地址链接。

## 校验交易编码

```bash
npm run check
```

该脚本会复现需求里给出的交易 calldata，确保 UniversalRouter + Permit2 的编码一致。
