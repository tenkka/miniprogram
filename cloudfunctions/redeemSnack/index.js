const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const { itemId, qty = 1 } = event
  if (!itemId || qty < 1) return { code: -2, msg: '参数无效' }

  // Fetch item
  let item
  try {
    const itemRes = await db.collection('snack_items').doc(itemId).get()
    item = itemRes.data
  } catch (e) {
    return { code: 3, msg: '商品不存在' }
  }
  if (!item.isActive) return { code: 4, msg: '商品已下架' }

  const totalPoints = item.pointsCost * qty

  // Fetch user account
  const accountRes = await db.collection('user_points').where({ openid: OPENID }).get()
  const account = accountRes.data[0]
  const balance = account ? (account.balance || 0) : 0
  if (balance < totalPoints) return { code: 2, msg: `积分不足，还差 ${totalPoints - balance} 积分` }

  const balanceBefore = balance
  const balanceAfter = balance - totalPoints

  // Deduct points (atomic increment)
  await db.collection('user_points').doc(account._id).update({
    data: {
      balance: _.inc(-totalPoints),
      totalSpent: _.inc(totalPoints),
      updatedAt: db.serverDate(),
    },
  })


  // Write points transaction
  const txRes = await db.collection('points_transactions').add({
    data: {
      openid: OPENID,
      delta: -totalPoints,
      type: 'spend',
      source: 'redeem',
      sourceId: null,
      description: `兑换 ${item.name}${qty > 1 ? ` x${qty}` : ''}`,
      balanceBefore,
      balanceAfter,
      createdAt: db.serverDate(),
    },
  })

  // Write redeem order
  await db.collection('redeem_orders').add({
    data: {
      openid: OPENID,
      itemId,
      itemName: item.name,
      qty,
      totalPoints,
      transactionId: txRes._id,
      status: 'pending',
      createdAt: db.serverDate(),
    },
  })

  return { code: 0, balanceAfter, msg: `兑换成功！消耗 ${totalPoints} 积分` }
}
