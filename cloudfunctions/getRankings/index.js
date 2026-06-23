const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const TOP_N = 20

async function resolveAvatarUrls(items) {
  const ids = [...new Set(items.map(i => i.avatarUrl).filter(u => u && u.startsWith('cloud://')))]
  if (!ids.length) return items
  try {
    const res = await cloud.getTempFileURL({ fileList: ids })
    const map = {}
    res.fileList.forEach(f => { if (f.status === 0) map[f.fileID] = f.tempFileURL })
    return items.map(i => (i.avatarUrl && map[i.avatarUrl] ? { ...i, avatarUrl: map[i.avatarUrl] } : i))
  } catch (e) {
    return items
  }
}

async function queryTop(field) {
  const res = await db.collection('users')
    .where(_.and([
      { nick: _.neq('') },
      { [field]: _.gt(0) }
    ]))
    .orderBy(field, 'desc')
    .limit(TOP_N)
    .field({ nick: true, avatarUrl: true, [field]: true })
    .get()
  return res.data
}

exports.main = async () => {
  const [power, champion] = await Promise.all([
    queryTop('power'),
    queryTop('champion'),
  ])
  const [resolvedPower, resolvedChampion] = await Promise.all([
    resolveAvatarUrls(power),
    resolveAvatarUrls(champion),
  ])
  return { power: resolvedPower, champion: resolvedChampion }
}
