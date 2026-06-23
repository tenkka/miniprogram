const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { userId, power, champion } = event

  if (!userId) return { code: 1, msg: '参数错误' }

  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }
  } catch (e) {
    return { code: 1, msg: '无管理员权限' }
  }

  const updates = {}
  if (typeof power === 'number' && power >= 0) updates.power = power
  if (typeof champion === 'number' && champion >= 0) updates.champion = champion

  await db.collection('users').doc(userId).update({ data: updates })
  return { code: 0 }
}
