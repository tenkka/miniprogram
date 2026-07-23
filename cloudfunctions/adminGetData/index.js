const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function isAdmin(openid) {
  try {
    const res = await db.collection('admins').where({ openid }).count()
    return res.total > 0
  } catch (e) {
    return false
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!(await isAdmin(OPENID))) return { code: 1, msg: '无管理员权限' }

  const [tablesRes, bookingsRes, postsRes, storesRes] = await Promise.all([
    db.collection('tables').orderBy('storeId', 'asc').orderBy('sort', 'asc').get(),
    db.collection('bookings')
      .where({ status: _.in(['pending', 'confirmed', 'seated']) })
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get(),
    db.collection('posts').orderBy('createdAt', 'desc').limit(50).get().catch(() => ({ data: [] })),
    db.collection('stores').limit(100).get().catch(() => ({ data: [] })),
  ])

  const posts = postsRes.data
  const bookings = bookingsRes.data

  // Collect all cloud:// fileIDs to resolve at once
  const cloudIds = [
    ...posts.map(p => p.imageUrl),
    ...bookings.map(b => b.avatarUrl),
  ].filter(u => u && u.startsWith('cloud://'))
  const uniqueIds = [...new Set(cloudIds)]

  if (uniqueIds.length > 0) {
    try {
      const tmpRes = await cloud.getTempFileURL({ fileList: uniqueIds.slice(0, 50) })
      const urlMap = {}
      tmpRes.fileList.forEach(f => { if (f.status === 0) urlMap[f.fileID] = f.tempFileURL })
      posts.forEach(p => { if (urlMap[p.imageUrl]) p.imageUrl = urlMap[p.imageUrl] })
      bookings.forEach(b => { if (urlMap[b.avatarUrl]) b.avatarUrl = urlMap[b.avatarUrl] })
    } catch (e) {}
  }

  // Build storeId → name map and enrich tables
  const storeMap = {}
  storesRes.data.forEach(s => { storeMap[s.id] = s.name })
  const tables = tablesRes.data.map(t => ({
    ...t,
    storeName: storeMap[t.storeId] || String(t.storeId),
  }))

  return { code: 0, tables, bookings, posts }
}
