#!/usr/bin/env python3
"""V2: Rich visual slides with embedded demo content — no need to switch to WorkBuddy"""

CSS = '''
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#e8e8ed;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;overflow:hidden;height:100dvh;user-select:none}
.slide-container{width:100%;height:100dvh;position:relative}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;opacity:0;transition:opacity .5s ease}
.slide.active{opacity:1;z-index:1}
.tag{color:rgba(240,180,41,.7);font-size:13px;letter-spacing:3px;margin-bottom:16px}
h1{font-size:clamp(36px,7vw,80px);font-weight:800;letter-spacing:-2px;text-align:center;line-height:1.15;margin-bottom:24px}
h1 .amber{color:#f0b429}
h2{font-size:clamp(26px,5vw,52px);font-weight:700;text-align:center;line-height:1.2;margin-bottom:20px}
p{font-size:19px;color:rgba(255,255,255,.4);text-align:center;max-width:700px;line-height:1.6;margin-bottom:10px}
.amber-text{color:#f0b429}
.divider{background:rgba(240,180,41,.05)}
.divider h1{font-size:clamp(42px,8vw,100px)}

/* Cards */
.story-card{background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:36px 40px;text-align:left;max-width:700px}
.story-card .emoji{font-size:36px;margin-bottom:10px}
.story-card h3{font-size:22px;margin-bottom:8px}
.story-card p{font-size:17px;text-align:left;color:rgba(255,255,255,.5);line-height:1.6}

/* Formula */
.formula{background:rgba(240,180,41,.08);border:2px solid rgba(240,180,41,.3);border-radius:20px;padding:32px 48px;font-size:clamp(22px,4vw,38px);font-weight:700;text-align:center;letter-spacing:2px}
.formula span{color:#f0b429}

/* Demo box */
.demo-box{background:#151525;border:2px dashed rgba(255,255,255,.1);border-radius:16px;padding:24px 36px;font-size:18px;text-align:center;color:rgba(255,255,255,.6);max-width:600px;line-height:1.8;font-family:"SF Mono",monospace}

/* Fake poem display — key visual for AI hallucination */
.poem-display{background:linear-gradient(135deg,#1a1a30,#151525);border:2px solid rgba(240,180,41,.2);border-radius:20px;padding:40px 48px;max-width:550px;text-align:center;position:relative;overflow:hidden}
.poem-display::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(240,180,41,.5),transparent)}
.poem-display .title{font-size:22px;color:#f0b429;margin-bottom:20px;font-weight:700}
.poem-display .verse{font-size:20px;color:rgba(255,255,255,.7);line-height:2;font-style:italic}
.poem-display .stamp{position:absolute;top:20px;right:24px;background:rgba(220,50,50,.15);color:#dc3232;border:2px solid rgba(220,50,50,.4);padding:6px 16px;border-radius:10px;font-size:14px;font-weight:700;transform:rotate(12deg)}

/* Letter comparison — 3 columns */
.letter-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1150px}
.letter-card{background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:28px 24px;text-align:left;font-size:14px;color:rgba(255,255,255,.4);line-height:1.8;position:relative}
.letter-card .grade{position:absolute;top:-12px;right:16px;padding:4px 14px;border-radius:10px;font-size:13px;font-weight:700}
.letter-card .grade.bad{background:#4a4a5a;color:rgba(255,255,255,.5)}
.letter-card .grade.mid{background:#888;color:#fff}
.letter-card .grade.great{background:#f0b429;color:#0a0a14}
.letter-card .prompt-label{display:block;font-size:11px;color:rgba(255,255,255,.15);margin-bottom:10px;font-family:"SF Mono",monospace;word-break:break-all}
.letter-card b{color:rgba(255,255,255,.8)}
.letter-card.highlight{border-color:rgba(240,180,41,.3);box-shadow:0 0 30px rgba(240,180,41,.05)}

/* Lists */
.checklist{list-style:none;max-width:500px}
.checklist li{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:19px;display:flex;align-items:center;gap:14px}
.checklist li .dot{width:10px;height:10px;background:#f0b429;border-radius:50%;flex-shrink:0}

/* Steps */
.steps{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;max-width:950px}
.step{background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:24px 20px;text-align:center;width:150px}
.step .num{font-size:38px;font-weight:900;color:#f0b429;margin-bottom:10px}
.step .label{font-size:14px;color:rgba(255,255,255,.5);line-height:1.5}

/* Iceberg */
.iceberg{max-width:500px;margin:20px auto}
.iceberg .above{font-size:19px;color:rgba(255,255,255,.6);text-align:center;padding:20px;border:1px solid rgba(255,255,255,.2);border-radius:16px 16px 0 0}
.iceberg .below{font-size:22px;color:#f0b429;font-weight:700;text-align:center;padding:28px;background:rgba(240,180,41,.08);border:1px solid rgba(240,180,41,.2);border-radius:0 0 16px 16px;margin-top:-1px}
.iceberg .waterline{text-align:center;font-size:12px;color:rgba(255,255,255,.15);padding:6px 0}
.iceberg .waterline::before,.iceberg .waterline::after{content:"━━━━━━━";margin:0 8px}

/* Money cards */
.money-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:750px}
.money-card{background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:32px 24px;text-align:center}
.money-card .price{font-size:38px;font-weight:900;color:#f0b429;margin-bottom:10px}
.money-card .desc{font-size:14px;color:rgba(255,255,255,.4);line-height:1.6}

/* Full power demo */
.power-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:750px}
.power-step{background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:20px;display:flex;align-items:center;gap:16px}
.power-step .icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.power-step .icon.write{background:rgba(110,142,251,.15);color:#6e8efb}
.power-step .icon.image{background:rgba(168,120,251,.15);color:#a878fb}
.power-step .icon.web{background:rgba(120,200,140,.15);color:#78c88c}
.power-step .info{font-size:15px;color:rgba(255,255,255,.5);line-height:1.5}
.power-step .time{font-size:12px;color:rgba(255,255,255,.15);margin-top:4px}

/* Super power cards */
.super-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:750px}
.super-card{background:rgba(21,21,37,.9);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:24px;text-align:left}
.super-card .num{font-size:28px;font-weight:900;color:#f0b429;margin-bottom:8px}
.super-card .cmd{font-size:15px;color:rgba(255,255,255,.7);font-family:"SF Mono",monospace;line-height:1.6}
.super-card .cmd span{color:#f0b429}

/* Hints */
.hint{display:inline-block;padding:4px 14px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:8px}
.hint.ask{background:rgba(240,180,41,.12);color:#f0b429;border:1px solid rgba(240,180,41,.25)}
.hint.think{background:rgba(110,142,251,.12);color:#6e8efb;border:1px solid rgba(110,142,251,.25)}
.hint.do{background:rgba(120,200,140,.12);color:#78c88c;border:1px solid rgba(120,200,140,.25)}
.hint-text{font-size:18px;color:rgba(255,255,255,.6);text-align:center;max-width:580px;line-height:1.6;margin-top:6px}

/* Suspense & quote */
.suspense{font-size:100px;margin-bottom:20px}
.quote{font-size:clamp(20px,4vw,34px);font-style:italic;color:rgba(255,255,255,.7);text-align:center;max-width:750px;line-height:1.5}
.quote::before{content:'"';color:#f0b429}
.quote::after{content:'"';color:#f0b429}

/* Nav */
.nav{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:10;background:rgba(21,21,37,.95);border:1px solid rgba(255,255,255,.06);border-radius:40px;padding:8px 16px}
.nav .page{color:rgba(255,255,255,.25);font-size:13px;min-width:60px;text-align:center;line-height:28px}
.nav button{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;transition:all .2s}
.nav button:hover{border-color:#f0b429;color:#f0b429}

/* Visual anchor — big emoji for empty states */
.visual-icon{font-size:80px;margin-bottom:16px;opacity:.8}
'''

