// 少年CEO AI 创业营 · 综合云函数
// 功能：①教师认证 ②报名表单接收
// 部署：腾讯云 SCF，密码通过环境变量 TEACHER_PASSWORD 配置

exports.main = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const valid = process.env.TEACHER_PASSWORD || 'ceo2026';

    // ① 报名表单
    if (body.type === 'signup') {
      const { parent_name, phone, child_name, child_age, contact, notes, time } = body;
      // 写日志（SCF 日志可在控制台查看）
      console.log(JSON.stringify({
        event: 'signup',
        parent: parent_name,
        phone,
        child: child_name,
        age: child_age,
        contact: contact || '',
        notes: notes || '',
        time: time || new Date().toISOString()
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: '报名成功' }) };
    }

    // ② 教师认证
    if (body.password) {
      if (body.password === valid) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, token: 'teacher_' + Date.now() }) };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: '密码错误' }) };
    }

    // ③ 查看报名列表（需密码）
    if (body.action === 'list_signups') {
      if (body.token !== 'teacher_' + Date.now() && body.password !== valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: '无权限' }) };
      }
      // SCF 无法持久化存储，返回空（报名数据在 SCF 日志中查看）
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, signups: [], note: '请在SCF控制台查看函数日志获取报名数据' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: '无效请求' }) };

  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: '无效请求' }) };
  }
};
