const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { tableId } = event

  if (!tableId) return { code: 1, msg: '参数错误' }

  const [tableRes, bookingsRes] = await Promise.all([
    db.collection('tables').doc(tableId).get(),
    db.collection('bookings')
      .where({ tableId, status: _.neq('cancelled') })
      .orderBy('createdAt', 'asc')
      .limit(50)
      .get(),
  ])

  const table = tableRes.data
  const bookings = bookingsRes.data

  let isAdmin = false
  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    isAdmin = adminRes.total > 0
  } catch (e) {
    // admins 集合尚未创建，视为无管理员
  }

  const myBooking = bookings.find(b => b.openid === OPENID) || null

  return { code: 0, table, bookings, myBooking, isAdmin }
}
