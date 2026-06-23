const AUTH = require('./auth')

// 在 Page options 里展开使用：...loginMixin
const loginMixin = {
  data: {
    loginPopupShow: false,
    pendingAvatar: '',
    pendingAvatarTemp: '',
    pendingNick: '',
    loginLoading: false,
  },

  async showLoginPopup() {
    wx.showLoading({ title: '登录中...' })
    try {
      const result = await AUTH.authorize()
      const needsSetup = result.isNew || !result.userInfo || !result.userInfo.nick
      if (!needsSetup) {
        // 已有资料，直接完成登录
        const userInfo = result.userInfo
        const stored = wx.getStorageSync('userInfo') || {}
        stored.nick = userInfo.nick
        stored.avatarUrl = userInfo.avatarUrl || stored.avatarUrl
        wx.setStorageSync('userInfo', stored)
        this.setData({ isLogined: true, loginPopupShow: false })
        getApp().getUserApiInfo().then(info => {
          if (this.processGotUserDetail) this.processGotUserDetail(info)
        })
        wx.showToast({ title: '登录成功' })
      } else {
        // 新用户或资料不全，弹出设置
        this.setData({ loginPopupShow: true, pendingAvatar: '', pendingNick: '' })
      }
    } catch (e) {
      console.error('showLoginPopup error:', e)
      if (typeof e === 'string' || (e && e.showToastAlready)) return
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  closeLoginPopup() {
    this.setData({ loginPopupShow: false })
  },

  async onPickAvatar(e) {
    const tempPath = e.detail.avatarUrl
    this.setData({ pendingAvatar: tempPath, pendingAvatarTemp: tempPath })
  },

  onNickInput(e) {
    this.setData({ pendingNick: e.detail.value })
  },

  onNickChange(e) {
    this.setData({ pendingNick: e.detail.value })
  },

  async confirmLogin() {
    const { pendingNick, pendingAvatarTemp, loginLoading } = this.data
    if (loginLoading) return
    if (!pendingNick || !pendingNick.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    this.setData({ loginLoading: true })
    wx.showLoading({ title: '登录中...' })
    try {
      // openid 已在 showLoginPopup 中通过 authorize() 写入 storage
      const openid = wx.getStorageSync('openid')

      // 上传头像到云存储
      let avatarUrl = ''
      if (pendingAvatarTemp) {
        const ext = pendingAvatarTemp.split('.').pop() || 'jpg'
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/${openid}_${Date.now()}.${ext}`,
          filePath: pendingAvatarTemp,
        })
        avatarUrl = uploadRes.fileID
      }

      // 保存昵称和头像到云数据库
      await wx.cloud.callFunction({
        name: 'updateProfile',
        data: { nick: pendingNick.trim(), avatarUrl },
      })

      // 更新本地缓存
      const userInfo = wx.getStorageSync('userInfo') || {}
      userInfo.nick = pendingNick.trim()
      userInfo.avatarUrl = avatarUrl
      wx.setStorageSync('userInfo', userInfo)

      this.setData({ loginPopupShow: false, isLogined: true })

      // 刷新页面用户信息
      getApp().getUserApiInfo().then(info => {
        if (this.processGotUserDetail) this.processGotUserDetail(info)
      })
      wx.showToast({ title: '登录成功' })
    } catch (e) {
      console.error('confirmLogin error:', e)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ loginLoading: false })
    }
  },
}

module.exports = loginMixin
