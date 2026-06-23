const { requireLogin } = require('../../utils/requireLogin')
const AUTH = require('../../utils/auth')

const SPIN_TURNS = 5          // 旋转整圈数
const SPIN_DURATION = 4200    // 与 wxss transition 时长保持一致(ms)

// 转盘 10 扇区（固定顺序与名称，不可修改；需与云函数 drawLottery 的 PRIZES 完全一致）
// name：完整奖品名（弹窗/记录用，不可改）；wheelText：转盘显示文案，仅为换行排版，含 \n
const PRIZES = [
  { index: 0, name: '谢谢参与', wheelText: '谢谢\n参与', type: 'none', value: 0 },
  { index: 1, name: '5000积分券', wheelText: '5000\n积分券', type: 'power', value: 5000 },
  { index: 2, name: '3000积分券', wheelText: '3000\n积分券', type: 'power', value: 3000 },
  { index: 3, name: '1000积分券', wheelText: '1000\n积分券', type: 'power', value: 1000 },
  { index: 4, name: '50元代金券', wheelText: '50元\n代金券', type: 'gift', value: 50 },
  { index: 5, name: '5元代金券', wheelText: '5元\n代金券', type: 'gift', value: 5 },
  { index: 6, name: '10元代金券', wheelText: '10元\n代金券', type: 'gift', value: 10 },
  { index: 7, name: '+100积分带入', wheelText: '+100\n积分带入', type: 'power', value: 100 },
  { index: 8, name: '+200积分带入', wheelText: '+200\n积分带入', type: 'power', value: 200 },
  { index: 9, name: '+500积分带入', wheelText: '+500\n积分带入', type: 'power', value: 500 },
]

// 积分兑换商城（牌桌福利阁），本地兜底，云端可覆盖
const EXCHANGE_ITEMS = [
  { id: 'combo398', name: '398 酒水套餐', comboPrice: 398, cost: 30000 },
  { id: 'combo218', name: '218 酒水套餐', comboPrice: 218, cost: 18888 },
  { id: 'combo138', name: '138 酒水套餐', comboPrice: 138, cost: 12888 },
]

Page({
  data: {
    isLogined: false,
    tickets: 0,
    power: 0,
    prizes: PRIZES,      // 本地固定渲染，不依赖云函数
    sectorAngle: 36,     // 360/10
    exchangeItems: EXCHANGE_ITEMS,
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
        // prizes/exchangeItems 以本地固定配置为准，云端仅用于次数/积分/记录
        this.setData({
          tickets: r.tickets,
          power: r.power,
          exchangeItems: (r.exchangeItems && r.exchangeItems.length) ? r.exchangeItems : EXCHANGE_ITEMS,
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
