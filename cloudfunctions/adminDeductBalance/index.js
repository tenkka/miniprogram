const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { targetOpenid, amount, note } = event

  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }
  } catch (e) {
    return { code: 1, msg: '无管理员权限' }
  }

  if (!amount || amount <= 0) return { code: 1, msg: '划扣金额必须大于0' }

  const userRes = await db.collection('users').where({ openid: targetOpenid }).get()
  if (!userRes.data.length) return { code: 1, msg: '用户不存在' }

  const user = userRes.data[0]
  const gift = user.giftBalance || 0
  const recharge = user.rechargeBalance || 0
  const total = +(gift + recharge).toFixed(2)

  if (amount > total) return { code: 1, msg: `余额不足，当前余额 ¥${total}` }

  // 赠送额度优先划扣
  const giftDeduct = +Math.min(gift, amount).toFixed(2)
  const rechargeDeduct = +(amount - giftDeduct).toFixed(2)

  await db.collection('users').doc(user._id).update({
    data: {
      giftBalance: _.inc(-giftDeduct),
      rechargeBalance: _.inc(-rechargeDeduct),
    },
  })

  await db.collection('balanceLogs').add({
    data: {
      openid: targetOpenid,
      nick: user.nick || '',
      type: 'consume',
      rechargeAmount: -rechargeDeduct,
      giftAmount: -giftDeduct,
      note: note || '管理员划扣',
      operatorOpenid: OPENID,
      method: 'admin_deduct',
      createdAt: db.serverDate(),
    },
  })

  return {
    code: 0,
    giftDeduct,
    rechargeDeduct,
    remainGift: +(gift - giftDeduct).toFixed(2),
    remainRecharge: +(recharge - rechargeDeduct).toFixed(2),
  }
}
