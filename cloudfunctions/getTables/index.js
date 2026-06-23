const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function resolveBookingAvatars(tables) {
  const allBookings = tables.flatMap(t => t.seatBookings)
  const ids = [...new Set(allBookings.map(b => b.avatarUrl).filter(u => u && u.startsWith('cloud://')))]
  if (!ids.length) return tables
  try {
    const res = await cloud.getTempFileURL({ fileList: ids.slice(0, 50) })
    const map = {}
    res.fileList.forEach(f => { if (f.status === 0) map[f.fileID] = f.tempFileURL })
    return tables.map(t => ({
      ...t,
      seatBookings: t.seatBookings.map(b =>
        b.avatarUrl && map[b.avatarUrl] ? { ...b, avatarUrl: map[b.avatarUrl] } : b
      ),
    }))
  } catch (e) {
    return tables
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storeId } = event

  const query = { isOpen: true }
  if (storeId) query.storeId = storeId

  const tablesRes = await db.collection('tables')
    .where(query)
    .orderBy('sort', 'asc')
    .get()
  const tables = tablesRes.data
  if (tables.length === 0) return { tables: [], isAdmin: false }

  const tableIds = tables.map(t => t._id)

  const bookingsRes = await db.collection('bookings')
    .where({
      tableId: _.in(tableIds),
      status: _.in(['pending', 'confirmed', 'seated']),
    })
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get()
  const allBookings = bookingsRes.data

  // 按桌台分组
  const seatMap = {}       // tableId -> count
  const queueMap = {}      // tableId -> count
  const myBookingMap = {}  // tableId -> my booking
  const seatBookingsMap = {} // tableId -> [booking records for seat display]

  for (const b of allBookings) {
    if (b.type === 'booking') {
      seatMap[b.tableId] = (seatMap[b.tableId] || 0) + 1
      if (!seatBookingsMap[b.tableId]) seatBookingsMap[b.tableId] = []
      seatBookingsMap[b.tableId].push({
        _id: b._id,
        nick: b.nick || '',
        avatarUrl: b.avatarUrl || '',
        status: b.status,
        openid: b.openid,
      })
    } else if (b.type === 'queue') {
      queueMap[b.tableId] = (queueMap[b.tableId] || 0) + 1
    }
    if (b.openid === OPENID && !myBookingMap[b.tableId]) {
      myBookingMap[b.tableId] = b
    }
  }

  // 管理员判断
  let isAdmin = false
  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    isAdmin = adminRes.total > 0
  } catch (e) {}

  const result = tables.map(t => ({
    ...t,
    seatCount: seatMap[t._id] || 0,
    queueCount: queueMap[t._id] || 0,
    isFull: (seatMap[t._id] || 0) >= t.maxplayer,
    myBooking: myBookingMap[t._id] || null,
    seatBookings: seatBookingsMap[t._id] || [],
  }))

  const resolvedTables = await resolveBookingAvatars(result)
  return { tables: resolvedTables, isAdmin }
}
