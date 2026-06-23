const { requireLogin } = require('../../utils/requireLogin')

const TYPE_CONFIG = {
  consume:   { label: '消费',     sign: '-', color: '#e64340' },
  free:      { label: '下单',     sign: '',  color: '#D4AF37' },
  admin_add: { label: '管理员充值', sign: '+', color: '#2196F3' },
  wechat:    { label: '自助充值',  sign: '+', color: '#4CAF50' },
  recharge:  { label: '自助充值',  sign: '+', color: '#4CAF50' },
}

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function resolveRecord(o) {
  const cfg = TYPE_CONFIG[o.type] || { label: o.type, sign: '', color: '#CCCCCC' }
  const recharge = o.rechargeAmount || 0
  const gift = o.giftAmount || 0

  let displayPrice
  let priceNote = ''
  if (o.type === 'consume' || o.type === 'free') {
    displayPrice = o.realPrice || Math.abs(recharge + gift)
  } else {
    displayPrice = Math.abs(recharge)
    if (gift > 0) priceNote = `赠送 ¥${gift}`
  }

  return {
    ...o,
    typeLabel: cfg.label,
    typeSign: cfg.sign,
    typeColor: cfg.color,
    displayPrice,
    priceNote,
    title: o.note || cfg.label,
    dateStr: formatDate(o.createdAt),
  }
}

Page({
  data: {
    orders: [],
    loading: true,
    rechargeBalance: 0,
    giftBalance: 0,
    totalBalance: 0,
  },

  onShow() {
    if (!requireLogin()) return
    this.loadBalance()
    this.loadOrders()
  },

  async loadBalance() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserBalance' })
      if (res.result.code === 0) {
        const rechargeBalance = res.result.rechargeBalance || 0
        const giftBalance = res.result.giftBalance || 0
        this.setData({
          rechargeBalance,
          giftBalance,
          totalBalance: +(rechargeBalance + giftBalance).toFixed(2),
        })
      }
    } catch (e) {
      console.error('getUserBalance error:', e)
    }
  },

  async loadOrders() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyOrders' })
      const orders = (res.result.list || []).map(resolveRecord)
      this.setData({ orders })
    } catch (e) {
      console.error('loadOrders error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
