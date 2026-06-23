/**
 * 检查是否已登录。未登录则弹窗提示并跳转到「我的」页面。
 * 用法：if (!requireLogin()) return
 */
function requireLogin() {
  const openid = wx.getStorageSync('openid')
  if (openid) return true
  wx.showModal({
    title: '请先登录',
    content: '该功能需要登录后使用',
    confirmText: '去登录',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        wx.switchTab({ url: '/pages/my/index' })
      }
    },
  })
  return false
}

module.exports = { requireLogin }
