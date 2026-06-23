const { requireLogin } = require('../../utils/requireLogin')
const AUTH = require('../../utils/auth')

const SPIN_TURNS = 5          // 旋转整圈数
const SPIN_DURATION = 4200    // 与 wxss transition 时长保持一致(ms)

Page({
  data: {
    isLogined: false,
    tickets: 0,
    power: 0,
    prizes: [],          // 10 个奖品（含 index/name/type/value）
    sectorAngle: 36,     // 360/10
    exchangeItems: [],
    records: [],
    spinning: false,
    wheelRotate: 0,
    // 中奖弹窗
    resultShow: false,
    resultPrize: null,
    // 兑换确认
    exchangeConfirmShow: false,
    selectedExchange: null,
    // 兑换结果
    exchangeResultShow: false,
    exchangeCode: '',
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '幸运抽奖' })
  },

  onShow() {
    AUTH.checkHasLogined().then(isLogined => {
      this.setData({ isLogined })
      if (isLogined) this.loadData()
    })
  },

  async loadData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getLotteryData' })
      const r = res.result
      if (r.code === 0) {
        const records = (r.records || []).map(rec => ({
          ...rec,
          timeText: this._formatTime(rec.createdAt),
        }))
        this.setData({
          tickets: r.tickets,
          power: r.power,
          prizes: r.prizes,
          exchangeItems: r.exchangeItems,
          records,
        })
      }
    } catch (e) {
      console.error('getLotteryData error:', e)
    }
  },

  async onDraw() {
    if (!requireLogin()) return
    if (this.data.spinning) return
    if (this.data.tickets <= 0) {
      wx.showModal({
        title: '抽奖次数不足',
        content: '每次签到可获得 1 次抽奖机会，去签到吧～',
        confirmText: '去签到',
        cancelText: '取消',
        success: (res) => { if (res.confirm) wx.switchTab({ url: '/pages/my/index' }) },
      })
      return
    }

    this.setData({ spinning: true })
    let result
    try {
      const res = await wx.cloud.callFunction({ name: 'drawLottery' })
      result = res.result
    } catch (e) {
      this.setData({ spinning: false })
      wx.showToast({ title: '抽奖失败，请重试', icon: 'none' })
      return
    }

    if (!result || result.code !== 0) {
      this.setData({ spinning: false })
      wx.showToast({ title: (result && result.msg) || '抽奖失败', icon: 'none' })
      return
    }

    // 计算转盘旋转角度，使指针(顶部)停在中奖扇区中心
    const idx = result.prizeIndex
    const cur = this.data.wheelRotate
    const mod = ((cur % 360) + 360) % 360
    const want = ((360 - (idx * 36 + 18)) % 360 + 360) % 360
    const delta = (want - mod + 360) % 360
    const newRotate = cur + 360 * SPIN_TURNS + delta

    this.setData({ wheelRotate: newRotate })

    setTimeout(() => {
      this.setData({
        spinning: false,
        tickets: result.ticketsLeft,
        resultShow: true,
        resultPrize: result.prize,
      })
      this.loadData()
    }, SPIN_DURATION)
  },

  _formatTime(v) {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const p = n => (n < 10 ? '0' + n : '' + n)
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  },

  closeResult() {
    this.setData({ resultShow: false, resultPrize: null })
  },

  // ===== 兑换商城 =====
  onSelectExchange(e) {
    if (!requireLogin()) return
    const item = e.currentTarget.dataset.item
    if (this.data.power < item.cost) {
      wx.showToast({ title: '积分不足', icon: 'none' })
      return
    }
    this.setData({ exchangeConfirmShow: true, selectedExchange: item })
  },

  closeExchangeConfirm() {
    this.setData({ exchangeConfirmShow: false, selectedExchange: null })
  },

  async confirmExchange() {
    const item = this.data.selectedExchange
    if (!item) return
    wx.showLoading({ title: '兑换中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'exchangePackage', data: { itemId: item.id } })
      wx.hideLoading()
      const r = res.result
      if (r.code === 0) {
        this.setData({
          exchangeConfirmShow: false,
          selectedExchange: null,
          exchangeResultShow: true,
          exchangeCode: r.exchangeCode,
          power: r.powerLeft,
        })
      } else {
        wx.showToast({ title: r.msg || '兑换失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '兑换失败，请重试', icon: 'none' })
    }
  },

  closeExchangeResult() {
    this.setData({ exchangeResultShow: false, exchangeCode: '' })
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.exchangeCode,
      success: () => wx.showToast({ title: '兑换码已复制', icon: 'none' }),
    })
  },
})
