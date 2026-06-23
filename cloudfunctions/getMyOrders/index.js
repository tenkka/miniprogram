const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('balanceLogs')
    .where({ openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return { code: 0, list: res.data }
}
