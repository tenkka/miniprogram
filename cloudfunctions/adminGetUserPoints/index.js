const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function isAdmin(openid) {
  try {
    const res = await db.collection('admins').where({ openid }).count()
    return res.total > 0
  } catch (e) { return false }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!(await isAdmin(OPENID))) return { code: -1, msg: '无权限' }

  const { targetOpenid } = event
  if (!targetOpenid) return { code: -2, msg: '缺少目标用户' }

  const res = await db.collection('user_points').where({ openid: targetOpenid }).get()
  const account = res.data[0] || { balance: 0, totalEarned: 0, totalSpent: 0 }

  return {
    code: 0,
    balance: account.balance || 0,
    totalEarned: account.totalEarned || 0,
    totalSpent: account.totalSpent || 0,
  }
}