WRAPPER = '''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title><style>
''' + CSS + '''
</style></head><body><div class="slide-container">
{slides}
</div>
<div class="nav"><button onclick="prev()">←</button><span class="page" id="pageNum">1 / {total}</span><button onclick="next()">→</button></div>
<script>let c=0;const s=document.querySelectorAll(".slide"),t=s.length;function show(i){{s.forEach(x=>x.classList.remove("active"));s[i].classList.add("active");document.getElementById("pageNum").textContent=(i+1)+" / "+t}}function next(){{c=(c+1)%t;show(c)}}function prev(){{c=(c-1+t)%t;show(c)}}document.addEventListener("keydown",e=>{{if(e.key==="ArrowRight"||e.key==="ArrowDown")next();if(e.key==="ArrowLeft"||e.key==="ArrowUp")prev()}})</script></body></html>'''

def tdivider(tag, h1):
    return f'<div class="slide active divider"><div class="tag">{tag}</div><h1>{h1}</h1></div>'

import os
BASE = '/Users/wujames/WorkBuddy/2026-05-22-00-48-04/camp-website/slides'

def mod(fn, title, slides):
    t = slides.count('<div class="slide')
    html = WRAPPER.replace('{title}', title).replace('{slides}', slides).replace('{total}', str(t))
    with open(f'{BASE}/{fn}', 'w') as f:
        f.write(html)
    print(f'  {fn}: {t} slides')

