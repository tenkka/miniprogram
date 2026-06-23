const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('users')
    .where({ openid: OPENID })
    .field({ rechargeBalance: true, giftBalance: true, phone: true })
    .get()
  if (!res.data.length) return { code: 0, rechargeBalance: 0, giftBalance: 0, phone: '' }
  const u = res.data[0]
  return {
    code: 0,
    rechargeBalance: u.rechargeBalance || 0,
    giftBalance: u.giftBalance || 0,
    phone: u.phone || '',
  }
}
