const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveAvatarUrls(items) {
  const ids = [...new Set(items.map(i => i.avatarUrl).filter(u => u && u.startsWith('cloud://')))]
  if (!ids.length) return items
  try {
    const res = await cloud.getTempFileURL({ fileList: ids.slice(0, 50) })
    const map = {}
    res.fileList.forEach(f => { if (f.status === 0) map[f.fileID] = f.tempFileURL })
    return items.map(i => (i.avatarUrl && map[i.avatarUrl] ? { ...i, avatarUrl: map[i.avatarUrl] } : i))
  } catch (e) {
    return items
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }
  } catch (e) {
    return { code: 1, msg: '无管理员权限' }
  }

  const res = await db.collection('users')
    .orderBy('nick', 'asc')
    .limit(500)
    .field({ openid: true, nick: true, avatarUrl: true, power: true, champion: true, rechargeBalance: true, giftBalance: true, phone: true })
    .get()

  const users = await resolveAvatarUrls(res.data)
  return { code: 0, users }
}