# ====== MODULE 1 ======
slides = tdivider('模块 1 · 45 分钟', '原来这样<br>就能赚钱？')
slides += '''
<div class="slide"><div class="story-card"><div class="emoji">🎒</div><h3>11 岁 · 水杯提醒器</h3><p>发现：全班每天 5 个人忘带水杯<br>渴了一上午，只能等午饭才喝到水</p><p style="margin-top:10px">做了：书包上缝小口袋 → <span class="amber-text" style="font-size:18px">"水杯！"</span></p><p style="margin-top:10px">卖了：<span class="amber-text" style="font-size:24px">12 人 × ¥5 = ¥60</span></p></div><div class="hint ask" style="margin-top:16px">提问</div><div class="hint-text">他是第一个发现"忘带水杯"的人吗？</div></div>
<div class="slide"><div class="story-card"><div class="emoji">📱</div><h3>14 岁 · 作业提醒闹钟</h3><p>发现：班里总有人忘写作业被扣分</p><p style="margin-top:10px">做了：用 <span class="amber-text">AI</span> 做了小程序<br>每天放学弹出"今晚有数学作业"</p><p style="margin-top:10px">赚了：500 人下载 → <span class="amber-text" style="font-size:24px">奶茶店广告 ¥200/月</span></p></div><div class="hint think" style="margin-top:16px">思考</div><div class="hint-text">她写了代码吗？AI 帮她做了什么？</div></div>
<div class="slide"><h1>他们有什么<br>共同点？</h1><div class="hint think" style="margin-top:16px">思考 · 1 分钟</div><div class="hint-text">两人各发现了什么？做了什么？赚到了什么？<br>用自己的话总结"创业是什么"</div></div>
<div class="slide"><div class="formula">创业 = <span>发现痛点</span> + <span>做出方案</span> + <span>让人付钱</span></div><p style="margin-top:20px;font-size:16px">痛点越小越具体 → 越容易做出产品<br>你的第一个客户 → 在你身边 5 米以内</p><div class="hint do" style="margin-top:16px">实操</div><div class="hint-text">从烦人墙上选 1 个问题，用公式写："帮___解决___"</div></div>
<div class="slide divider"><div class="tag">备选故事</div><h1 style="font-size:clamp(24px,4vw,40px)">如果前面没共鸣<br>换下面的</h1></div>
<div class="slide"><div class="story-card"><div class="emoji">🍱</div><h3>食堂今天有什么？</h3><p>痛点：午饭前不知道食堂有什么<br>排队到窗口才发现不想吃</p><p style="margin-top:8px">赚了：周菜单订阅 <span class="amber-text">¥2/周 × 20 人</span></p></div></div>
<div class="slide"><div class="story-card"><div class="emoji">🗺️</div><h3>教室在哪？</h3><p>痛点：新学期拿着课表找不到教室，天天迟到</p><p style="margin-top:8px">赚了：校园地图 <span class="amber-text">¥1/张 × 50 张</span></p></div></div>
<div class="slide"><div class="story-card"><div class="emoji">📚</div><h3>明天带什么书？</h3><p>痛点：书包塞满，要用的没带。到底有什么课？交什么作业？</p><p style="margin-top:8px">赚了：小程序 → <span class="amber-text">广告 ¥100/月</span></p></div></div>
'''
mod('module1.html', '模块1 · 创业是什么', slides)

