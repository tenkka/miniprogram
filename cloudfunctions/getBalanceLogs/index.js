const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const [userRes, logsRes] = await Promise.all([
    db.collection('users')
      .where({ openid: OPENID })
      .field({ rechargeBalance: true, giftBalance: true })
      .get(),
    db.collection('balanceLogs')
      .where({ openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(100)
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
