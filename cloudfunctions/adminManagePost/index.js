const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { postId, action, value } = event

  if (!postId || !action) return { code: 1, msg: '参数错误' }

  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count()
    if (adminRes.total === 0) return { code: 1, msg: '无管理员权限' }
  } catch (e) {
    return { code: 1, msg: '无管理员权限' }
  }

  if (action === 'delete') {
    await db.collection('posts').doc(postId).remove()
  } else if (action === 'togglePin') {
    await db.collection('posts').doc(postId).update({ data: { pinned: value } })
  } else {
    return { code: 1, msg: '未知操作' }
  }

  return { code: 0 }
}
