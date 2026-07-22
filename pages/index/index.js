Page({
  data: {
    posts: [],
    loading: true,
    empty: false,
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadPosts()
  },
  onPullDownRefresh() {
    this.loadPosts().then(() => wx.stopPullDownRefresh())
  },
  async loadPosts() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getPosts' })
      const posts = (res.result.posts || []).map(p => ({
        ...p,
        timeLabel: this.formatTime(p.createdAt),
      }))
      this.setData({ posts, empty: posts.length === 0 })
    } catch (e) {
      console.error('loadPosts error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}小时前`
    const mo = d.getMonth() + 1
    const day = d.getDate()
    return `${mo}月${day}日`
  },
  previewImage(e) {
    const src = e.currentTarget.dataset.src
    wx.previewImage({ urls: [src], current: src })
  },
})
