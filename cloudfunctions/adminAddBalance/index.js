const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { targetOpenid, rechargeAmount, giftAmount, note } = event

  const adminRes = await db.collection('admins').where({ openid: OPENID }).count().catch(() => ({ total: 0 }))
  if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }

  const recharge = Number(rechargeAmount) || 0
  const gift = Number(giftAmount) || 0
  if (recharge === 0 && gift === 0) return { code: 1, msg: '请输入金额' }

  const userRes = await db.collection('users').where({ openid: targetOpenid }).get()
  if (userRes.data.length === 0) return { code: 1, msg: '用户不存在' }
  const user = userRes.data[0]

  await db.collection('users').doc(user._id).update({
    data: {
      rechargeBalance: _.inc(recharge),
      giftBalance: _.inc(gift),
    },
  })

  await db.collection('balanceLogs').add({
    data: {
      openid: targetOpenid,
      nick: user.nick || '',
      type: 'admin_add',
      rechargeAmount: recharge,
      giftAmount: gift,
      note: note || '',
      operatorOpenid: OPENID,
      createdAt: db.serverDate(),
    },
  })

  return { code: 0, msg: '余额已添加' }
}
