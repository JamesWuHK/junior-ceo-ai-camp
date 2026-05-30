#!/bin/bash
# 一键部署教师认证云函数到腾讯云 CloudBase
# 使用前：npm install -g @cloudbase/cli && tcb login

set -e

FUNCTION_DIR="$(dirname "$0")/teacher-auth"
FUNCTION_NAME="teacher-auth"
ENV_ID="${TCB_ENV_ID:-}"  # 或手动替换

if [ -z "$ENV_ID" ]; then
  echo "请先设置环境ID: export TCB_ENV_ID=your-env-id"
  echo "或直接运行: tcb fn deploy teacher-auth --envId your-env-id"
  exit 1
fi

echo "部署云函数到环境: $ENV_ID"

cd "$FUNCTION_DIR"

# 设置密码环境变量（改成你自己的）
TEACHER_PASSWORD="${TEACHER_PASSWORD:-ceo2026}"

tcb fn deploy "$FUNCTION_NAME" \
  --envId "$ENV_ID" \
  --code-secret "{\"TEACHER_PASSWORD\":\"$TEACHER_PASSWORD\"}" \
  --force

echo ""
echo "部署完成！云函数访问地址:"
tcb fn detail "$FUNCTION_NAME" --envId "$ENV_ID" | grep -i "url\|trigger"
echo ""
echo "把上面这个 URL 复制到 camp-website/teacher.html 的 AUTH_URL"
