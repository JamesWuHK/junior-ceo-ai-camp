// 少年CEO AI 创业营 · 教师认证云函数
// 部署到腾讯云 CloudBase SCF 或 EdgeOne Pages Functions
// 密码通过环境变量 TEACHER_PASSWORD 配置

exports.main = async (event, context) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // 只接受 POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const { password } = JSON.parse(event.body || '{}');
  const valid = process.env.TEACHER_PASSWORD || 'ceo2026';

  if (password === valid) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, token: 'teacher_' + Date.now() })
    };
  }

  return {
    statusCode: 401, headers,
    body: JSON.stringify({ ok: false, error: '密码错误' })
  };
};