# ====== MODULE 2: AI骗子 — 嵌入假诗展示 ======
slides = tdivider('模块 2 · 45 分钟', 'AI 是骗子？')
slides += '''
<div class="slide"><div class="hint do">实操</div><div class="hint-text" style="font-size:22px;margin-bottom:16px">现在，所有人打开 WorkBuddy</div><div class="demo-box" style="font-size:24px;padding:28px 40px">李白写过一首诗叫《望庐山》，<br>请全文背诵。</div><p style="font-size:15px;margin-top:14px;color:rgba(255,255,255,.2)">每个人都输入这句话，回车</p></div>
<div class="slide"><div class="suspense">❓</div><h1>这首诗<br>是真的吗？</h1><div class="hint ask" style="margin-top:20px">提问</div><div class="hint-text">举手表决：觉得真的？ 觉得假的？</div></div>
<div class="slide"><h1 style="color:#dc3232;font-size:clamp(48px,10vw,100px)">假的！</h1><p style="font-size:22px;margin-top:10px">李白写过《望庐山瀑布》<br>但从没写过《望庐山》</p><div class="poem-display" style="margin-top:20px"><div class="stamp">🚨 AI 编的</div><div class="title">《望庐山》</div><div class="verse">日照香炉生紫烟<br>遥看瀑布挂前川<br>飞流直下三千尺<br>疑是银河落九天</div></div><p style="font-size:14px;color:rgba(255,255,255,.2);margin-top:12px">看到没有？AI 把李白的真诗拆散了拼在一起，听起来像真的——其实全是拼凑的。</p></div>
<div class="slide"><div class="hint think" style="margin-bottom:16px">思考</div><h2>AI 是故意骗你的吗？</h2><p style="margin-top:12px">不是。它读了太多东西，自己把<br>"李白""庐山""诗"拼在一起，猜了一个答案。</p><p style="margin-top:12px;color:rgba(255,255,255,.3)">它自己不知道自己在说谎。</p></div>
<div class="slide"><div class="formula" style="font-size:30px"><span>CEO 守则第一条</span><br>AI 给你的答案<br>先怀疑，再验证</div><div class="hint do" style="margin-top:24px">实操</div><div class="hint-text">再问 AI 一个问题，然后自己去验证对错</div></div>
'''
mod('module2.html', '模块2 · AI是骗子？', slides)

