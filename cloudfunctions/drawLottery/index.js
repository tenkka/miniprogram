const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 10 扇区固定顺序（前端转盘按此顺序绘制，index 与扇区一一对应）
// type: none=谢谢参与 / power=加积分 / gift=加赠送余额
const PRIZES = [
  { index: 0, name: '谢谢参与', type: 'none', value: 0 },
  { index: 1, name: '5000积分券', type: 'power', value: 5000 },
  { index: 2, name: '3000积分券', type: 'power', value: 3000 },
  { index: 3, name: '1000积分券', type: 'power', value: 1000 },
  { index: 4, name: '50元代金券', type: 'gift', value: 50 },
  { index: 5, name: '5元代金券', type: 'gift', value: 5 },
  { index: 6, name: '10元代金券', type: 'gift', value: 10 },
  { index: 7, name: '+100积分带入', type: 'power', value: 100 },
  { index: 8, name: '+200积分带入', type: 'power', value: 200 },
  { index: 9, name: '+500积分带入', type: 'power', value: 500 },
]
// 中奖权重（店主可改）。本期各 10% 等概率。
const WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

function pickPrize() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i]
    if (r < 0) return PRIZES[i]
  }
  return PRIZES[PRIZES.length - 1]
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  if (!userRes.data.length) return { code: 1, msg: '用户不存在' }
  const user = userRes.data[0]

  const tickets = user.lotteryTickets || 0
  if (tickets <= 0) return { code: 2, msg: '抽奖次数不足，去签到获取吧' }

  const prize = pickPrize()

  // 扣减次数 + 发放奖品
  const updateData = { lotteryTickets: _.inc(-1) }
  if (prize.type === 'power') updateData.power = _.inc(prize.value)
  if (prize.type === 'gift') updateData.giftBalance = _.inc(prize.value)
  await db.collection('users').doc(user._id).update({ data: updateData })

  // 代金券记一笔余额流水
  if (prize.type === 'gift') {
    await db.collection('balanceLogs').add({
      data: {
        openid: OPENID,
        nick: user.nick || '',
        type: 'lottery',
        rechargeAmount: 0,
        giftAmount: prize.value,
        note: `抽奖中奖：${prize.name}`,
        createdAt: db.serverDate(),
      },
    })
  }
  // 积分奖品记一笔积分流水
  if (prize.type === 'power') {
    await db.collection('scoreLogs').add({
      data: {
        openid: OPENID,
        type: 'lottery',
        score: prize.value,
        note: `抽奖中奖：${prize.name}`,
        createdAt: db.serverDate(),
      },
    })
  }

  // 中奖记录
  await db.collection('lotteryLogs').add({
    data: {
      openid: OPENID,
      nick: user.nick || '',
      prizeIndex: prize.index,
      prizeName: prize.name,
      prizeType: prize.type,
      prizeValue: prize.value,
      createdAt: db.serverDate(),
    },
  })

  return {
    code: 0,
    prizeIndex: prize.index,
    prize: { name: prize.name, type: prize.type, value: prize.value },
    ticketsLeft: tickets - 1,
  }
}
