# GlobalCloud XiaoC 官网

本目录是 `always200.com` 对应的独立官网工程。

它与产品站、文档站彻底分离：

- `always200.com`：官网（当前目录）
- `docs.always200.com`：文档站（`mkdocs/`）
- `prompt.always200.com`：产品站（根项目）

## 目录职责

- 技术栈：独立 Vite 静态站
- 部署目标：独立 Vercel 项目
- Vercel Root Directory：`site/`
- 官网不复用根项目的业务代码、UI 组件和构建链路
- 官网保留自己的 `package.json`、`pnpm-lock.yaml`、`vercel.json`

## 本地运行

在 `site/` 目录内执行：

```bash
pnpm install
pnpm dev
```

启动后访问终端输出的地址，默认通常是：

- `http://127.0.0.1:5173/`

如果端口被占用，Vite 会自动切换到其他端口。

## 语言切换

- 默认支持中文与英文两种官网文案
- 首次访问会根据浏览器语言自动选择中文或英文
- 用户手动切换语言后，会记住选择，后续访问优先使用上次手动选择
- 当前官网采用单页静态渲染，不额外引入前端 i18n 框架

## 本地构建与静态预览

```bash
pnpm build
python -m http.server 8011 -d dist
```

访问：

- `http://127.0.0.1:8011/`

## 路由说明

- `/`：官网首页
- `/docs`：跳转到 `https://docs.always200.com/`
- `/docs/:path*`：跳转到 `https://docs.always200.com/:path*`

## 部署

- 独立 Vercel 项目
- Root Directory：`site/`
- 正式域名：`always200.com`
- `www.always200.com` 建议在 Vercel Dashboard 中跳转到 `always200.com`
