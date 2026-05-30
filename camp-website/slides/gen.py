#!/usr/bin/env python3
"""Generate standalone module slide decks for 少年CEO AI 创业营"""
import json

# Shared CSS and JS template
WRAPPER = '''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#0a0a14;color:#e8e8ed;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;overflow:hidden;height:100dvh;user-select:none}}
.slide-container{{width:100%;height:100dvh;position:relative}}
.slide{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;opacity:0;transition:opacity .4s ease}}
.slide.active{{opacity:1;z-index:1}}
.slide .tag{{color:rgba(240,180,41,.7);font-size:13px;letter-spacing:3px;margin-bottom:16px}}
.slide h1{{font-size:clamp(36px,7vw,80px);font-weight:800;letter-spacing:-2px;text-align:center;line-height:1.15;margin-bottom:24px}}
.slide h1 .amber{{color:#f0b429}}
.slide h2{{font-size:clamp(28px,5vw,56px);font-weight:700;text-align:center;line-height:1.2;margin-bottom:24px}}
.slide p{{font-size:20px;color:rgba(255,255,255,.4);text-align:center;max-width:700px;line-height:1.6;margin-bottom:12px}}
.slide .amber-text{{color:#f0b429}}
.story-card{{background:rgba(21,21,37,.8);border:1px solid rgba(255,255,255,.06);border-radius:24px;padding:40px;text-align:left;max-width:700px;margin:16px 0}}
.story-card .emoji{{font-size:32px;margin-bottom:12px}}
.story-card h3{{font-size:24px;margin-bottom:8px}}
.story-card p{{font-size:17px;text-align:left;color:rgba(255,255,255,.5);line-height:1.6}}
.formula{{background:rgba(240,180,41,.08);border:2px solid rgba(240,180,41,.3);border-radius:20px;padding:32px 48px;font-size:clamp(24px,4vw,42px);font-weight:700;text-align:center;letter-spacing:2px;margin:16px 0}}
.formula span{{color:#f0b429}}
.demo-box{{background:#151525;border:2px dashed rgba(255,255,255,.1);border-radius:16px;padding:24px 36px;font-size:18px;text-align:center;color:rgba(255,255,255,.6);font-family:monospace;max-width:600px;line-height:1.8;margin:16px 0}}
.letter-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1100px;margin:16px 0}}
.letter-card{{background:rgba(21,21,37,.8);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:24px;text-align:left;font-size:14px;color:rgba(255,255,255,.4);line-height:1.7;position:relative}}
.letter-card .grade{{position:absolute;top:-10px;right:16px;background:#555;color:#fff;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700}}
.letter-card .grade.great{{background:#f0b429;color:#0a0a14}}
.letter-card b{{color:rgba(255,255,255,.7)}}
.checklist{{list-style:none;max-width:500px;margin:16px 0}}
.checklist li{{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:18px;display:flex;align-items:center;gap:12px}}
.checklist li .dot{{width:8px;height:8px;background:#f0b429;border-radius:50%;flex-shrink:0}}
.steps{{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;max-width:900px;margin:16px 0}}
.step{{background:rgba(21,21,37,.8);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:24px;text-align:center;width:150px}}
.step .num{{font-size:36px;font-weight:900;color:#f0b429;margin-bottom:8px}}
.step .label{{font-size:14px;color:rgba(255,255,255,.5)}}
.iceberg{{max-width:500px;margin:24px auto}}
.iceberg .above{{font-size:18px;color:rgba(255,255,255,.6);text-align:center;padding:16px;border:1px solid rgba(255,255,255,.2);border-radius:12px 12px 0 0}}
.iceberg .below{{font-size:20px;color:#f0b429;font-weight:700;text-align:center;padding:24px;background:rgba(240,180,41,.06);border:1px solid rgba(240,180,41,.2);border-radius:0 0 12px 12px;margin-top:-1px}}
.iceberg .waterline{{text-align:center;font-size:12px;color:rgba(255,255,255,.2);padding:4px 0}}
.iceberg .waterline::before,.iceberg .waterline::after{{content:"═══════";margin:0 8px}}
.money-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:700px;margin:16px 0}}
.money-card{{background:rgba(21,21,37,.8);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:32px 24px;text-align:center}}
.money-card .price{{font-size:36px;font-weight:900;color:#f0b429;margin-bottom:8px}}
.money-card .desc{{font-size:14px;color:rgba(255,255,255,.4)}}
.nav{{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:10;background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.06);border-radius:40px;padding:8px 16px}}
.nav .page{{color:rgba(255,255,255,.3);font-size:13px;min-width:60px;text-align:center;line-height:28px}}
.nav button{{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;transition:all .2s}}
.nav button:hover{{border-color:#f0b429;color:#f0b429}}
.divider{{background:rgba(240,180,41,.05)}}
.divider h1{{font-size:clamp(42px,8vw,100px)}}
.suspense{{font-size:120px;margin-bottom:24px}}
.quote{{font-size:clamp(22px,4vw,36px);font-style:italic;color:rgba(255,255,255,.7);text-align:center;max-width:800px;line-height:1.5}}
.quote::before{{content:'"';color:#f0b429}}
.quote::after{{content:'"';color:#f0b429}}
.presenter-note{{display:none;position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(240,180,41,.15);border:1px solid rgba(240,180,41,.3);border-radius:12px;padding:12px 24px;font-size:14px;color:rgba(255,255,255,.6);max-width:600px;text-align:center;z-index:5}}
.presenter-note.show{{display:block}}
</style></head><body><div class="slide-container">
{slides}
</div>
<div class="nav"><button onclick="prev()">←</button><span class="page" id="pageNum">1 / {total}</span><button onclick="next()">→</button></div>
<script>let c=0;const s=document.querySelectorAll('.slide'),t=s.length;function show(i){{s.forEach(x=>x.classList.remove('active'));s[i].classList.add('active');document.getElementById('pageNum').textContent=(i+1)+' / '+t}}function next(){{c=(c+1)%t;show(c)}}function prev(){{c=(c-1+t)%t;show(c)}}document.addEventListener('keydown',e=>{{if(e.key==='ArrowRight'||e.key==='ArrowDown')next();if(e.key==='ArrowLeft'||e.key==='ArrowUp')prev()}})</script></body></html>'''

