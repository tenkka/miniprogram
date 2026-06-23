const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { password } = event
  if (!password) return { code: 1, msg: '请输入密码' }
  try {
    const res = await db.collection('admins').where({ openid: OPENID, password }).get()
    if (res.data.length > 0) return { code: 0 }
    return { code: 1, msg: '密码错误或无管理员权限' }
  } catch (e) {
    return { code: 2, msg: '验证失败，请重试' }
  }
}