# ====== MODULE 2.5: AI 超能力 + 全流程火力展示 ======
slides = tdivider('模块 2.5 · 15 分钟', 'AI 的 6 个<br>超能力')
slides += '''
<div class="slide"><div class="super-grid"><div class="super-card"><div class="num">01</div><div class="cmd"><span>"帮我做一个网页</span>。_____"</div></div><div class="super-card"><div class="num">02</div><div class="cmd"><span>"把</span>_____<span>改成</span>_____。"</div></div><div class="super-card"><div class="num">03</div><div class="cmd"><span>"用</span>___岁小孩能听懂的话<span>解释。"</span></div></div><div class="super-card"><div class="num">04</div><div class="cmd"><span>"控制在</span>___字<span>以内。"</span></div></div><div class="super-card"><div class="num">05</div><div class="cmd"><span>"第</span>___部分不对<span>，改成：</span>___"</div></div><div class="super-card"><div class="num">06</div><div class="cmd"><span>AI 说完 → 自己查 → 再决定信不信</span></div></div></div><div class="hint do" style="margin-top:20px">实操</div><div class="hint-text">现在就用超能力 1，做一个网页</div></div>
<div class="slide"><h2>组合技 · 全流程展示</h2><p style="font-size:16px;margin-bottom:16px;color:rgba(255,255,255,.3)">老师全程不说话，纯看——</p><div class="power-grid"><div class="power-step"><div class="icon write">✍️</div><div class="info">"帮我写一篇100字短文：如果猫会说话"<div class="time">→ 10 秒，文章出来了</div></div></div><div class="power-step"><div class="icon image">🎨</div><div class="info">"给这篇短文生成一张配图，卡通风格"<div class="time">→ 10 秒，图出来了</div></div></div><div class="power-step" style="margin-top:12px;max-width:720px;width:100%"><div class="icon web">🌐</div><div class="info">"把文字和图做成一个网页，暖色背景，大号字体"<div class="time">→ 10 秒，网页出来了</div></div><div class="hint ask" style="margin-top:20px">提问</div><div class="hint-text">从写文章到出网页，用了多久？<br><span style="color:#f0b429">30 秒。一个人从零开始做出来。</span></div></div>
'''
mod('module2-5.html', '模块2.5 · AI超能力卡', slides)

# ====== MODULE 3: 真需求 ======
slides = tdivider('模块 3 · 45 分钟', '怎么知道别人<br>真的想要？')
slides += '''
<div class="slide"><h2 style="font-size:22px;margin-bottom:8px">妈妈打电话："我孩子要补英语"</h2><div class="iceberg"><div class="above">"补习英语"</div><div class="waterline">━━━━━━━ 水面 ━━━━━━━</div><div class="below">"下次考试及格<br>不要再被班主任约谈"</div></div><div class="hint think" style="margin-top:12px">思考</div><div class="hint-text">你自己的选题，有没有水面下的部分？</div></div>
<div class="slide"><h2>三个追问法</h2><ul class="checklist" style="margin-top:20px"><li><span class="dot"></span>① 你遇到过吗？<span style="color:rgba(255,255,255,.2);margin-left:auto">→ 真不真实</span></li><li><span class="dot"></span>② 多久一次？<span style="color:rgba(255,255,255,.2);margin-left:auto">→ 值不值得</span></li><li><span class="dot"></span>③ 你试过怎么解决？<span style="color:rgba(255,255,255,.2);margin-left:auto">→ 有没有机会</span></li></ul><p style="margin-top:20px">三个全绿灯 = 真需求<br>任意红灯 = 再想想</p></div>
<div class="slide"><h2>现在就去问真人</h2><p style="font-size:22px;margin-top:12px">每个组领 3 张用户采访卡</p><div class="demo-box" style="font-size:16px;font-family:inherit;margin-top:20px;line-height:2.2;text-align:left;padding-left:40px"><p>Q1. 你遇到过这个麻烦吗？</p><p>Q2. 你最在乎什么？</p><p>Q3. 愿意付多少钱？</p></div><div class="hint do" style="margin-top:16px">实操 · 25 分钟</div><div class="hint-text">采访另外 2 组的人。只能问，不能说服。<br>对方说"不需要"→ 谢谢 ta，走开。</div></div>
'''
mod('module3.html', '模块3 · 怎么找到真需求', slides)