def tdivider(tag, h1):
    return f'<div class="slide active divider"><div class="tag">{tag}</div><h1>{h1}</h1></div>'

def module_file(filename, title, slides_html):
    total = slides_html.count('<div class="slide')
    html = WRAPPER.format(title=title, slides=slides_html, total=total)
    with open(f'/Users/wujames/WorkBuddy/2026-05-22-00-48-04/camp-website/slides/{filename}', 'w') as f:
        f.write(html)
    print(f'  {filename}: {total} slides')

# ====== MODULE 1: 创业是什么 ======
slides = tdivider('模块 1 · 45分钟', '原来这样<br>就能赚钱？')
slides += '''
<div class="slide"><div class="story-card"><div class="emoji">🎒</div><h3>11岁 · 水杯提醒器</h3>
<p>他发现：全班每天5个人忘带水杯<br>渴了一上午，只能等午饭才喝到水</p>
<p style="margin-top:12px">他做了：书包上缝个小口袋<br>里面一张纸条 → <span class="amber-text" style="font-size:18px">"水杯！"</span></p>
<p style="margin-top:12px">他卖了：12个人 × ¥5 = <span class="amber-text" style="font-size:22px">¥60</span></p></div></div>
<div class="slide"><div class="story-card"><div class="emoji">📱</div><h3>14岁 · 作业提醒闹钟</h3>
<p>她发现：班里总有人忘写作业被扣分</p>
<p style="margin-top:12px">她做了：用 AI 做了个小程序<br>每天放学自动弹提醒"今晚有数学作业"</p>
<p style="margin-top:12px">她赚了：500人下载<br>奶茶店广告 → <span class="amber-text" style="font-size:22px">¥200/月</span></p></div></div>
<div class="slide"><h1>他们有什么<br>共同点？</h1><p style="margin-top:24px;font-size:24px">讨论 1 分钟</p></div>
<div class="slide"><div class="formula">创业 = <span>发现痛点</span> + <span>做出方案</span> + <span>让人付钱</span></div><p style="margin-top:24px;font-size:16px">痛点越小越具体 → 越容易做出产品<br>你的第一个客户 → 在你身边5米以内</p></div>
<div class="slide divider"><div class="tag">备选</div><h1 style="font-size:clamp(28px,4vw,48px)">如果前面没共鸣<br>换下面的</h1></div>
<div class="slide"><div class="story-card"><div class="emoji">🍱</div><h3>食堂今天有什么？</h3><p>痛点：每天午饭前不知道食堂有什么<br>排队到窗口才发现不想吃</p><p style="margin-top:8px">赚了：卖"周菜单订阅" <span class="amber-text">¥2/周 × 20人</span></p></div></div>
<div class="slide"><div class="story-card"><div class="emoji">🗺️</div><h3>教室在哪？</h3><p>痛点：新学期第一周，拿着课表找不到教室，天天迟到</p><p style="margin-top:8px">赚了：校园地图 <span class="amber-text">¥1/张 × 50张</span></p></div></div>
<div class="slide"><div class="story-card"><div class="emoji">📚</div><h3>明天带什么书？</h3><p>痛点：书包塞满，明天要用的没带。到底有什么课？交什么作业？</p><p style="margin-top:8px">赚了：小程序 → 广告 <span class="amber-text">¥100/月</span></p></div></div>
'''
module_file('module1.html', '模块1 · 创业是什么', slides)

