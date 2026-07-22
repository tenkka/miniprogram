Page({
  data: {
    activeTab: 'power',
    top3Power: [], restPower: [], emptyPower: false,
    top3Champion: [], restChampion: [], emptyChampion: false,
    loading: true,
  },
  onLoad() {
    this.loadRankings()
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
  },
  onPullDownRefresh() {
    this.loadRankings().then(() => wx.stopPullDownRefresh())
  },
  async loadRankings() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getRankings' })
      const { power, champion } = res.result
      this.setData({
        top3Power:    power.slice(0, 3),
        restPower:    power.slice(3),
        emptyPower:   power.length === 0,
        top3Champion: champion.slice(0, 3),
        restChampion: champion.slice(3),
        emptyChampion: champion.length === 0,
      })
    } catch (e) {
      console.error('loadRankings error:', e)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
  onTabChange(e) {
    this.setData({ activeTab: e.detail.name })
  },
})
