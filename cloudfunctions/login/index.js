const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 生成 6 位大写字母数字邀请码（去除易混字符 0/O/1/I）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}
// 生成全局唯一邀请码
async function genUniqueInviteCode() {
  for (let i = 0; i < 8; i++) {
    const code = genCode()
    const exist = await db.collection('users').where({ inviteCode: code }).count()
    if (exist.total === 0) return code
  }
  // 极小概率多次冲突，兜底加时间戳后缀
  return genCode() + String(Date.now()).slice(-2)
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const result = await db.collection('users').where({ openid: OPENID }).get()

  let userInfo
  let isNew = false

  if (result.data.length === 0) {
    isNew = true
    const newUser = {
      openid: OPENID,
      nick: '',
      avatarUrl: '',
      score: 0,
      wins: 0,
      totalAmount: 0,
      inviteCode: await genUniqueInviteCode(),
      lotteryTickets: 0,
      createdAt: db.serverDate()
    }
    await db.collection('users').add({ data: newUser })
    userInfo = newUser
  } else {
    userInfo = result.data[0]
    // 有记录但昵称为空也视为新用户，继续引导设置
    isNew = !userInfo.nick
  }

  return {
    openid: OPENID,
    isNew,
    userInfo: {
      nick: userInfo.nick || '',
      avatarUrl: userInfo.avatarUrl || '',
      userLevel: userInfo.userLevel || null,
      phone: userInfo.phone || '',
    }
  }
}
