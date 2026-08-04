const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { storeId } = event

  const query = { isActive: true }
  if (storeId !== undefined && storeId !== null) {
    query.store = storeId
  }

  const res = await db.collection('snack_items')
    .where(query)
    .orderBy('sortOrder', 'asc')
    .limit(50)
    .get()

  const list = res.data

  // Resolve cloud:// image URLs to temp URLs
  const cloudIds = list.map(i => i.image).filter(u => u && u.startsWith('cloud://'))
  if (cloudIds.length > 0) {
    try {
      const tmpRes = await cloud.getTempFileURL({ fileList: cloudIds })
      const urlMap = {}
      tmpRes.fileList.forEach(f => { if (f.status === 0) urlMap[f.fileID] = f.tempFileURL })
      list.forEach(item => {
        if (item.image && urlMap[item.image]) item.image = urlMap[item.image]
      })
    } catch (e) {}
  }

  return { code: 0, list }
}
