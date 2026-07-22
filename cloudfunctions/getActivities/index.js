const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { date, storeId } = event
  const query = {}
  if (date) query.date = date
  if (storeId !== undefined && storeId !== null) query.storeId = storeId

  const res = await db.collection('activities')
    .where(query)
    .orderBy('startTime', 'asc')
    .limit(50)
    .get()

  return { code: 0, list: res.data }
}
