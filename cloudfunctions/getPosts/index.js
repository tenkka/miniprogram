const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async () => {
  // 置顶帖 + 普通帖分开查，合并后返回
  const [pinnedRes, normalRes] = await Promise.all([
    db.collection('posts')
      .where({ pinned: true })
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get(),
    db.collection('posts')
      .where({ pinned: _.neq(true) })
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get(),
  ])

  const posts = [...pinnedRes.data, ...normalRes.data]

  // 将 cloud:// fileID 转为可访问的临时 URL
  const fileIDs = posts.map(p => p.imageUrl).filter(url => url && url.startsWith('cloud://'))
  if (fileIDs.length > 0) {
    const tmpRes = await cloud.getTempFileURL({ fileList: fileIDs })
    const urlMap = {}
    tmpRes.fileList.forEach(f => { urlMap[f.fileID] = f.tempFileURL })
    posts.forEach(p => {
      if (p.imageUrl && urlMap[p.imageUrl]) p.imageUrl = urlMap[p.imageUrl]
    })
  }

  return { posts }
}
