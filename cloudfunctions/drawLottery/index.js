const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 10 扇区固定顺序（前端转盘按此顺序绘制，index 与扇区一一对应）
// type: none=谢谢参与 / power=加积分 / gift=加赠送余额
const PRIZES = [
  { index: 0, name: '谢谢参与', type: 'none', value: 0 },
  { index: 1, name: '5000积分', type: 'power', value: 5000 },
  { index: 2, name: '3000积分', type: 'power', value: 3000 },
  { index: 3, name: '1000积分', type: 'power', value: 1000 },
  { index: 4, name: '50元代金券', type: 'gift', value: 50 },
  { index: 5, name: '5元代金券', type: 'gift', value: 5 },
  { index: 6, name: '10元代金券', type: 'gift', value: 10 },
  { index: 7, name: '100积分', type: 'power', value: 100 },
  { index: 8, name: '200积分', type: 'power', value: 200 },
  { index: 9, name: '500积分', type: 'power', value: 500 },
]
// 中奖权重（与 PRIZES 数组下标一一对应）
// 代金券爆率最低；积分类：价值越低权重越高
// index: 0=谢谢参与 1=5000积分 2=3000积分 3=1000积分 4=50元券 5=5元券 6=10元券 7=+100 8=+200 9=+500
const WEIGHTS = [15, 2, 3, 5, 1, 2, 1, 25, 18, 12]
// 合计84，各项概率约：谢谢参与17.9% / 5000积分2.4% / 3000积分3.6% / 1000积分6.0%
//   50元券1.2% / 5元券2.4% / 10元券1.2% / +100积分29.8% / +200积分21.4% / +500积分14.3%

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