# ====== MODULE 2: AI是骗子？ ======
slides = tdivider('模块 2 · 45分钟', 'AI是骗子？')
slides += '''
<div class="slide"><p style="font-size:24px">现在，所有人打开 WorkBuddy</p><p style="font-size:32px;margin-top:8px">输入下面这句话</p><div class="demo-box" style="margin-top:24px;font-size:22px">李白写过一首诗叫《望庐山》，<br>请全文背诵。</div></div>
<div class="slide"><div class="suspense">❓</div><h1>这首诗<br>是真的吗？</h1><p style="margin-top:24px">举手——觉得真的？ 觉得假的？</p></div>
<div class="slide"><div class="suspense">🚨</div><h1>假的</h1><p style="font-size:24px;margin-top:16px">李白没有写过《望庐山》</p><p style="margin-top:8px">AI 编了一首看起来很像真的的诗</p><p style="margin-top:24px;color:rgba(255,255,255,.3);font-size:16px">AI 不是故意骗你。它自己在猜——<br>猜你接下来想看到什么。</p></div>
<div class="slide"><div class="formula" style="font-size:28px"><span>CEO 守则第一条</span><br>AI 给你的答案<br>先怀疑，再验证</div></div>
'''
module_file('module2.html', '模块2 · AI是骗子？', slides)

# ====== MODULE 2.5: AI超能力 ======
slides = tdivider('模块 2.5 · 15分钟', 'AI 的 6 个<br>马上能用的<br>超能力')
slides += '''
<div class="slide"><h2 style="margin-bottom:8px">1. 做网页 &nbsp; 2. 改东西</h2><div class="demo-box" style="font-size:18px;font-family:inherit;max-width:580px;text-align:left;line-height:2.2"><p><span class="amber-text">1.</span> "帮我做一个网页。_____"</p><p><span class="amber-text">2.</span> "把_____改成_____。"</p></div><p style="font-size:16px;margin-top:16px">这两句今天下午就能用上</p></div>
<div class="slide"><h2 style="margin-bottom:8px">3. 说人话 &nbsp; 4. 别啰嗦</h2><div class="demo-box" style="font-size:18px;font-family:inherit;max-width:580px;text-align:left;line-height:2.2"><p><span class="amber-text">3.</span> "用___岁小孩能听懂的话解释。"</p><p><span class="amber-text">4.</span> "控制在___字以内。"</p></div></div>
<div class="slide"><h2 style="margin-bottom:8px">5. 指哪错了 &nbsp; 6. 先验再信</h2><div class="demo-box" style="font-size:18px;font-family:inherit;max-width:580px;text-align:left;line-height:2.2"><p><span class="amber-text">5.</span> "第___部分不对，改成：___"</p><p><span class="amber-text">6.</span> AI说完 → 自己查 → 再决定信不信</p></div><p style="font-size:16px;margin-top:16px;color:rgba(255,255,255,.6)">💡 不会打字？点麦克风，说出来就行</p></div>
'''
module_file('module2-5.html', '模块2.5 · AI超能力卡', slides)

