function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

Page({
  data: {
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    transactions: [],
    loading: true,
    page: 0,
    hasMore: false,
    loadingMore: false,
  },

  async onLoad() {
    await this.loadInfo()
  },

  async onShow() {
    // Refresh balance when coming back from shop
    await this.loadInfo()
  },

  async loadInfo() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getPointsInfo' })
      if (res.result.code === 0) {
        const txs = (res.result.transactions || []).map(tx => ({
          ...tx,
          createdAt: formatDate(tx.createdAt),
        }))
        this.setData({
          balance: res.result.balance,
          totalEarned: res.result.totalEarned,
          totalSpent: res.result.totalSpent,
          transactions: txs,
          page: 1,
          hasMore: txs.length === 20,
        })
      }
    } catch (e) {
      console.error('getPointsInfo error:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPointsHistory',
        data: { page: this.data.page, size: 20 },
      })
      if (res.result.code === 0) {
        const more = (res.result.list || []).map(tx => ({
          ...tx,
          createdAt: formatDate(tx.createdAt),
        }))
        this.setData({
          transactions: [...this.data.transactions, ...more],
          page: this.data.page + 1,
          hasMore: res.result.hasMore,
        })
      }
    } catch (e) {
      console.error('getPointsHistory error:', e)
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  goShop() {
    wx.navigateTo({ url: '/pages/points/shop' })
  },
})
