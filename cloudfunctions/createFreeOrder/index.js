const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { productId, productName, realPrice } = event

  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  const nick = userRes.data.length ? userRes.data[0].nick || '' : ''

  try {
    await db.collection('balanceLogs').add({
      data: {
        openid: OPENID,
        nick,
        type: 'consume',
        rechargeAmount: 0,
        giftAmount: 0,
        note: productName,
        productId: productId,
        realPrice: realPrice,
        method: 'free',
        createdAt: db.serverDate(),
      },
    })
    return { code: 0 }
  } catch (e) {
    return { code: 1, msg: e.message }
  }
}
