const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const VALID_STATUSES = ['pending', 'confirmed', 'seated', 'cancelled']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookingId, status } = event

  if (!bookingId || !VALID_STATUSES.includes(status)) return { code: 1, msg: '参数错误' }

  let isAdmin = false
  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    isAdmin = adminRes.total > 0
  } catch (e) {
    // admins 集合尚未创建
  }
  if (!isAdmin) return { code: 3, msg: '无管理员权限' }

  await db.collection('bookings').doc(bookingId).update({
    data: { status, updatedAt: db.serverDate() },
  })

  return { code: 0 }
}
