# 🚀 快速开始

<p align="center">
  <img src="https://img.shields.io/badge/version-1.5.0-blue" alt="Version">
</p>

---

## 📋 环境要求

### 🐳 Docker 方式（推荐用于生产）

| 要求 | 说明 |
|:-----|:-----|
| Docker | 20.10+ |
| Docker Compose | 最新版 |

### 🪟🐧🍎 Direct Launch 方式（无 Docker）

| 要求 | 说明 |
|:-----|:-----|
| Node.js | 18.17+ (20 LTS 推荐) |
| OpenCode CLI | `npm install -g opencode-ai`  (Windows/Linux)  ·  `brew install opencode` (macOS) |
| 操作系统 | Windows 10/11 · macOS 12+ · 任意主流 Linux 发行版 |

> 👉 想看完整的平台细节、launcher 脚本与故障排查，请阅读 [Direct Launch 指南](./direct-launch.md)。

---

## 🏁 快速开始

### 方式一：Docker 部署

| 步骤 | 命令 |
|:-----|:-----|
| 1. 克隆项目 | `git clone https://github.com/TiaraBasori/opencode2api.git` |
| 2. 进入目录 | `cd opencode2api` |
| 3. 复制配置 | `cp .env.example .env` |
| 4. 启动服务 | `docker compose up -d` |

### 方式二：Direct Launch（Windows / Linux / macOS，无 Docker）

```bat
:: Windows CMD / PowerShell
git clone https://github.com/TiaraBasori/opencode2api.git
cd opencode2api
copy .env.example .env
start.bat
```

```bash
# Linux / macOS terminal
git clone https://github.com/TiaraBasori/opencode2api.git
cd opencode2api
cp .env.example .env
chmod +x start.sh
./start.sh
```

或者用 npm，三平台完全一致：

```bash
git clone https://github.com/TiaraBasori/opencode2api.git
cd opencode2api
cp .env.example .env
npm install
npm start
```

`start.bat` / `start.sh` 会在首次运行时自动 `npm install` 并把 `.env.example` 复制为 `.env`。

> 详细参数、`.env` 字段说明、自定义路径请见 [Direct Launch 指南](./direct-launch.md)。

---

## ✅ 验证服务

```bash
# 健康检查
curl http://127.0.0.1:10000/health

# 获取模型列表
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:10000/v1/models
```

---

## 💡 快速测试

### Chat Completions API

```bash
curl -X POST http://127.0.0.1:10000/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "opencode/big-pickle",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": false
  }'
```

### Responses API (带推理)

```bash
curl -N -X POST http://127.0.0.1:10000/v1/responses \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt5-nano",
    "input": "Say hi in one sentence.",
    "reasoning": {"effort": "high"},
    "stream": true
  }'
```

---

## ➡️ 下一步

- ⚙️ 查看 [Configuration](./configuration.md) 了解更多配置选项
- 🐳 查看 [Docker Deployment](./docker.md) 了解 Docker 部署详情
