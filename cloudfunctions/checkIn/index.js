const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// Sync into new points system (idempotent via sourceId)
async function syncNewPoints(openid, amount, sourceId, description) {
  try {
    const exists = await db.collection('points_transactions')
      .where({ openid, sourceId, type: 'earn' })
      .count()
    if (exists.total > 0) return

    const accountRes = await db.collection('user_points').where({ openid }).get()
    const balanceBefore = accountRes.data.length ? (accountRes.data[0].balance || 0) : 0

    if (accountRes.data.length === 0) {
      await db.collection('user_points').add({
        data: { openid, balance: amount, totalEarned: amount, totalSpent: 0, updatedAt: db.serverDate() },
      })
    } else {
      await db.collection('user_points').doc(accountRes.data[0]._id).update({
        data: { balance: _.inc(amount), totalEarned: _.inc(amount), updatedAt: db.serverDate() },
      })
    }

    await db.collection('points_transactions').add({
      data: {
        openid, delta: amount, type: 'earn', source: 'checkin', sourceId, description,
        balanceBefore, balanceAfter: balanceBefore + amount, createdAt: db.serverDate(),
      },
    })
  } catch (e) {
    // Non-fatal: new system sync failure does not block checkin
    console.error('syncNewPoints error:', e)
  }
}

const POINTS = [10, 20, 30, 40, 60, 80, 100]

function getDateStr(offsetDays = 0) {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000)
  return utc8.toISOString().slice(0, 10)
}

function getWeekRange() {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 3600 * 1000)
  const day = utc8.getUTCDay()
  const daysFromMon = day === 0 ? 6 : day - 1
  const monday = new Date(utc8.getTime() - daysFromMon * 86400 * 1000)
  const sunday = new Date(monday.getTime() + 6 * 86400 * 1000)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const today = getDateStr(0)
  const { start: weekStart, end: weekEnd } = getWeekRange()

  // 今天已签到？
  const todayRes = await db.collection('checkIns').where({ openid: OPENID, date: today }).count()
  if (todayRes.total > 0) return { code: 1, msg: '今日已签到', todayCheckedIn: true }

  // 本周已签到次数（不含今天）
  const weekRes = await db.collection('checkIns').where({
    openid: OPENID,
    date: _.gte(weekStart).and(_.lte(weekEnd)),
  }).count()

  // 本周第 N 次签到（断签不影响计数）
  const streak = Math.min(weekRes.total + 1, 7)
  const points = POINTS[streak - 1]

  // 签到加积分，同时 +1 抽奖次数
  await db.collection('users').where({ openid: OPENID }).update({
    data: { power: _.inc(points), lotteryTickets: _.inc(1) },
  })

  await db.collection('checkIns').add({
    data: { openid: OPENID, date: today, streak, points, createdAt: db.serverDate() },
  })

  // Sync into new points system
  await syncNewPoints(OPENID, points, `checkin_${today}`, `签到奖励 +${points}积分`)

  return { code: 0, streak, points, todayCheckedIn: true }
}
