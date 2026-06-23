const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookingId } = event

  if (!bookingId) return { code: 1, msg: '参数错误' }

  const res = await db.collection('bookings').doc(bookingId).get().catch(() => null)
  if (!res) return { code: 2, msg: '预约记录不存在' }

  const booking = res.data
  if (booking.openid !== OPENID) return { code: 3, msg: '无权操作' }
  if (booking.status === 'cancelled') return { code: 4, msg: '已取消' }

  await db.collection('bookings').doc(bookingId).update({
    data: { status: 'cancelled', cancelledAt: db.serverDate() },
  })

  return { code: 0 }
}
