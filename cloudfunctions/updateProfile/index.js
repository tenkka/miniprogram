const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const updateData = {}
  if (event.nick      !== undefined) updateData.nick      = event.nick
  if (event.avatarUrl !== undefined) updateData.avatarUrl = event.avatarUrl

  if (Object.keys(updateData).length === 0) return { success: false, msg: '无更新字段' }

  const res = await db.collection('users').where({ openid: OPENID }).update({ data: updateData })
  if (res.stats.updated === 0) {
    // 文档不存在时降级为创建
    await db.collection('users').add({
      data: { openid: OPENID, nick: '', avatarUrl: '', score: 0, wins: 0, totalAmount: 0, ...updateData }
    })
  }
  return { success: true }
}
