/**
 * 检查用户是否已绑定手机号。
 * 若未绑定，弹出提示并可跳转绑定页面。
 * 返回 true 表示已绑定，可继续操作；返回 false 表示未绑定，已拦截。
 */
function requirePhone(message) {
  const userInfo = wx.getStorageSync('userInfo') || {}
  if (userInfo.phone) return true

  wx.showModal({
    title: '请先绑定手机号',
    content: message || '该操作需要绑定手机号，绑定后方可继续',
    confirmText: '去绑定',
    cancelText: '取消',
    success(res) {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/bind-phone/index' })
      }
    },
  })
  return false
}

module.exports = { requirePhone }
