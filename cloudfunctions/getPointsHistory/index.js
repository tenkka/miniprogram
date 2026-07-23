const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const { page = 0, size = 20 } = event
  const res = await db.collection('points_transactions')
    .where({ openid: OPENID })
    .orderBy('createdAt', 'desc')
    .skip(page * size)
    .limit(size)
    .get()

  return { code: 0, list: res.data, page, hasMore: res.data.length === size }
}
