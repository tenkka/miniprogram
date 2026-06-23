const CONFIG = require('../../config.js')
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const loginMixin = require('../../utils/loginMixin')
const APP = getApp()
APP.configLoadOK = () => {

}

Page({
  data: {
    ...loginMixin.data,
    isLogined: false,
    couponStatistics: {
      canUse: 0
    },
    balance: 0.00,
    score: 0,
    nick: undefined,
    nickShow: false,
    pendingNick: '',
    isAdmin: false,
    adminPopupShow: false,
    adminPassword: '',
    adminVerifying: false,
    phone: '',
    isPhoneBound: false,
    // 签到
    checkInDone: false,
    checkInStreak: 1,
    checkInPoints: 0,
    calendarDays: [],
    checkingIn: false,
    checkInRuleShow: false,
  },
  onLoad() {
    wx.setNavigationBarTitle({
      title: '我的',
    })
    this.setData({
      myBg: wx.getStorageSync('myBg'),
      version: CONFIG.version,
      customerServiceType: CONFIG.customerServiceType
    })
    getApp().getUserDetailOK = (apiUserInfoMap) => {
      this.processGotUserDetail(apiUserInfoMap)
    }
  },
  async onShow() {
    const logined = await AUTH.checkHasLogined()
    if (!logined) {
      this.setData({ isLogined: false, apiUserInfoMap: null, nick: null, isAdmin: false, phone: '', isPhoneBound: false })
      wx.removeStorageSync('cachedIsAdmin')
      return
    }
    const userInfo = wx.getStorageSync('userInfo') || {}
    const phone = userInfo.phone || ''
    this.setData({ phone, isPhoneBound: !!phone })
    // Show cached admin status immediately, refresh in background
    const cachedIsAdmin = wx.getStorageSync('cachedIsAdmin') || false
    this.setData({ isLogined: true, isAdmin: cachedIsAdmin })
    wx.cloud.callFunction({ name: 'checkAdmin' }).then(res => {
      const isAdmin = res.result.isAdmin || false
      wx.setStorageSync('cachedIsAdmin', isAdmin)
      this.setData({ isAdmin })
    }).catch(e => { console.error('checkAdmin failed:', e) })
    getApp().getUserApiInfo().then(apiUserInfoMap => {
      this.processGotUserDetail(apiUserInfoMap)
      // 从云端补充手机绑定状态，修正本地缓存可能丢失 phone 的问题
      wx.cloud.callFunction({ name: 'getUserBalance' }).then(res => {
        if (res.result && res.result.phone) {
          const userInfo = wx.getStorageSync('userInfo') || {}
          userInfo.phone = res.result.phone
          wx.setStorageSync('userInfo', userInfo)
          this.setData({ phone: res.result.phone, isPhoneBound: true })
        }
      }).catch(() => {})
    })
    this._loadCheckIn()
  },

  showCheckInRule() { this.setData({ checkInRuleShow: true }) },
  closeCheckInRule() { this.setData({ checkInRuleShow: false }) },

  _buildCalendar(weekCheckedDates) {
    const now = new Date()
    const utc8 = new Date(now.getTime() + 8 * 3600 * 1000)
    const todayStr = utc8.toISOString().slice(0, 10)
    const dayOfWeek = utc8.getUTCDay() // 0=Sun
    const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const labels = ['一', '二', '三', '四', '五', '六', '日']

    return labels.map((label, i) => {
      const d = new Date(utc8.getTime() + (i - daysFromMon) * 86400 * 1000)
      const dateStr = d.toISOString().slice(0, 10)
      const isToday = dateStr === todayStr
      const checked = weekCheckedDates.includes(dateStr)
      const isFuture = dateStr > todayStr
      let circleType = 'past'
      if (isFuture) circleType = 'future'
      else if (isToday && checked) circleType = 'today-checked'
      else if (isToday) circleType = 'today'
      else if (checked) circleType = 'checked'
      return { label, dateNum: d.getUTCDate(), dateStr, isToday, checked, isFuture, circleType }
    })
  },

  async _loadCheckIn() {
    const openid = wx.getStorageSync('openid')
    if (!openid) return
    try {
      const res = await wx.cloud.callFunction({ name: 'getCheckInStatus' })
      if (res.result.code === 0) {
        const { streak, todayCheckedIn, weekCheckedDates = [] } = res.result
        const POINTS = [10, 20, 30, 40, 60, 80, 100]
        this.setData({
          checkInStreak: streak,
          checkInDone: todayCheckedIn,
          checkInPoints: POINTS[streak - 1],
          calendarDays: this._buildCalendar(weekCheckedDates),
        })
      }
    } catch (e) { /* ignore */ }
  },

  async doCheckIn() {
    if (this.data.checkInDone || this.data.checkingIn) return
    if (!wx.getStorageSync('openid')) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ checkingIn: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'checkIn' })
      if (res.result.code === 0) {
        const { streak, points } = res.result
        const POINTS = [10, 20, 30, 40, 60, 80, 100]
        const calendarDays = this.data.calendarDays.map(d =>
          d.isToday ? { ...d, checked: true, circleType: 'today-checked' } : d
        )
        this.setData({ checkInDone: true, checkInStreak: streak, checkInPoints: points, calendarDays })
        wx.showToast({ title: `签到成功！+${points}积分`, icon: 'success' })
      } else if (res.result.code === 1) {
        this.setData({ checkInDone: true })
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
  doLogin() {
    this.showLoginPopup()
  },
  ...loginMixin,
  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#e64340',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          AUTH.loginOut()
          this.setData({
            isLogined: false,
            apiUserInfoMap: null,
            nick: null,
            balance: 0,
            score: 0,
            couponStatistics: { canUse: 0 }
          })
        }
      }
    })
  },
  async processGotUserDetail(apiUserInfoMap) {
    if (!apiUserInfoMap) {
      return
    }
    const order_hx_uids = wx.getStorageSync('order_hx_uids')
    const _data = {}
    _data.apiUserInfoMap = apiUserInfoMap
    _data.nick = apiUserInfoMap.base.nick
    if (order_hx_uids && order_hx_uids.indexOf(apiUserInfoMap.base.id) != -1) {
      _data.canHX = true // 具有扫码核销的权限
    }
    const admin_uids = wx.getStorageSync('admin_uids')
    if (admin_uids && admin_uids.indexOf(apiUserInfoMap.base.id) != -1) {
      _data.isAdmin = true
    }
    this.setData(_data)
    this.getUserAmount()
    this.couponStatistics()
  },
  async couponStatistics() {
    const res = await WXAPI.couponStatistics(wx.getStorageSync('token'))
    if (res.code == 0) {
      this.setData({
        couponStatistics: res.data
      })
    }
  },
  async getUserAmount() {
    // 余额已迁移到自定义云数据库系统，此方法保留为空以兼容调用处
  },
  scanOrderCode(){
    wx.scanCode({
      onlyFromCamera: true,
      success(res) {
        wx.navigateTo({
          url: '/pages/order-details/scan-result?hxNumber=' + res.result,
        })
      },
      fail(err) {
        console.error(err)
        wx.showToast({
          title: err.errMsg,
          icon: 'none'
        })
      }
    })
  },
  goCoupons() {
    wx.navigateTo({
      url: '/pages/coupons/index?tabIndex=1',
    })
  },
  goBalance() {
    wx.navigateTo({
      url: '/pages/asset/index',
    })
  },
  goScorelog() {
    wx.navigateTo({
      url: '/pages/score/logs',
    })
  },
  goadmin() {
    wx.navigateToMiniProgram({
      appId: 'wx5e5b0066c8d3f33d',
      path: 'pages/autoLogin?token=' + wx.getStorageSync('token'),
    })
  },
  clearStorage() {
    wx.clearStorageSync()
    this.setData({ isLogined: false, apiUserInfoMap: null, nick: null })
    wx.showToast({ title: '缓存已清除' })
  },
  govip() {
    wx.navigateTo({
      url: '/pages/member-center/index',
    })
  },
  editNick() {
    this.setData({
      nickShow: true,
      pendingNick: this.data.nick || '',
    })
  },
  closeNickDialog() {
    this.setData({ nickShow: false })
  },
  onPendingNickInput(e) {
    this.setData({ pendingNick: e.detail.value })
  },
  onPendingNickChange(e) {
    this.setData({ pendingNick: e.detail.value })
  },
  async _editNick() {
    const nick = (this.data.pendingNick || '').trim()
    if (!nick) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'updateProfile', data: { nick } })
      if (!res.result.success) throw new Error('update failed')
      const userInfo = wx.getStorageSync('userInfo') || {}
      userInfo.nick = nick
      wx.setStorageSync('userInfo', userInfo)
      this.setData({
        nickShow: false,
        nick,
        'apiUserInfoMap.base.nick': nick,
      })
      wx.showToast({ title: '修改成功' })
    } catch (e) {
      console.error('editNick error:', e)
      wx.showToast({ title: '修改失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
  async onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    const openid = wx.getStorageSync('openid')
    if (!openid) return
    wx.showLoading({ title: '上传中...' })
    try {
      // 上传到云存储
      const ext = tempPath.split('.').pop() || 'jpg'
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `avatars/${openid}.${ext}`,
        filePath: tempPath,
      })
      const fileID = uploadRes.fileID
      // 保存到云数据库
      await wx.cloud.callFunction({ name: 'updateProfile', data: { avatarUrl: fileID } })
      // 本地缓存存 fileID，供云函数解析；页面显示用 tempPath（已可访问）
      const userInfo = wx.getStorageSync('userInfo') || {}
      userInfo.avatarUrl = fileID
      wx.setStorageSync('userInfo', userInfo)
      this.setData({ 'apiUserInfoMap.base.avatarUrl': tempPath })
      wx.showToast({ title: '头像已更新' })
    } catch (e) {
      console.error('avatar upload error:', e)
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
  goUserCode() {
    wx.navigateTo({
      url: '/pages/my/user-code',
    })
  },
  customerService() {
    wx.openCustomerServiceChat({
      extInfo: {url: wx.getStorageSync('customerServiceChatUrl')},
      corpId: wx.getStorageSync('customerServiceChatCorpId'),
      success: res => {},
      fail: err => {
        console.error(err)
      }
    })
  },
  copyuid() {
    wx.setClipboardData({
      data: this.data.apiUserInfoMap.base.id + ''
    })
  },

  showAdminPopup() {
    this.setData({ adminPopupShow: true, adminPassword: '' })
  },
  closeAdminPopup() {
    this.setData({ adminPopupShow: false, adminPassword: '' })
  },
  onAdminPasswordInput(e) {
    this.setData({ adminPassword: e.detail.value })
  },
  async confirmAdmin() {
    if (!this.data.adminPassword) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    if (this.data.adminVerifying) return
    this.setData({ adminVerifying: true })
    wx.showLoading({ title: '验证中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'verifyAdmin',
        data: { password: this.data.adminPassword },
      })
      if (res.result.code === 0) {
        wx.setStorageSync('cachedIsAdmin', true)
        this.setData({ adminPopupShow: false, adminPassword: '', isAdmin: true })
        wx.navigateTo({ url: '/pages/admin/index' })
      } else {
        wx.showToast({ title: res.result.msg || '密码错误', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '验证失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ adminVerifying: false })
    }
  },
})