# ====== MODULE 3: 怎么找到真需求 ======
slides = tdivider('模块 3 · 45分钟', '怎么知道别人<br>真的想要？')
slides += '''
<div class="slide"><h2 style="font-size:22px;margin-bottom:8px">妈妈打电话："我孩子要补英语"</h2><div class="iceberg"><div class="above">"补习英语"</div><div class="waterline">═══════ 水面 ═══════</div><div class="below">"下次考试及格<br>不要再被班主任约谈"</div></div><p style="margin-top:16px;font-size:16px">你以为的需求 ≠ 真实的需求</p></div>
<div class="slide"><h2>三个追问法</h2><ul class="checklist" style="margin-top:24px"><li><span class="dot"></span>① 你遇到过吗？<span style="color:rgba(255,255,255,.2);margin-left:auto">→ 真不真实</span></li><li><span class="dot"></span>② 多久一次？<span style="color:rgba(255,255,255,.2);margin-left:auto">→ 值不值得</span></li><li><span class="dot"></span>③ 你试过怎么解决？<span style="color:rgba(255,255,255,.2);margin-left:auto">→ 有没有机会</span></li></ul><p style="margin-top:24px">三个全绿灯 = 真需求<br>任意红灯 = 再想想</p></div>
<div class="slide"><h2>现在就去问真人</h2><p style="font-size:24px;margin-top:16px">每个组领 3 张用户采访卡</p><div class="demo-box" style="font-size:16px;font-family:inherit;margin-top:24px;line-height:2.2"><p>Q1. 你遇到过这个麻烦吗？</p><p>Q2. 你最在乎什么？便宜/好用/省时间？</p><p>Q3. 愿意付多少钱？</p></div><p style="margin-top:24px;font-size:16px">只能问，不能说服<br>对方说"不需要"→ 谢谢ta，不要解释</p></div>
'''
module_file('module3.html', '模块3 · 怎么找到真需求', slides)

# ====== MODULE 4: 怎么跟AI说话 ======
slides = tdivider('模块 4 · 45分钟', '同一句话<br>AI 反应差十倍')
slides += '''
<div class="slide"><h2 style="margin-bottom:16px">让 AI 写一封道歉信</h2><div class="letter-grid"><div class="letter-card"><div class="grade">差</div><p style="margin-bottom:8px;font-size:12px;color:rgba(255,255,255,.2)">"帮我写一封道歉信"</p><p>尊敬的[收信人]：我写这封信是为了表达我最诚挚的歉意。对于我的行为给您带来的不便，我深感抱歉...</p></div><div class="letter-card"><div class="grade" style="background:#888">中</div><p style="margin-bottom:8px;font-size:12px;color:rgba(255,255,255,.2)">"我是一个学生，写给老师的"</p><p>亲爱的老师：我想为我在课堂上的行为向您道歉。我保证以后会认真听讲...</p></div><div class="letter-card"><div class="grade great">好</div><p style="margin-bottom:8px;font-size:12px;color:rgba(255,255,255,.2)">"我是五年级的小明。上课讲话被王老师批评了。王老师嗓子都哑了还在讲课。用小孩的话写，200字以内"</p><p>王老师：我今天上课讲话，对不起。<b>您嗓子都哑了还在给我们讲课，我却跟同桌聊昨晚的游戏</b>。我保证明天开始...</p></div></div><p style="margin-top:16px;font-size:16px">不是 AI 笨——是你没说清楚</p></div>
<div class="slide"><h2>跟 AI 说话，填这 5 句</h2><div class="demo-box" style="text-align:left;font-size:18px;font-family:inherit;max-width:520px;line-height:2.4"><p>1. 你是什么？<span style="color:#f0b429;margin-left:12px">你是一个______</span></p><p>2. 帮谁？<span style="color:#f0b429;margin-left:12px">我要帮______</span></p><p>3. 做什么？<span style="color:#f0b429;margin-left:12px">做一个______</span></p><p>4. 怎么做？<span style="color:#f0b429;margin-left:12px">打开后______</span></p><p>5. 别做什么？<span style="color:#f0b429;margin-left:12px">不要______</span></p></div><p style="margin-top:16px;font-size:16px">现在用这张卡，给你的项目写第 1 个 prompt</p></div>
'''
module_file('module4.html', '模块4 · 怎么跟AI说话', slides)

