const AUTH = require('../../utils/auth')

Page({
  data: { loading: false },

  async doLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const result = await AUTH.authorize()
      // isNew 为 true，或者昵称为空，都进入资料设置
      const needsSetup = result.isNew || !result.userInfo || !result.userInfo.nick
      if (needsSetup) {
        wx.redirectTo({ url: '/pages/login/setup' })
      } else {
        wx.switchTab({ url: '/pages/home/index' })
      }
    } catch (e) {
      console.error('login error:', e)
    } finally {
      this.setData({ loading: false })
    }
  }
})
