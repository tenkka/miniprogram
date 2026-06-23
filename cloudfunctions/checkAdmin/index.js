const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  try {
    const res = await db.collection('admins').where({ openid: OPENID }).count()
    return { isAdmin: res.total > 0 }
  } catch (e) {
    return { isAdmin: false }
  }
}
