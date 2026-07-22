const LIST = [
  { pagePath: '/pages/booking/index', text: '预约', icon: '/images/nav/booking-off.png' },
  { pagePath: '/pages/index/index',   text: '广场', icon: '/images/nav/index-off.png'   },
  { pagePath: '/pages/home/index',    text: '首页', icon: '/images/nav/home-off.png'    },
  { pagePath: '/pages/rank/index',    text: '排行', icon: '/images/nav/booking-off.png' },
  { pagePath: '/pages/my/index',      text: '我的', icon: '/images/nav/my-off.png'      },
]

Component({
  data: {
    selected: 2,
    list: LIST,
  },

  methods: {
    switchTab(e) {
      const { path, index } = e.currentTarget.dataset
      this.setData({ selected: index })
      wx.switchTab({ url: path })
    },
  },
})
