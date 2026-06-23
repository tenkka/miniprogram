const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}
async function genUniqueInviteCode() {
  for (let i = 0; i < 8; i++) {
    const code = genCode()
    const exist = await db.collection('users').where({ inviteCode: code }).count()
    if (exist.total === 0) return code
  }
  return genCode() + String(Date.now()).slice(-2)
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const meRes = await db.collection('users').where({ openid: OPENID }).get()
  if (!meRes.data.length) return { code: 1, msg: '用户不存在' }
  const me = meRes.data[0]

  // 兼容老用户：无邀请码则补发
  let inviteCode = me.inviteCode
  if (!inviteCode) {
    inviteCode = await genUniqueInviteCode()
    await db.collection('users').doc(me._id).update({ data: { inviteCode } })
  }

  // 是否还能作为新人填写邀请码：未绑定 且 无套餐购买
  const canBind = !me.referrer && !me.firstPurchaseAt

  // 我作为邀请人的战绩
  const refRes = await db.collection('referrals')
    .where({ inviterOpenid: OPENID })
    .orderBy('boundAt', 'desc')
    .limit(100)
    .get()

  const list = refRes.data.map(r => ({
    inviteeNick: r.inviteeNick || '好友',
    status: r.status,
    rewardPower: r.rewardPower || 0,
    boundAt: r.boundAt,
  }))
  const totalInvited = list.length
  const totalReward = list.reduce((sum, r) => sum + (r.rewardPower || 0), 0)

  return {
    code: 0,
    inviteCode,
    canBind,
    bound: !!me.referrer,
    isOldCustomer: !!me.firstPurchaseAt,
    list,
    totalInvited,
    totalReward,
  }
}
