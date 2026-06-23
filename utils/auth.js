const WXAPI = require('apifm-wxapi')

async function checkSession(){
  return new Promise((resolve, reject) => {
    wx.checkSession({
      success() {
        return resolve(true)
      },
      fail() {
        return resolve(false)
      }
    })
  })
}

async function bindSeller() {
  // 老带新已迁移到云开发：绑定改由邀请页手动输入邀请码 → 云函数 bindReferrer 完成。
  // 此处保留空实现，避免旧 apifm 接口被调用。
  return
}

// 检测登录状态，返回 true / false
// 云开发模式下 openid 是永久的，不依赖 wx.checkSession
function checkHasLogined() {
  const openid = wx.getStorageSync('openid')
  return Promise.resolve(!!openid)
}

async function wxaCode(){
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        return resolve(res.code)
      },
      fail() {
        wx.showToast({
          title: '获取code失败',
          icon: 'none'
        })
        return resolve('获取code失败')
      }
    })
  })
}

async function login(page){
  const _this = this
  wx.login({
    success: function (res) {
      const componentAppid = wx.getStorageSync('componentAppid')
      if (componentAppid) {
        WXAPI.wxappServiceLogin({
          componentAppid,
          appid: wx.getStorageSync('appid'),
          code: res.code
        }).then(function (res) {        
          if (res.code == 10000) {
            // 去注册
            return;
          }
          if (res.code != 0) {
            // 登录错误
            wx.showModal({
              confirmText: '确定',
              cancelText: '取消',
              title: '无法登录',
              content: res.msg,
              showCancel: false
            })
            return;
          }
          wx.setStorageSync('token', res.data.token)
          wx.setStorageSync('uid', res.data.uid)
          _this.bindSeller()
          if ( page ) {
            page.onShow()
          }
        })
      } else {
        WXAPI.login_wx(res.code).then(function (res) {        
          if (res.code == 10000) {
            // 去注册
            return;
          }
          if (res.code != 0) {
            // 登录错误
            wx.showModal({
              confirmText: '确定',
              cancelText: '取消',
              title: '无法登录',
              content: res.msg,
              showCancel: false
            })
            return;
          }
          wx.setStorageSync('token', res.data.token)
          wx.setStorageSync('uid', res.data.uid)
          _this.bindSeller()
          if ( page ) {
            page.onShow()
          }
        })
      }
    }
  })
}

async function authorize() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'login',
      success: (res) => {
        const { openid, userInfo } = res.result
        wx.setStorageSync('openid', openid)
        wx.setStorageSync('token', openid)  // 兼容现有代码
        wx.setStorageSync('userInfo', userInfo)
        resolve(res.result)
      },
      fail: (err) => {
        console.error('cloud login error:', err)
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        reject(err)
      }
    })
  })
}

function loginOut(){
  wx.removeStorageSync('token')
  wx.removeStorageSync('openid')
  wx.removeStorageSync('userInfo')
}

async function checkAndAuthorize (scope) {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(res) {
        if (!res.authSetting[scope]) {
          wx.authorize({
            scope: scope,
            success() {
              resolve() // 无返回参数
            },
            fail(e){
              console.error(e)
              // if (e.errMsg.indexof('auth deny') != -1) {
              //   wx.showToast({
              //     title: e.errMsg,
              //     icon: 'none'
              //   })
              // }
              wx.showModal({
                content: '需要获得您的授权',
                showCancel: false,
                confirmText: '立即授权',
                confirmColor: '#e64340',
                success(res) {
                  wx.openSetting();
                },
                fail(e){
                  console.error(e)
                  reject(e)
                },
              })
            }
          })
        } else {
          resolve() // 无返回参数
        }
      },
      fail(e){
        console.error(e)
        reject(e)
      }
    })
  })  
}

module.exports = {
  checkHasLogined: checkHasLogined,
  wxaCode: wxaCode,
  login: login,
  loginOut: loginOut,
  checkAndAuthorize: checkAndAuthorize,
  authorize: authorize,
  bindSeller: bindSeller
}
