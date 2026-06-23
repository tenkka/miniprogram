const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { tableId, arrivalTime } = event

  if (!tableId) return { code: 1, msg: '参数错误' }

  // 验证桌台
  const tableRes = await db.collection('tables').doc(tableId).get().catch(() => null)
  if (!tableRes) return { code: 2, msg: '桌台不存在' }
  const table = tableRes.data
  if (!table.isOpen) return { code: 2, msg: '该桌台暂未开放' }

  // 检查是否已预约过该桌台
  const existRes = await db.collection('bookings').where({
    tableId,
    openid: OPENID,
    status: _.in(['pending', 'confirmed']),
  }).get()
  if (existRes.data.length > 0) return { code: 3, msg: '您已预约该桌台' }

  // 当前座位占用数
  const seatRes = await db.collection('bookings').where({
    tableId,
    type: 'booking',
    status: _.in(['pending', 'confirmed', 'seated']),
  }).count()
  const seatCount = seatRes.total

  // 获取用户信息（用于存到预约记录）
  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  const userInfo = userRes.data[0] || {}

  let type, queueNo = 0

  if (seatCount >= table.maxplayer) {
    // 满座 → 排队
    type = 'queue'
    const queueRes = await db.collection('bookings').where({
      tableId,
      type: 'queue',
      status: _.in(['pending', 'confirmed']),
    }).count()
    queueNo = queueRes.total + 1
  } else {
    type = 'booking'
    if (!arrivalTime) return { code: 4, msg: '请选择到场时间' }
  }

  await db.collection('bookings').add({
    data: {
      tableId,
      tableName: table.name,
      openid: OPENID,
      nick: userInfo.nick || '',
      avatarUrl: userInfo.avatarUrl || '',
      type,
      arrivalTime: arrivalTime || '',
      queueNo,
      status: 'pending',
      createdAt: db.serverDate(),
    },
  })

  return { code: 0, type, queueNo }
}
