const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { price, productName, productId, outTradeNo, realPrice } = event

  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  const nick = userRes.data.length ? userRes.data[0].nick || '' : ''

  try {
    await db.collection('balanceLogs').add({
      data: {
        openid: OPENID,
        nick,
        type: 'consume',
        rechargeAmount: -price,
        giftAmount: 0,
        note: productName,
        productId: productId || null,
        realPrice: realPrice || price,
        method: 'wechat',
        outTradeNo: outTradeNo || '',
        createdAt: db.serverDate(),
      },
    })
    return { code: 0 }
  } catch (e) {
    return { code: 1, msg: e.message }
  }
}
