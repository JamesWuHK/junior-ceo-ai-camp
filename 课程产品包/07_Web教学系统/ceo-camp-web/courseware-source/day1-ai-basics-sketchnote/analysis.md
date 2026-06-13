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
- Slide count: 10
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
8. 孩子先发言，说清自己想画的未来职业图。
9. 打开 WorkBuddy，用自己的任务单生成一张图，再选一处继续改。

## Scope Boundary

第 8-10 页保留为独立出图实验页。前 7 页讲 AI 如何读线索并生成未来职业照；第 8 页让孩子体验一次“给 AI 清楚线索，看看它能画出什么”；第 9 页让孩子先说出自己脑子里的画面；第 10 页进入 WorkBuddy 实操，生成第一张图并选择一处继续修改。

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
- Child-facing phrases use concrete classroom actions: 看、说、画、打开、发出任务、生成图片、再改一处。
- More child-natural wording has been preferred: `长大后的职业照`, `动物医院`, `你想画什么`, `画一张自己的图`。

## Production Status

Step 1 setup and analysis completed.

Outline and prompt files have been prepared for `baoyu-slide-deck`.

Prompt completeness checked on 2026-06-13: 10 active prompt files are present under `prompts/`.

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
- `10-slide-say-your-picture.png`
- `11-slide-workbuddy-draw.png`
- `day1-ai-basics-sketchnote.pptx`
- `day1-ai-basics-sketchnote.pdf`
- `index.html`

Update on 2026-06-13:

- User removed the old find-the-error slide.
- Slides 10 and 11 were generated with `baoyu-slide-deck` prompts in `sketch-notes` style through `baoyu-image-gen --provider codex-cli`.
- System now loads active image pages: 01-08, 10, 11.
