Page({
  data: {
    avatarUrl: '',
    avatarFileID: '',
    nick: '',
    loading: false,
  },

  async onAvatarChoose(e) {
    const tempPath = e.detail.avatarUrl
    const openid = wx.getStorageSync('openid')
    this.setData({ avatarUrl: tempPath })
    wx.showLoading({ title: '上传中...' })
    try {
      const ext = tempPath.split('.').pop() || 'jpg'
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `avatars/${openid}_${Date.now()}.${ext}`,
        filePath: tempPath,
      })
      this.setData({ avatarFileID: uploadRes.fileID })
      wx.cloud.callFunction({ name: 'checkImageSafety', data: { fileID: uploadRes.fileID } })
        .catch(e => console.error('checkImageSafety error:', e))
    } catch (e) {
      console.error('avatar upload error:', e)
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onNickInput(e) {
    this.setData({ nick: e.detail.value })
  },

  // type="nickname" 选择微信昵称时触发
  onNickChange(e) {
    this.setData({ nick: e.detail.value })
  },

  async confirmProfile() {
    const { nick, avatarUrl, loading } = this.data
    if (loading) return
    if (!nick || !nick.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    wx.showLoading({ title: '保存中...' })
    try {
      const fileID = this.data.avatarFileID || ''
      await wx.cloud.callFunction({
        name: 'updateProfile',
        data: { nick: nick.trim(), avatarUrl: fileID },
      })
      const userInfo = wx.getStorageSync('userInfo') || {}
      userInfo.nick = nick.trim()
      userInfo.avatarUrl = fileID
      wx.setStorageSync('userInfo', userInfo)
      wx.switchTab({ url: '/pages/home/index' })
    } catch (e) {
      console.error('setup error:', e)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  },

  skipSetup() {
    wx.switchTab({ url: '/pages/home/index' })
  },
})
