const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// event: { amount, source, sourceId, description }
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const { amount, source, sourceId, description } = event
  if (!amount || amount <= 0) return { code: -2, msg: '积分数量无效' }

  // Idempotency: prevent double credit for same source event
  if (sourceId) {
    const exists = await db.collection('points_transactions')
      .where({ openid: OPENID, sourceId, type: 'earn' })
      .count()
    if (exists.total > 0) return { code: 1, msg: '已入账', duplicate: true }
  }

  const accountRes = await db.collection('user_points').where({ openid: OPENID }).get()
  const balanceBefore = accountRes.data.length ? (accountRes.data[0].balance || 0) : 0
  const balanceAfter = balanceBefore + amount

  if (accountRes.data.length === 0) {
    await db.collection('user_points').add({
      data: {
        openid: OPENID,
        balance: amount,
        totalEarned: amount,
        totalSpent: 0,
        updatedAt: db.serverDate(),
      },
    })
  } else {
    await db.collection('user_points').doc(accountRes.data[0]._id).update({
      data: {
        balance: _.inc(amount),
        totalEarned: _.inc(amount),
        updatedAt: db.serverDate(),
      },
    })
  }

  await db.collection('points_transactions').add({
    data: {
      openid: OPENID,
      delta: amount,
      type: 'earn',
      source: source || 'manual',
      sourceId: sourceId || null,
      description: description || `获得${amount}积分`,
      balanceBefore,
      balanceAfter,
      createdAt: db.serverDate(),
    },
  })

  return { code: 0, balance: balanceAfter }
}
