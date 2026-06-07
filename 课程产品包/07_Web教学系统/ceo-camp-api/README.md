# 少年CEO AI 创业营后端 API

这是课堂 Web 系统的第一版轻量后端，部署目标是 `49.233.1.9` 北京轻量服务器。

## 当前部署

- 服务器目录：`/opt/ceo-camp-api`
- 容器名：`ceo-camp-api`
- 容器内部端口：`7001`
- Docker 网络：`wanli-edu-market_default`
- nginx 入口：`https://api.camps.wanli.wiki`
- 当前状态：DNS、HTTP 跳 HTTPS、HTTPS 证书和后端反代均已配置。

静态资源、课件、图片和作品展示素材不放在这台服务器上，后续应放 COS + CDN。后端只保存结构化数据、文件 object key、审核状态和课堂实时状态。

## 照片上传

`POST /future-photo/upload-token` 会根据环境返回三种上传目标：

- `cos`：正式生产推荐方式，学生照片直接上传到 COS 私有 Bucket，后端只保存 object key。
- `local`：本地开发/测试方式，设置 `LOCAL_UPLOAD_ENABLED=true` 后，照片会通过 `PUT /uploads/local?key=...` 保存到 `LOCAL_UPLOAD_DIR`。
- `mock`：未配置 COS 且未启用本地上传时，只返回 object key，适合无文件流的流程演示。

生产环境默认 `LOCAL_UPLOAD_ENABLED=false`。儿童原始照片不建议长期保存在轻量服务器磁盘上，应使用 COS 私有桶和服务端签名上传。

## 数据

数据库文件：

```text
/opt/ceo-camp-api/data/camp.db
```

第一版使用 `sql.js` 读写 SQLite 文件。它避免了 `better-sqlite3` 在轻量服务器上拉取预编译包失败、回退编译工具链过重的问题。当前营期 30 人级别的数据量很小，这个方案足够支撑 MVP；如果以后多城市、多营期并发，应迁移到 PostgreSQL 或腾讯云数据库。

每日备份：

```text
/etc/cron.d/ceo-camp-api-backup
/opt/ceo-camp-api/backups
```

## 主要接口

- `GET /health`
- `POST /auth/teacher/login`
- `GET /camp/current`
- `GET /course/modules`
- `GET /students`
- `POST /students`
- `GET /teams`
- `POST /teams`
- `POST /future-photo/upload-token`
- `POST /future-photo/submissions`
- `POST /future-photo/:id/generate`
- `POST /future-photo/:id/review`
- `GET /wall/future-photo`
- `GET /events`
- `POST /tasks/current`
- `GET /submissions`
- `POST /publish/showcase`

教师写接口需要 `Authorization: Bearer <TEACHER_TOKEN>`。

## 本地开发

```bash
npm install
npm run check
npm run build
DATABASE_PATH=./data/test-camp.db TEACHER_PASSWORD=test TEACHER_TOKEN=test-token PORT=7011 npm start
```

本地真实保存照片测试：

```bash
DATABASE_PATH=/tmp/ceo-camp-dev/camp.db \
LOCAL_UPLOAD_ENABLED=true \
LOCAL_UPLOAD_DIR=/tmp/ceo-camp-dev/uploads \
PUBLIC_API_BASE=http://localhost:7001 \
TEACHER_PASSWORD=test \
TEACHER_TOKEN=test-token \
PORT=7001 \
npm run dev
```

## DNS 与 HTTPS

已在 DNSPod 添加：

```text
api.camps.wanli.wiki A 49.233.1.9
```

已使用 Let’s Encrypt 签发证书：

```text
/opt/wanli-edu-market/letsencrypt/live/api.camps.wanli.wiki/
```

证书续期 cron：

```text
/etc/cron.d/wanli-certbot-renew
```

HTTP 会跳转到 HTTPS；HTTPS 请求由现有 `wanli-edu-market` nginx 容器反代到 `ceo-camp-api:7001`。
