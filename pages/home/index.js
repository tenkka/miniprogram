const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const loginMixin = require('../../utils/loginMixin')

Page({
  data: {
    ...loginMixin.data,
    avatarUrl: '',
    userTitle: '',
    nick: '',
    userPower: 0,
    banners: [],
    bannerIndex: 0,
    showDetailImage: false,
    selectedBanner: null,
    currentStore: null,
    // 签到
    checkInShow: false,
    checkInDone: false,
    checkInStreak: 1,
    checkInPoints: 0,
    checkInDaysTop: [],
    checkInDaysBottom: [],
    checkingIn: false,
  },
  onLoad() {
    getApp().getUserDetailOK = (apiUserInfoMap) => {
      this.processGotUserDetail(apiUserInfoMap)
    }
    this.loadBanners()
    this.loadCurrentStore()
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    // 从门店页返回时刷新
    const saved = wx.getStorageSync('currentStore')
    if (saved) this.setData({ currentStore: saved })
    getApp().getUserApiInfo().then(apiUserInfoMap => {
      this.processGotUserDetail(apiUserInfoMap)
    })
    this._maybeShowCheckIn()
  },
  async loadCurrentStore() {
    const saved = wx.getStorageSync('currentStore')
    if (saved) {
      this.setData({ currentStore: saved })
      return
    }
    // 显示占位，避免条目完全消失
    this.setData({ currentStore: { name: '加载中…', address: '' } })
    try {
      const res = await wx.cloud.callFunction({ name: 'getStores' })
      const list = res.result.list || []
      // id 可能是数字或字符串，统一转字符串比较
      const store = list.find(s => String(s.id) === '1') || list[0]
      if (store) {
        wx.setStorageSync('currentStore', store)
        this.setData({ currentStore: store })
      } else {
        this.setData({ currentStore: null })
      }
    } catch (e) {
      console.error('loadCurrentStore error:', e)
      this.setData({ currentStore: null })
    }
  },
  goStores() {
    wx.navigateTo({ url: '/pages/stores/index' })
  },
  async processGotUserDetail(apiUserInfoMap) {
    if (!apiUserInfoMap) return
    this.setData({
      avatarUrl: apiUserInfoMap.base.avatarUrl,
      nick: apiUserInfoMap.base.nick || '',
      userTitle: apiUserInfoMap.userLevel ? apiUserInfoMap.userLevel.name : '',
    })
  },
  // ===== 签到 =====
  async _maybeShowCheckIn() {
    const openid = wx.getStorageSync('openid')
    if (!openid) return
    const today = new Date().toISOString().slice(0, 10)
    if (wx.getStorageSync('checkInShownDate') === today) return
    wx.setStorageSync('checkInShownDate', today)
    try {
      const res = await wx.cloud.callFunction({ name: 'getCheckInStatus' })
      if (res.result.code === 0) {
        this._applyCheckInData(res.result.streak, res.result.todayCheckedIn)
        this.setData({ checkInShow: true })
      }
    } catch (e) { /* 签到状态获取失败不影响主流程 */ }
  },

  _buildDays(streak, done) {
    const POINTS = [10, 20, 30, 40, 60, 80, 100]
    const days = POINTS.map((pts, i) => {
      const day = i + 1
      let state = day < streak ? 'done' : day === streak ? (done ? 'done' : 'current') : 'future'
      return { day, points: pts, state }
    })
    return { top: days.slice(0, 4), bottom: days.slice(4) }
  },

  _applyCheckInData(streak, done) {
    const POINTS = [10, 20, 30, 40, 60, 80, 100]
    const { top, bottom } = this._buildDays(streak, done)
    this.setData({
      checkInStreak: streak,
      checkInDone: done,
      checkInPoints: POINTS[streak - 1],
      checkInDaysTop: top,
      checkInDaysBottom: bottom,
    })
  },

  closeCheckIn() {
    this.setData({ checkInShow: false })
  },

  async doCheckIn() {
    if (this.data.checkInDone || this.data.checkingIn) return
    this.setData({ checkingIn: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'checkIn' })
      if (res.result.code === 0) {
        this._applyCheckInData(res.result.streak, true)
        wx.showToast({ title: `签到成功！+${res.result.points}积分`, icon: 'success' })
      } else if (res.result.code === 1) {
        this._applyCheckInData(this.data.checkInStreak, true)
        wx.showToast({ title: '今日已签到', icon: 'none' })
      } else {
        wx.showToast({ title: '签到失败，请重试', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '签到失败，请重试', icon: 'none' })
    } finally {
      this.setData({ checkingIn: false })
    }
  },

  async loadBanners() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getBanners' })
      if (res.result.code === 0) {
        this.setData({ banners: res.result.list })
      }
    } catch (e) {
      console.error('loadBanners error:', e)
    }
  },
  onBannerChange(e) {
    this.setData({ bannerIndex: e.detail.current })
  },
  onBannerTap(e) {
    const index = e.currentTarget.dataset.index
    const banner = this.data.banners[index]
    if (!banner) return
    const detailUrl = banner.detailImageUrl || banner.imageUrl
    if (!detailUrl) return
    this.setData({ showDetailImage: true, selectedBanner: { ...banner, detailImageUrl: detailUrl } })
  },
  closeDetail() {
    this.setData({ showDetailImage: false, selectedBanner: null })
  },
  onAvatarTap() {
    if (this.data.avatarUrl) {
      wx.switchTab({ url: '/pages/my/index' })
    } else {
      this.showLoginPopup()
    }
  },
  ...loginMixin,
  goOrder() {
    wx.navigateTo({ url: '/pages/order/index' })
  },
  goGame() {
    wx.switchTab({ url: '/pages/booking/index' })
  },
  goRank() {
    wx.switchTab({ url: '/pages/rank/index' })
  },
  goMy() {
    wx.switchTab({ url: '/pages/my/index' })
  },
  goActivities() { wx.navigateTo({ url: '/pages/activities/index' }) },
  goTools()      { wx.navigateTo({ url: '/pages/tools/index' }) },
  onShareAppMessage() {
    return {
      title: 'NUTS 德扑酒吧 — 今晚来战！',
      path: '/pages/home/index?inviter_id=' + (wx.getStorageSync('uid') || ''),
      imageUrl: wx.getStorageSync('share_pic'),
    }
  },
  onShareTimeline() {
    return {
      title: 'NUTS 德扑酒吧 — 今晚来战！',
      query: 'inviter_id=' + (wx.getStorageSync('uid') || ''),
    }
  },
})