# ====== MODULE 5: 只做一个功能 ======
slides = tdivider('模块 5 · 30分钟', '做什么？')
slides += '''
<div class="slide"><div style="font-size:clamp(32px,6vw,56px);line-height:1.3;text-align:center"><p style="color:rgba(255,255,255,.5);margin-bottom:16px">把你们想做的功能都列出来</p><p>→</p><p style="margin-top:16px"><span class="amber-text">如果只剩 2 小时<br>只能做 1 个功能</span></p><p style="margin-top:16px;color:rgba(255,255,255,.5)">你保留哪个？</p></div></div>
<div class="slide"><h2>MVP = 能让人30秒看懂<br>你在干嘛的最小版本</h2><div class="demo-box" style="font-family:inherit;font-size:16px;text-align:left;margin-top:24px;line-height:2"><p style="color:#f0b429">例：宠物医生</p><p>完整版：连医院数据库 + 预约挂号 + 看评价 + 在线问诊</p><p style="color:#f0b429">MVP版：</p><p>一个网页，输入"猫吐了"</p><p>→ 告诉我：绿色·在家观察 / 红色·去医院</p></div><p style="margin-top:16px;font-size:16px">今天只做 MVP。多了做不完。</p></div>
'''
module_file('module5.html', '模块5 · 只做一个功能', slides)

# ====== MODULE 6: 定多少钱 ======
slides = tdivider('模块 6 · 30分钟', '定多少钱？')
slides += '''
<div class="slide"><h2 style="margin-bottom:24px">三种赚钱方式</h2><div class="money-grid"><div class="money-card"><div class="price">¥3/次</div><div class="desc">按次收费<br>偶尔用的产品</div></div><div class="money-card"><div class="price">¥10/月</div><div class="desc">包月订阅<br>天天用的产品</div></div><div class="money-card"><div class="price">免费+广告</div><div class="desc">用户量大<br>广告主买单</div></div></div></div>
<div class="slide"><h2>拍脑袋：先写一个价</h2><p style="font-size:24px;margin-top:16px">然后去问隔壁组——</p><div class="demo-box" style="font-size:20px;font-family:inherit;margin-top:16px">"如果你是用户<br>这个价你愿意付吗？为什么？"</div><p style="margin-top:16px;font-size:16px;color:rgba(255,255,255,.4)">低龄辅助："这个价能买几包辣条？几个笔？"</p></div>
<div class="slide"><h2>算一笔账</h2><div class="formula" style="margin-top:24px;font-size:clamp(20px,3vw,32px)">100 个用户 × 每人 <span>¥__</span> / 月<br>= 一个月赚 <span>¥__</span></div><p style="margin-top:32px;font-size:20px">定价不是数学题，是共情题<br>你越懂用户，越知道ta愿意为什么付钱</p></div>
'''
module_file('module6.html', '模块6 · 定多少钱', slides)

# ====== MODULE 7: 怎么讲好故事 ======
slides = tdivider('模块 7 · 30分钟', '怎么让人听完<br>想投钱？')
slides += '''
<div class="slide"><h2 style="margin-bottom:32px">路演五步</h2><div class="steps"><div class="step"><div class="num">①</div><div class="label">"你见过<br>这种情况吗？"</div></div><div class="step"><div class="num">②</div><div class="label">"我们做了<br>一个东西"</div></div><div class="step"><div class="num">③</div><div class="label">"看，就是它"<br>演示</div></div><div class="step"><div class="num">④</div><div class="label">"它会赚钱"<br>算账</div></div><div class="step"><div class="num">⑤</div><div class="label">"投我们"<br>行动</div></div></div></div>
<div class="slide"><div class="quote" style="margin-bottom:32px">最好的路演<br>不是介绍产品<br>是让人心里想</div><h1><span class="amber">"对对对<br>我也遇到过"</span></h1></div>
<div class="slide"><h2>先裸讲 1 分钟</h2><p style="font-size:24px;margin-top:16px">什么都不准备，直接讲</p><p style="margin-top:24px;color:rgba(255,255,255,.3)">（大概率语无伦次）</p><p style="margin-top:32px;font-size:20px">→ 然后看老师示范同一产品<br>→ 自己找出差别<br>→ 用五步结构再来一遍</p></div>
'''
module_file('module7.html', '模块7 · 怎么讲好故事', slides)

print("\nDone! 7 module decks generated.")
