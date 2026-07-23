const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function isAdmin(openid) {
  try {
    const res = await db.collection('admins').where({ openid }).count()
    return res.total > 0
  } catch (e) { return false }
}

// Admin-only: add or deduct points for any user by openid
// event: { targetOpenid, amount, description }
// amount: positive = add, negative = deduct
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!(await isAdmin(OPENID))) return { code: -1, msg: '无权限' }

  const { targetOpenid, amount, description } = event
  if (!targetOpenid) return { code: -2, msg: '缺少目标用户' }
  if (!amount || amount === 0) return { code: -3, msg: '积分数量无效' }

  const type = amount > 0 ? 'earn' : 'spend'
  const absAmount = Math.abs(amount)

  const accountRes = await db.collection('user_points').where({ openid: targetOpenid }).get()
  const balanceBefore = accountRes.data.length ? (accountRes.data[0].balance || 0) : 0
  const balanceAfter = balanceBefore + amount

  if (type === 'spend' && balanceAfter < 0) {
    return { code: 2, msg: `积分不足，当前余额 ${balanceBefore}` }
  }

  if (accountRes.data.length === 0) {
    await db.collection('user_points').add({
      data: {
        openid: targetOpenid,
        balance: amount,
        totalEarned: amount > 0 ? amount : 0,
        totalSpent: amount < 0 ? absAmount : 0,
        updatedAt: db.serverDate(),
      },
    })
  } else {
    const updateData = {
      balance: _.inc(amount),
      updatedAt: db.serverDate(),
    }
    if (type === 'earn') updateData.totalEarned = _.inc(absAmount)
    else updateData.totalSpent = _.inc(absAmount)

    await db.collection('user_points').doc(accountRes.data[0]._id).update({ data: updateData })
  }

  await db.collection('points_transactions').add({
    data: {
      openid: targetOpenid,
      delta: amount,
      type,
      source: 'admin',
      sourceId: null,
      description: description || (amount > 0 ? `管理员赠送 ${amount} 积分` : `管理员扣除 ${absAmount} 积分`),
      operatorOpenid: OPENID,
      balanceBefore,
      balanceAfter,
      createdAt: db.serverDate(),
    },
  })

  return { code: 0, balanceBefore, balanceAfter, msg: `操作成功，当前余额 ${balanceAfter}` }
}
