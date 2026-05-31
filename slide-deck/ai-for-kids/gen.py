#!/usr/bin/env python3
"""Batch generate all remaining slides using OpenAI GPT Image 2."""
import subprocess, time, os

BASE = '/Users/wujames/WorkBuddy/2026-05-22-00-48-04/slide-deck/ai-for-kids'
BUN = '/Users/wujames/.workbuddy/skills/baoyu-imagine/scripts/main.ts'
IMAGE_DIR = '/Users/wujames/WorkBuddy/2026-05-22-00-48-04'

slides = [
    # (filename, prompt)
    ("06", "Tech slide. Photo camera to text description to AI generated image pipeline flow. Dark navy teal. 16:9."),
    ("07", "Tech slide. 'AI能自己干活了' Title page. Sleek robot holding multiple tools. Dark navy teal amber. 16:9."),
    ("08", "Tech slide. Left '普通AI question answer' Right '智能体 goal task completed'. Side by side comparison. Dark navy teal. 16:9."),
    ("09", "Tech slide. Robot planning birthday party on its own checking calendar searching venue writing invitations calculating budget. Task flow diagram. Dark navy teal amber. 16:9."),
    ("10", "Tech slide. '中国的DeepSeek' Title page. Chinese AI logo style abstract dragon circuit. Dark navy teal amber. 16:9."),
    ("11", "Tech slide. '100块做了别人1000块的事' Cost comparison bar chart 100 vs 1000 yuan. Highlighting efficiency. Dark navy teal amber. 16:9."),
    ("12", "Tech slide. DeepSeek why amazing: almost free super smart recipe open source. Three glowing icons. Dark navy teal. 16:9."),
    ("13", "Tech slide. '两个团队在比赛' Title page. China flag and USA flag abstract tech symbols facing each other respectfully. Dark navy teal amber. 16:9."),
    ("14", "Tech slide. Left Team USA strengths invention chips talent. Right Team China strengths application data efficiency. Comparison table. Dark navy teal. 16:9."),
    ("15", "Tech slide. '比赛才刚开始' Race track with two runners neck and neck. Finish line in distance. Who will win question mark. Dark navy teal amber. 16:9."),
    ("16", "Tech slide. '5个你今天就学到的AI知识' Summary grid: Turing test multimodal agent DeepSeek competition. Five glowing icons. Dark navy teal amber. 16:9."),
    ("17", "Tech slide. 'AI时代 你是CEO' Final slide. Sleek robot silhouette bowing. Thank you. Dark navy teal amber elegant. 16:9."),
]

success = 0
failed = []

for fn, prompt in slides:
    image_path = f"{BASE}/{fn}.png"
    if os.path.exists(image_path) and os.path.getsize(image_path) > 100000:
        print(f"⏭️  {fn}: already exists, skipping")
        success += 1
        continue
    
    print(f"🎨 {fn}: generating...")
    for attempt in range(5):
        time.sleep(2)
        result = subprocess.run(
            ['bun', BUN, '--provider', 'openai', '--model', 'gpt-image-2',
             '--prompt', prompt, '--image', image_path, '--ar', '16:9'],
            cwd=IMAGE_DIR, capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0 and os.path.exists(image_path) and os.path.getsize(image_path) > 100000:
            print(f"✅ {fn}: done (attempt {attempt+1})")
            success += 1
            break
        else:
            err = result.stderr.strip()[-100:] if result.stderr else result.stdout.strip()[-100:]
            print(f"  ⚠️  attempt {attempt+1}: {err}")
    else:
        print(f"❌ {fn}: FAILED after 5 attempts")
        failed.append(fn)

print(f"\n{'='*40}")
print(f"Done. {success}/{len(slides)} successful, {len(failed)} failed.")
if failed:
    print(f"Failed: {failed}")
