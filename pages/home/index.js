const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const loginMixin = require('../../utils/loginMixin')

const STORES = [
  { id: 'east', name: '东区店' },
  { id: 'west', name: '西区店' },
]

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
    detailImageUrl: '',
    topPlayers: [],
    storeName: '东区店',
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
    this.loadTopPlayers()
  },
  onShow() {
    const savedId = wx.getStorageSync('selectedStoreId') || 'east'
    const store = STORES.find(s => s.id === savedId) || STORES[0]
    this.setData({ storeName: store.name })
    getApp().getUserApiInfo().then(apiUserInfoMap => {
      this.processGotUserDetail(apiUserInfoMap)
    })
    this._maybeShowCheckIn()
  },
  switchStore() {
    wx.showActionSheet({
      itemList: STORES.map(s => s.name),
      success: (res) => {
        const store = STORES[res.tapIndex]
        wx.setStorageSync('selectedStoreId', store.id)
        this.setData({ storeName: store.name })
      },
    })
  },
  async processGotUserDetail(apiUserInfoMap) {
    if (!apiUserInfoMap) return
    this.setData({
      avatarUrl: apiUserInfoMap.base.avatarUrl,
      nick: apiUserInfoMap.base.nick || '',
      userTitle: apiUserInfoMap.userLevel ? apiUserInfoMap.userLevel.name : '',
    })
    // 从排行榜数据里找自己的战力
    const openid = wx.getStorageSync('openid')
    if (openid && this.data.topPlayers && this.data.topPlayers.length) {
      const me = this.data.topPlayers.find(p => p._id && p._id.includes && p._id === openid)
      if (me) this.setData({ userPower: me.points })
    }
  },
  async loadTopPlayers() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getRankings' })
      const power = res.result.power || []
      this.setData({
        topPlayers: power.slice(0, 5).map(p => ({
          _id: p._id,
          name: p.nick,
          avatar: p.avatarUrl || '',
          points: p.power,
          title: '',
        }))
      })
    } catch (e) {
      console.error('loadTopPlayers error:', e)
    }
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
    const detailImageUrl = e.currentTarget.dataset.detail
    if (!detailImageUrl) return
    wx.previewImage({ urls: [detailImageUrl], current: detailImageUrl })
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
  goScorelog() {
    wx.switchTab({ url: '/pages/rank/index' })
  },
  goMy() {
    wx.switchTab({ url: '/pages/my/index' })
  },
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
