# 🚀 MC Server Status API (Cloudflare Workers)

一个基于 **Cloudflare Workers** 构建的高性能 Minecraft 服务器状态查询 API，支持 Java / Bedrock 双版本，内置缓存与限流，适合直接部署上线或二次开发为商业化服务。

---

## ✨ Features

* ⚡ **全球边缘计算（Workers）**
* 🎮 支持 **Java / Bedrock** 服务器
* 🚀 **超低延迟查询**
* 🧠 内置 **智能缓存（Cache API + CDN）**
* 🔒 **基础限流保护**
* 📦 标准化 JSON API 输出
* 🌐 支持静态站点（Assets）

---

## 📦 项目结构

```
.
├── public/             # 静态资源（前端页面）
├── src/
│   └── worker.js       # Worker 主逻辑
├── wrangler.json       # Cloudflare 配置
└── README.md
```

---

## 🛠️ 部署方式

### 1️⃣ 安装 Wrangler

```bash
npm install -g wrangler
```

---

### 2️⃣ 登录 Cloudflare

```bash
wrangler login
```

---

### 3️⃣ 部署

```bash
wrangler deploy
```

---

## ⚙️ 配置说明

### `wrangler.json`

```json
{
  "name": "mc-server-status",
  "main": "src/worker.js",
  "compatibility_date": "2026-04-05",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },
  "vars": {
    "RATE_LIMIT_WINDOW_MS": "60000",
    "RATE_LIMIT_MAX_REQUESTS": "20"
  }
}
```

---

## 📡 API 使用

### Endpoint

```
GET /api/mc-status
```

---

### 参数

| 参数      | 必填 | 说明                 |
| ------- | -- | ------------------ |
| address | ✅  | 服务器地址（支持端口）        |
| edition | ❌  | `java` 或 `bedrock` |

---

### 示例请求

```bash
curl "https://your-domain/api/mc-status?address=mc.hypixel.net"
```

---

### 返回示例

```json
{
  "success": true,
  "data": {
    "input": "mc.hypixel.net",
    "edition": "java",
    "online": true,
    "host": "mc.hypixel.net",
    "port": 25565,
    "version": "1.20",
    "players": {
      "online": 12345,
      "max": 200000
    },
    "motd": ["Welcome to Hypixel"],
    "icon": "https://api.mcsrvstat.us/icon/mc.hypixel.net"
  },
  "cached": false,
  "ts": 1710000000000
}
```

---

## ⚡ 缓存机制

### 双层缓存：

#### 1. CDN缓存

```js
cf: {
  cacheTtl: 30
}
```

#### 2. Workers Cache API

```js
caches.default
```

---

### 缓存策略

| 类型   | 时间     |
| ---- | ------ |
| 免费用户 | 30 秒   |
| 可扩展  | 支持分级缓存 |

---

## 🚦 限流策略

默认配置：

* 时间窗口：60 秒
* 最大请求：20 次 / IP

可通过 `wrangler.json` 修改：

```json
"RATE_LIMIT_WINDOW_MS": "60000",
"RATE_LIMIT_MAX_REQUESTS": "20"
```

---

## 🔐 可扩展（商业化建议）

### 1. API Key 鉴权

```js
const apiKey = request.headers.get("x-api-key");
```

---

### 2. 分布式限流

推荐使用：

* Durable Objects（强一致）
* Cloudflare KV（简单）

---
### 3. 自定义域名

在 Cloudflare 控制台绑定：

```
api.yourdomain.com
```

---

## ⚠️ 注意事项

* ❌ Workers 不支持 TCP（不能直接 ping MC）
* ✅ 使用第三方 API（mcsrvstat）
* ⚠️ Map 限流仅适用于单实例（生产建议升级）

---

## 🧪 本地开发

```bash
wrangler dev
```

访问：

```
http://localhost:8787/api/mc-status?address=mc.hypixel.net
```

## 📈 性能说明

* 边缘节点执行（全球加速）
* 缓存命中可达 **<10ms 响应**
* 无服务器架构，自动扩展

---

## 📜 License

MIT License

---

## 🤝 贡献

欢迎提交 PR / Issue！

---

## 💡 Roadmap

* [ ] API Key 系统
* [ ] 用户后台 Dashboard
* [ ] 请求统计 / 计费
* [ ] WebSocket 实时状态
* [ ] 多数据源 fallback

---

## ⭐ Star 支持

如果这个项目对你有帮助，欢迎点个 ⭐！

---
