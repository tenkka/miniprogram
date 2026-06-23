const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const res = await db.collection('banners')
    .where({ active: true })
    .orderBy('sortOrder', 'asc')
    .limit(10)
    .get()

  const list = res.data
  if (!list.length) return { code: 0, list: [] }

  // 收集所有需要解析的 cloud:// URL
  const cloudUrls = []
  list.forEach(b => {
    if (b.imageUrl && b.imageUrl.startsWith('cloud://')) cloudUrls.push(b.imageUrl)
    if (b.detailImageUrl && b.detailImageUrl.startsWith('cloud://')) cloudUrls.push(b.detailImageUrl)
  })

  let urlMap = {}
  if (cloudUrls.length) {
    const unique = [...new Set(cloudUrls)]
    const r = await cloud.getTempFileURL({ fileList: unique })
    r.fileList.forEach(f => { if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
  }

  const resolve = url => (url && url.startsWith('cloud://') ? urlMap[url] || '' : url || '')

  return {
    code: 0,
    list: list.map(b => ({
      _id: b._id,
      imageUrl: resolve(b.imageUrl),
      detailImageUrl: resolve(b.detailImageUrl),
      sortOrder: b.sortOrder,
    })),
  }
}
