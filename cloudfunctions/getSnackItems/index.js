const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { storeId } = event

  const query = { isActive: true }
  // If storeId provided, only return items available at that store
  // store field is an array of store IDs; equality match checks array membership
  if (storeId !== undefined && storeId !== null) {
    query.store = storeId
  }

  const res = await db.collection('snack_items')
    .where(query)
    .orderBy('sortOrder', 'asc')
    .limit(50)
    .get()

  return { code: 0, list: res.data }
}
