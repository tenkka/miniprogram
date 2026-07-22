const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const res = await db.collection('stores')
    .orderBy('city', 'asc')
    .orderBy('name', 'asc')
    .limit(100)
    .get()
  return { code: 0, list: res.data }
}
