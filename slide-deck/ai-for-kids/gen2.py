#!/usr/bin/env python3
"""Direct OpenAI API for remaining slides - reliable, no socket issues."""
import os, time, base64
from openai import OpenAI

os.environ['OPENAI_API_KEY'] = 'sk-Sco7l3va3GHleFO7Poj2ORp0b09OdALuCNjEZCUwp4IULrN3'
client = OpenAI()

BASE = '/Users/wujames/WorkBuddy/2026-05-22-00-48-04/slide-deck/ai-for-kids'

slides = [
    ("08", "Tech slide. Left side: person asks question, AI gives answer (labeled '普通AI'). Right side: person gives goal, AI independently completes task using tools (labeled '智能体'). Side by side comparison. Dark navy background, teal circuit accents. 16:9."),
    ("09", "Tech slide. Robot planning birthday party workflow: check calendar, search venues, write invitations, calculate budget. Each step with green checkmark. Task flow diagram. Dark navy teal amber. 16:9."),
    ("10", "Tech slide. Title: '中国的DeepSeek'. Abstract Chinese dragon made of glowing circuit board lines. Modern tech aesthetic, not cartoonish. Dark navy teal gold. 16:9."),
    ("11", "Tech slide. '100块做了别人1000块的事' Cost efficiency bar chart: 100 yuan vs 1000 yuan. Highlighting cost-effectiveness. Dark navy teal amber. 16:9."),
    ("12", "Tech slide. DeepSeek three strengths: '几乎免费' '特别聪明' '配方公开'. Three glowing icon cards. Dark navy teal amber. 16:9."),
    ("13", "Tech slide. Title: '两个团队在比赛'. Abstract Team China vs Team USA tech race theme. Two glowing flags stylized as circuit nodes. Respectful competition. Dark navy teal amber. 16:9."),
    ("14", "Tech slide. Comparison table: Team USA strengths (inventing new things, best chips, global talent). Team China strengths (applying tech, lots of users and data, high efficiency low cost). Dark navy teal. 16:9."),
    ("15", "Tech slide. Race track with two runners neck and neck, finish line ahead. Question mark above: '谁是冠军？'. Inspirational. Dark navy teal amber. 16:9."),
    ("16", "Tech slide. Summary grid: '图灵测试 多模态 智能体 DeepSeek 中美竞争'. Five glowing hexagonal icons. Dark navy teal amber. 16:9."),
    ("17", "Tech slide. Final slide: sleek robot silhouette with subtle glow. Text: 'AI时代 你是CEO'. Elegant closing. Dark navy teal amber gold. 16:9."),
]

for fn, prompt in slides:
    path = f"{BASE}/{fn}.png"
    if os.path.exists(path) and os.path.getsize(path) > 100000:
        print(f"⏭️  {fn}: exists, skip")
        continue
    
    print(f"🎨 {fn}: generating...", flush=True)
    for attempt in range(5):
        try:
            resp = client.images.generate(
                model="gpt-image-2",
                prompt=prompt,
                n=1,
                size="1792x1024",
                response_format="b64_json"
            )
            img_data = base64.b64decode(resp.data[0].b64_json)
            with open(path, 'wb') as f:
                f.write(img_data)
            if os.path.getsize(path) > 100000:
                print(f"  ✅ {fn}: done ({os.path.getsize(path)//1024}KB)")
                break
        except Exception as e:
            print(f"  ⚠️  {fn} attempt {attempt+1}: {str(e)[:80]}")
            time.sleep(3)
    else:
        print(f"  ❌ {fn}: FAILED")
    
    time.sleep(1)

print("Done!")
