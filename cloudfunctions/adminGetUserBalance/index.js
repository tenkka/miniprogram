const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { targetOpenid } = event

  const adminRes = await db.collection('admins').where({ openid: OPENID }).count().catch(() => ({ total: 0 }))
  if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }

  const [userRes, logsRes] = await Promise.all([
    db.collection('users')
      .where({ openid: targetOpenid })
      .field({ rechargeBalance: true, giftBalance: true, nick: true })
      .get(),
    db.collection('balanceLogs')
      .where({ openid: targetOpenid })
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get(),
  ])

  const user = userRes.data[0] || {}
  return {
    code: 0,
    rechargeBalance: user.rechargeBalance || 0,
    giftBalance: user.giftBalance || 0,
    logs: logsRes.data,
  }
}
