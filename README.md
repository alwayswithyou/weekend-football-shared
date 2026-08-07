# 周末约球台（真·共享版）

一个**零依赖**的 Node 小服务：前端页面 + 后端 API + JSON 文件存储。
打开同一个链接，群里所有人**实时**看到谁报了、票数多少，组织者一键出报表 PNG。

## 目录结构

```
weekend-football-shared/
├── server.js        # 后端（仅用 Node 内置模块，无需 npm install）
├── package.json
├── data.json        # 运行后自动生成，存放所有场次与报名（共享数据）
└── public/
    └── index.html   # 前端页面（全内联，零外链）
```

## 本地运行

```bash
cd weekend-football-shared
node server.js
# 打开 http://localhost:3000
```

## 免费部署到公网（让群里都能用）

> 单文件 HTML 的数据存在各自浏览器本地，无法群内共享；这个版本用一个小后端解决。
> 下面两家都有免费额度，注册后基本一键部署。

### 方式 A：Railway（推荐，最简单）

1. 打开 https://railway.app ，用 GitHub 登录。
2. 把本项目推到你的一个 GitHub 仓库（直接上传这 4 个文件即可）。
3. Railway 里 `New Project` → `Deploy from GitHub repo`，选中仓库。
4. Railway 会自动识别 `package.json` 的 `start` 脚本并运行；它会自动分配 `PORT` 环境变量。
5. 部署完成后点 `Generate Domain`，拿到一个 `xxx.up.railway.app` 链接，发到微信群即可。

### 方式 B：Render

1. 打开 https://render.com ，注册登录。
2. `New` → `Web Service`，关联你的 GitHub 仓库。
3. 设置：Build Command 留空（无需安装依赖），Start Command 填 `node server.js`；选择 Free 计划。
4. 部署完成后拿到 `xxx.onrender.com` 链接，发到微信群。

### 方式 C：你自己有服务器

把目录拷到服务器，`node server.js`（建议用 `pm2` 守护：`npm i -g pm2 && pm2 start server.js`），
再用 Nginx 反代 3000 端口，配个域名 + HTTPS 即可。

## 使用说明

- **报名**：选场次、填名字，提交后全群实时可见。
- **组织者模式**（右上角开关）：新增候选时段、确认/归档场次、删除报名、导出/导入/清空数据。
  > 说明：这是一个「信任型」小工具，组织者操作没有密码保护，适合熟人约球群。如需严格权限可后续加一层简单口令。
- **生成报表**：点「生成报表图」→ 直接下载 PNG 发群里；或「复制接龙文本」贴到群聊。

## 数据与安全

- 数据存在服务端的 `data.json`，所有人共享。
- 部署到公网后链接谁拿到都能访问，**不要放真实隐私**（本工具只存名字/昵称/可选手机号/备注）。
- 建议组织者定期「导出 JSON」备份。
- 想清掉示例数据：进入组织者模式 → 清空重置。
