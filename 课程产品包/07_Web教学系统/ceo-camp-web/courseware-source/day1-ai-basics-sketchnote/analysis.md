# Baoyu Slide Deck Analysis

Topic: Day 1 AI 知识科普 sketchnote 图文 PPT

Content type: 儿童 AI 科普 / 课堂知识输入 / 未来照相馆解密

Audience layer: 孩子可见。可以全屏给 8-16 岁孩子看，当前重点按 10 岁孩子理解水平设计。

Detected language: zh

Source file: `source-day1-ai-basics-sketchnote.md`

## Content Signals

- education, tutorial, beginner
- children, classroom, AI basics
- story, visual explanation, experiment
- hand-drawn notes, task cards, arrows, doodles

## Recommended Choices

- Style: `sketch-notes`
- Alternative style: `hand-drawn-edu`
- Audience: `Beginners/learners`
- Language: `zh`
- Slide count: 9
- Image backend: Codex native `imagegen`
- Outline review: yes
- Prompt review: yes

## Why This Style

`sketch-notes` is a better fit than the previous HTML/CSS version because this module needs visual explanation more than UI layout. The deck should feel like a smart classroom notebook: big picture, short labels, visible arrows, sticky notes, and playful but clear diagrams.

## Key Teaching Arc

1. AI 像一个会学习的大脑。
2. 它可以读文字、看图片、听声音。
3. 它曾经学习过很多例子。
4. 未来职业照来自照片、职业、任务三种线索。
5. 提示词就是任务纸条。
6. AI 生成结果后，人来判断和修改。
7. 单独实验：孩子试着把模糊想法改成清楚的出图任务单。
8. 找茬儿任务：几张 AI 第一版图里有明显逻辑错误，孩子自己发现问题，再告诉 AI 改哪里。

## Scope Boundary

第 8-9 页保留为独立出图实验页。前 7 页讲 AI 如何读线索并生成未来职业照；第 8 页让孩子体验一次“给 AI 清楚线索，看看它能画出什么”；第 9 页设计成“找茬儿任务”：几张 AI 第一版图里故意有明显逻辑错误，孩子自己发现问题，一处一处告诉 AI 修改。

## Text Risk Notes

Baoyu slide images bake text into raster images. To reduce garbled Chinese text risk:

- Each slide should use one short title.
- Labels should be 2-6 Chinese characters where possible.
- Avoid full teacher explanations inside images.
- If generated text is wrong, regenerate from simpler prompts instead of programmatically painting over the image.

## Child-Visible Copy Gate

The planned child-visible slide text follows the `AGENTS.md` child-visible layer rule: no internal management, technical operations, classroom support, or system-processing vocabulary should appear in generated slide images.

## Child Perspective Audit

Passed after revision. The source now has a `PPT 画面文字白名单`, and generated slide images should only use that whitelist. Planning notes, visual instructions, scope notes, and teacher notes are marked as non-rendered guidance.

Visible copy checks:

- No teacher-control, backend, deployment, or product-planning language in the whitelist.
- No创业方向三问 or software/tool-operation jump in the whitelist.
- Child-facing phrases use concrete classroom actions: 看、说、画、找、圈、告诉 AI、看新版。
- More child-natural wording has been preferred: `长大后的职业照`, `动物医院`, `AI 画错了哪里`。

## Production Status

Step 1 setup and analysis completed.

Outline and prompt files have been prepared for `baoyu-slide-deck`.

Prompt completeness checked on 2026-06-10: 9 prompt files are present under `prompts/`.

Child-visible prompt gate checked on 2026-06-10: the formal prompt files do not contain the project-blocked internal/system terms. The only slide text to render is listed under each prompt's `Visible text, exactly` block.

Image generation completed after explicit user confirmation. Generated files:

- `01-slide-ai-brain.png`
- `02-slide-task-starts.png`
- `03-slide-photo-clue.png`
- `04-slide-many-examples.png`
- `05-slide-three-clues.png`
- `06-slide-clear-task.png`
- `07-slide-human-director.png`
- `08-slide-first-image-task.png`
- `09-slide-find-odd-details.png`
- `day1-ai-basics-sketchnote.pptx`
- `day1-ai-basics-sketchnote.pdf`
- `index.html`
