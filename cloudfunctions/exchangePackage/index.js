const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 与 getLotteryData 一致的兑换商城配置（服务端定价防篡改）
const EXCHANGE_ITEMS = {
  combo398: { name: '398 酒水套餐', comboPrice: 398, cost: 30000 },
  combo218: { name: '218 酒水套餐', comboPrice: 218, cost: 18888 },
  combo138: { name: '138 酒水套餐', comboPrice: 138, cost: 12888 },
}

// 生成到店核销用兑换码
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
  let s = ''
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const { itemId } = event
  const item = EXCHANGE_ITEMS[itemId]
  if (!item) return { code: 1, msg: '兑换项不存在' }

  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  if (!userRes.data.length) return { code: 1, msg: '用户不存在' }
  const user = userRes.data[0]

  if ((user.power || 0) < item.cost) {
    return { code: 2, msg: '积分不足' }
  }

  // 扣减积分
  await db.collection('users').doc(user._id).update({
    data: { power: _.inc(-item.cost) },
  })

  const code = genCode()
  const orderRes = await db.collection('exchangeOrders').add({
    data: {
      openid: OPENID,
      nick: user.nick || '',
      itemId,
      itemName: item.name,
      comboPrice: item.comboPrice,
      costPower: item.cost,
      code,
      status: 'pending',
      createdAt: db.serverDate(),
    },
  })

  await db.collection('scoreLogs').add({
    data: {
      openid: OPENID,
      type: 'exchange',
      score: -item.cost,
      note: `积分兑换：${item.name}`,
      createdAt: db.serverDate(),
    },
  })

  return { code: 0, msg: '兑换成功', exchangeCode: code, orderId: orderRes._id, powerLeft: (user.power || 0) - item.cost }
}
