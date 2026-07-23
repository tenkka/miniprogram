const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const [accountRes, txRes] = await Promise.all([
    db.collection('user_points').where({ openid: OPENID }).get(),
    db.collection('points_transactions')
      .where({ openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
  ])

  const account = accountRes.data[0] || { balance: 0, totalEarned: 0, totalSpent: 0 }

  return {
    code: 0,
    balance: account.balance || 0,
    totalEarned: account.totalEarned || 0,
    totalSpent: account.totalSpent || 0,
    transactions: txRes.data,
  }
}
