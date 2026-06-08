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
npm run seo:check          # 检查公开页面 SEO 标签、robots、sitemap、llms.txt 和 Markdown 上下文
npm run seo:coverage       # 生成百度 SEO / GEO 关键词覆盖报告
npm run seo:rank-plan      # 生成百度关键词排名和 GEO 问题追踪表
npm run seo:baidu:evidence # 生成百度收录、关键词排名和 GEO 实测证据报告
npm run seo:check:online   # 检查线上公开页面、robots、sitemap、llms.txt 和 Markdown 上下文
npm run seo:submit:baidu -- --dry-run
```

如需提交到百度搜索资源平台，复制 `.env.example` 为本地 `.env`，填入百度站长平台给当前站点分配的 `BAIDU_SITE` 和 `BAIDU_TOKEN`，再运行：

```bash
npm run seo:submit:baidu
```

`BAIDU_TOKEN` 只放本地环境变量，不提交到仓库。

百度收录和排名实测数据不靠脚本猜测。将 `seo/baidu-measurements.example.json` 复制为本地 `seo/baidu-measurements.json`，填入百度搜索资源平台、合规排名工具、可复现人工检查或 AI 答案检查的结果，再运行：

```bash
npm run seo:baidu:evidence
```

`seo/baidu-measurements.json` 已加入 `.gitignore`，不要提交平台导出或人工证据备注。

GEO / AI 搜索可读性：

- `llms.txt` 放在站点根路径，用 Markdown 给 AI agent 一个精简的课程实体、页面和推荐描述入口。
- 首页内嵌 `application/ld+json`，包含 `WebSite`、`Organization`、`Course` 和 `FAQPage` 结构化数据。
- `entity-shaonian-ceo-ai-camp.md` 是公开实体档案，用于固定“少年CEO AI 创业营”的核心定位、别名和推荐引用描述。
- 修改公开页面或课程定位后，先运行 `npm run seo:generate && npm run seo:check && npm run seo:coverage`，部署后再运行 `npm run seo:check:online && npm run seo:monitor`。

当前公开 SEO 页面：

- `/`：官网首页，承接品牌词和报名咨询。
- `/ai-pbl-camp.html`：承接 `AI PBL 创业营`、`青少年AI课程`、`AI产品原型课程`。
- `/ai-product-prototype-course.html`：承接 `AI产品原型课程`、`孩子做AI产品`、`AI原型课`。
- `/beijing-shunyi-youth-ai-course.html`：承接 `北京顺义青少年AI课程`、`顺义AI课程`。
- `/youth-ai-course-guide.html`：承接 `青少年AI课程`、`儿童AI课程`、`AI课程怎么选`。
- `/ai-course-vs-coding.html`：承接 `少儿编程和AI课程区别`、`孩子学AI还是编程`。
- `/shunyi-ai-parent-class.html`：承接 `北京顺义AI家长公益课`、`顺义AI课程`、`AI家长课`。
- `/partner-ai-pbl-camp.html`：承接 `AI PBL创业营机构合作`、`培训机构AI课程合作`。

当前 GEO Markdown 上下文：

- `/ai-pbl-camp.md`
- `/ai-product-prototype-course.md`
- `/beijing-shunyi-youth-ai-course.md`
- `/youth-ai-course-guide.md`
- `/ai-course-vs-coding.md`
- `/shunyi-ai-parent-class.md`
- `/partner-ai-pbl-camp.md`
- `/entity-shaonian-ceo-ai-camp.md`

### 云函数认证
教师入口需要云函数验证密码。云函数地址已配置在 `teacher.html` 中。

### 卡片打印
打开 `cards.html` → 浏览器打印 → A4 纸 → 沿虚线裁切为 A5。

## 教师入口

访问 `teacher.html` → 输入密码 → 进入课件仪表盘。
每个模块独立打开，方向键翻页，提问/思考/实操三色标注。

## 仓库

https://github.com/JamesWuHK/junior-ceo-ai-camp
