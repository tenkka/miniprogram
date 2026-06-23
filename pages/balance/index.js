Page({
  data: {
    loading: true,
    rechargeBalance: 0,
    giftBalance: 0,
    totalBalance: '0.00',
    logs: [],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '历史订单' })
    this.loadLogs()
  },

  onPullDownRefresh() {
    this.loadLogs().then(() => wx.stopPullDownRefresh())
  },

  async loadLogs() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getBalanceLogs' })
      if (res.result.code === 0) {
        const { rechargeBalance, giftBalance, logs } = res.result
        const total = (rechargeBalance + giftBalance).toFixed(2)
        const formattedLogs = logs.map(log => this.formatLog(log))
        this.setData({ rechargeBalance, giftBalance, totalBalance: total, logs: formattedLogs })
      }
    } catch (e) {
      console.error('getBalanceLogs error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  formatLog(log) {
    const recharge = log.rechargeAmount || 0
    const gift = log.giftAmount || 0
    const total = recharge + gift
    const isPositive = total >= 0

    let typeLabel = '操作'
    if (log.type === 'admin_add') typeLabel = '手动添加'
    else if (log.type === 'recharge') typeLabel = '充值'
    else if (log.type === 'consume') typeLabel = '消费'
    else if (log.type === 'refund') typeLabel = '退款'

    const parts = []
    if (recharge !== 0) parts.push(`充值 ${recharge > 0 ? '+' : ''}¥${Math.abs(recharge).toFixed(2)}`)
    if (gift !== 0) parts.push(`赠送 ${gift > 0 ? '+' : ''}¥${Math.abs(gift).toFixed(2)}`)
    const amountText = parts.join('  +  ') || '¥0.00'

    return {
      ...log,
      typeLabel,
      amountText,
      isPositive,
      totalAmount: total.toFixed(2),
      formattedDate: this.formatDate(log.createdAt),
    }
  },

  formatDate(dateObj) {
    if (!dateObj) return ''
    const d = new Date(dateObj)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },
})