# ====== MODULE 4: Prompt — 三封信并排展示 ======
slides = tdivider('模块 4 · 45 分钟', '同一句话<br>AI 反应差十倍')
slides += '''
<div class="slide"><h2 style="margin-bottom:14px;font-size:20px">让 AI 写一封道歉信 — 同一个人，同一个目标</h2><div class="letter-grid"><div class="letter-card"><div class="grade bad">10 分</div><span class="prompt-label">Prompt："帮我写一封道歉信"</span><p>尊敬的[收信人]：我写这封信是为了表达我最诚挚的歉意。对于我的行为给您带来的不便，我深感抱歉…</p><p style="margin-top:8px;font-size:12px;color:rgba(255,255,255,.15)">不知道谁写的、写给谁、什么事</p></div><div class="letter-card"><div class="grade mid">50 分</div><span class="prompt-label">Prompt："我是一个学生，写给老师的"</span><p>亲爱的老师：我想为我在课堂上的行为向您道歉。我保证以后会认真听讲…</p><p style="margin-top:8px;font-size:12px;color:rgba(255,255,255,.15)">知道是学生→老师，但还是有点假</p></div><div class="letter-card highlight"><div class="grade great">90 分</div><span class="prompt-label">Prompt："我是五年级的小明。上课讲话被王老师批评了。王老师嗓子都哑了还在讲课。用小孩的话写，200字以内"</span><p>王老师：我今天上课讲话，对不起。<b>您嗓子都哑了还在给我们讲课，我却跟同桌聊昨晚的游戏</b>。我保证明天开始…</p><p style="margin-top:8px;font-size:12px;color:rgba(240,180,41,.6)">有名字、有细节、有温度</p></div></div><div class="hint think" style="margin-top:16px">思考</div><div class="hint-text">第三次比第一次，你多做了什么？<br><span class="amber-text">同一个AI，问得好90分，问得差10分。<br>中间差的80分，就是"说清楚"三个字。</span></div></div>
<div class="slide"><h2>跟 AI 说话，填这 5 句</h2><div class="demo-box" style="text-align:left;font-size:18px;font-family:inherit;max-width:550px;line-height:2.5"><p>1. 你是什么？<span style="color:#f0b429;margin-left:16px">你是一个______</span></p><p>2. 帮谁？<span style="color:#f0b429;margin-left:16px">我要帮______</span></p><p>3. 做什么？<span style="color:#f0b429;margin-left:16px">做一个______</span></p><p>4. 怎么做？<span style="color:#f0b429;margin-left:16px">打开后______</span></p><p>5. 别做什么？<span style="color:#f0b429;margin-left:16px">不要______</span></p></div><div class="hint do" style="margin-top:20px">实操 · 15 分钟</div><div class="hint-text">用这张卡，为你的项目写第 1 个 prompt<br>写完立刻跑，看效果</div></div>
'''
mod('module4.html', '模块4 · 怎么跟AI说话', slides)

# ====== MODULE 5: MVP ======
slides = tdivider('模块 5 · 30 分钟', '做什么？')
slides += '''
<div class="slide"><div style="font-size:clamp(32px,6vw,56px);line-height:1.3;text-align:center"><p style="color:rgba(255,255,255,.5);margin-bottom:16px">把你们想做的功能都列出来</p><p style="font-size:40px;color:rgba(255,255,255,.2)">↓</p><p style="margin-top:12px"><span class="amber-text">如果只剩 2 小时<br>只能做 1 个功能</span></p><p style="margin-top:14px;color:rgba(255,255,255,.5)">你保留哪个？</p></div><div class="hint do" style="margin-top:28px">实操 · 5 分钟</div><div class="hint-text">每组列出所有功能 → 砍到只剩 1 个</div></div>
<div class="slide"><h2>MVP = 能让人 30 秒看懂<br>你在干嘛的最小版本</h2><div class="demo-box" style="font-family:inherit;font-size:16px;text-align:left;margin-top:20px;line-height:2"><p style="color:#f0b429">例：宠物医生</p><p>完整版：数据库 + 预约挂号 + 看评价 + 在线问诊</p><p style="margin-top:8px;color:rgba(255,255,255,.2)">⬇ 砍掉 90%</p><p style="color:#f0b429">MVP 版：</p><p>一个网页，输入"猫吐了"<br>→ <span style="color:#78c88c">绿色：在家观察</span> / <span style="color:#dc3232">红色：去医院</span></p></div><div class="hint think" style="margin-top:12px">思考</div><div class="hint-text">完整版和 MVP 版，哪个能在 2 小时内做出来？</div></div>
'''
mod('module5.html', '模块5 · 只做一个功能', slides)

