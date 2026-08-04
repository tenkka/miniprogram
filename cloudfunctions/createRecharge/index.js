const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 微信支付成功后调用，将充值金额写入用户余额并记录流水
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { rechargeAmount, giftAmount, outTradeNo, storeId, storeName } = event

  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  if (!userRes.data.length) return { code: 1, msg: '用户不存在' }
  const user = userRes.data[0]

  await db.collection('users').doc(user._id).update({
    data: {
      rechargeBalance: _.inc(rechargeAmount),
      giftBalance: _.inc(giftAmount),
    },
  })

  await db.collection('balanceLogs').add({
    data: {
      openid: OPENID,
      nick: user.nick || '',
      type: 'recharge',
      rechargeAmount,
      giftAmount,
      note: `自助充值 ¥${rechargeAmount}`,
      method: 'wechat',
      outTradeNo: outTradeNo || '',
      storeId: storeId || '',
      storeName: storeName || '',
      createdAt: db.serverDate(),
    },
  })

  return { code: 0 }
}
