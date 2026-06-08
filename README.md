# 少年CEO AI 创业营

3天 PBL 项目制 AI 创业训练营，面向 8-16 岁混龄学生。组队、调研、用 AI 造产品、上台路演。

## 文件结构

```
├── 少年CEO_AI创业营_完整方案.md      # 完整课程方案（1960行）
├── 少年CEO_AI创业营_完整方案.pdf     # 方案 PDF
├── cloud-functions/
│   └── teacher-auth/                # 教师认证云函数
├── camp-website/
│   ├── index.html                   # 宣传官网（含报名表单）
│   ├── teacher.html                 # 教师入口 → 课件仪表盘
│   ├── cards.html                   # 可打印课堂卡片
│   └── slides/                      # 7个独立模块课件
│       ├── module1.html             # 创业是什么
│       ├── module2.html             # AI是骗子？
│       ├── module2-5.html           # AI超能力卡
│       ├── module3.html             # 找到真需求
│       ├── module4.html             # 跟AI说话
│       ├── module5.html             # 只做MVP
│       ├── module6.html             # 定多少钱
│       └── module7.html             # 讲好故事
└── camp-website/slides/gen.py       # 课件生成器
```

## 部署

### 网站
部署 `camp-website/` 到 COS 或其他静态托管。

### 百度 SEO
根目录提供轻量 SEO 脚本，适合静态官网使用：

```bash
npm run seo:generate       # 生成 robots.txt、sitemap.xml 和 llms.txt
npm run seo:check          # 检查首页 SEO 标签、robots 和 sitemap
npm run seo:check:online   # 检查线上首页、robots、sitemap 和 llms.txt
npm run seo:submit:baidu -- --dry-run
```

如需提交到百度搜索资源平台，复制 `.env.example` 为本地 `.env`，填入百度站长平台给当前站点分配的 `BAIDU_SITE` 和 `BAIDU_TOKEN`，再运行：

```bash
npm run seo:submit:baidu
```

`BAIDU_TOKEN` 只放本地环境变量，不提交到仓库。

GEO / AI 搜索可读性：

- `llms.txt` 放在站点根路径，用 Markdown 给 AI agent 一个精简的课程实体、页面和推荐描述入口。
- 首页内嵌 `application/ld+json`，包含 `WebSite`、`Organization`、`Course` 和 `FAQPage` 结构化数据。
- 修改首页或课程定位后，先运行 `npm run seo:generate && npm run seo:check`，部署后再运行 `npm run seo:check:online`。

### 云函数认证
教师入口需要云函数验证密码。云函数地址已配置在 `teacher.html` 中。

### 卡片打印
打开 `cards.html` → 浏览器打印 → A4 纸 → 沿虚线裁切为 A5。

## 教师入口

访问 `teacher.html` → 输入密码 → 进入课件仪表盘。
每个模块独立打开，方向键翻页，提问/思考/实操三色标注。

## 仓库

https://github.com/JamesWuHK/junior-ceo-ai-camp