# ====== MODULE 6 ======
slides = tdivider('模块 6 · 30 分钟', '定多少钱？')
slides += '''
<div class="slide"><h2 style="margin-bottom:20px">三种赚钱方式</h2><div class="money-grid"><div class="money-card"><div class="price">¥3/次</div><div class="desc">按次收费<br>偶尔用的产品</div></div><div class="money-card"><div class="price">¥10/月</div><div class="desc">包月订阅<br>天天用的产品</div></div><div class="money-card"><div class="price">免费+广告</div><div class="desc">用户量大<br>广告主买单</div></div></div><div class="hint ask" style="margin-top:16px">提问</div><div class="hint-text">你的产品适合哪一种？为什么？</div></div>
<div class="slide"><h2>拍脑袋：先写一个价</h2><div class="hint do" style="margin-top:8px">实操</div><div class="hint-text" style="font-size:20px">每人纸上写一个数</div><div class="demo-box" style="font-size:22px;font-family:inherit;margin-top:16px">"如果你是用户<br>这个价你愿意付吗？"</div><p style="margin-top:12px;font-size:16px">然后去问隔壁组</p><p style="font-size:14px;color:rgba(255,255,255,.25)">低龄辅助："这个价能买几包辣条？"</p></div>
<div class="slide"><h2>算一笔账</h2><div class="formula" style="margin-top:20px;font-size:clamp(20px,3vw,32px)">100 个用户 × 每人 <span>¥__</span> / 月<br>= 一个月赚 <span>¥__</span></div><div class="hint do" style="margin-top:24px">实操</div><div class="hint-text">每组站起来，大声喊出你们的数字！</div><p style="margin-top:16px;font-size:17px">定价不是数学题，是共情题<br>你越懂用户，越知道 ta 愿意为什么付钱</p></div>
'''
mod('module6.html', '模块6 · 定多少钱', slides)

# ====== MODULE 7: 路演 ======
slides = tdivider('模块 7 · 30 分钟', '怎么让人听完<br>想投钱？')
slides += '''
<div class="slide"><div class="hint do" style="margin-bottom:16px">实操 · 1 分钟</div><h2>现在裸讲</h2><p style="font-size:22px;margin-top:8px">每组推一个人<br>什么都不准备，直接讲</p><p style="margin-top:8px;color:rgba(255,255,255,.2)">（大概率语无伦次 — 正常）</p></div>
<div class="slide"><h2 style="margin-bottom:24px">路演五步</h2><div class="steps"><div class="step"><div class="num">①</div><div class="label">"你见过<br>这种情况吗？"</div></div><div class="step"><div class="num">②</div><div class="label">"我们做了<br>一个东西"</div></div><div class="step"><div class="num">③</div><div class="label">"看，就是它"<br>演示</div></div><div class="step"><div class="num">④</div><div class="label">"它会赚钱"<br>算账</div></div><div class="step"><div class="num">⑤</div><div class="label">"投我们"<br>行动</div></div></div><div class="hint think" style="margin-top:20px">思考</div><div class="hint-text">跟第一次裸讲比，这个结构帮了你什么？</div></div>
<div class="slide"><div class="quote" style="margin-bottom:28px">最好的路演<br>不是介绍产品<br>是让人心里想</div><h1 style="margin-bottom:0"><span class="amber">"对对对<br>我也遇到过"</span></h1><div class="hint do" style="margin-top:28px">实操</div><div class="hint-text">用五步结构再讲一遍。每个人都练。</div></div>
'''
mod('module7.html', '模块7 · 怎么讲好故事', slides)

print("\n✅ 7 modules generated with embedded demos.")
