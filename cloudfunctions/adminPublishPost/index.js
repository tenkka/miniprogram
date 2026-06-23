const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

  const { content, imageFileIds = [] } = event
  if (!content && imageFileIds.length === 0) return { code: 2, msg: '内容不能为空' }

  await db.collection('posts').add({
    data: {
      openid: OPENID,
      content: content || '',
      imageUrl: imageFileIds[0] || '',
      images: imageFileIds,
      pinned: false,
      likes: 0,
      createdAt: db.serverDate(),
    },
  })

  return { code: 0 }
}
