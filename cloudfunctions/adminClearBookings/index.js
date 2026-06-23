const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }
  } catch (e) {
    return { code: 1, msg: '无管理员权限' }
  }

  let deleted = 0
  // Loop in batches of 100 until the collection is empty
  while (true) {
    const res = await db.collection('bookings').limit(100).get()
    if (res.data.length === 0) break
    await Promise.all(res.data.map(b => db.collection('bookings').doc(b._id).remove()))
    deleted += res.data.length
    if (res.data.length < 100) break
  }

  return { code: 0, deleted }
}
