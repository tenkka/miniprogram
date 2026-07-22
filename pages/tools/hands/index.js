const POSITIONS = [
  { key: 'utg', label: 'UTG', sublabel: '早位' },
  { key: 'mp',  label: 'MP',  sublabel: '中位' },
  { key: 'co',  label: 'CO',  sublabel: '截枪位' },
  { key: 'btn', label: 'BTN', sublabel: '按钮位' },
  { key: 'sb',  label: 'SB',  sublabel: '小盲' },
  { key: 'bb',  label: 'BB',  sublabel: '大盲' },
]

const HANDS = {
  utg: {
    desc: '最早行动，范围需最紧。只玩顶级强牌，放弃边缘手牌。',
    strong:   ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
    playable: ['TT', '99', 'AQs', 'AQo', 'AJs', 'KQs'],
    marginal: ['88', '77', 'ATs', 'AJo', 'KJs', 'KQo', 'QJs'],
  },
  mp: {
    desc: '行动顺序居中，可适当扩宽范围，仍需稳健。',
    strong:   ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
    playable: ['TT', '99', '88', 'AQs', 'AQo', 'AJs', 'AJo', 'KQs', 'KQo'],
    marginal: ['77', '66', 'ATs', 'A9s', 'KJs', 'KTs', 'QJs', 'JTs'],
  },
  co: {
    desc: '截枪位行动较晚，可大幅扩宽范围，适合半诈唬与盗盲。',
    strong:   ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs'],
    playable: ['99', '88', '77', 'AQo', 'AJs', 'AJo', 'ATs', 'KQs', 'KQo', 'KJs', 'QJs'],
    marginal: ['66', '55', 'A9s', 'A8s', 'KTs', 'QTs', 'JTs', 'T9s'],
  },
  btn: {
    desc: '按钮位是最佳位置，翻后始终最后行动，范围可以最宽。',
    strong:   ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AKo', 'AQs', 'AQo'],
    playable: ['88', '77', '66', 'AJs', 'AJo', 'ATs', 'A9s', 'KQs', 'KQo', 'KJs', 'KTs', 'QJs', 'JTs', 'T9s'],
    marginal: ['55', '44', 'A8s', 'A7s', 'A6s', 'A5s', 'K9s', 'Q9s', 'J9s', '98s', '87s', '76s'],
  },
  sb: {
    desc: '小盲位只输一半盲注，但翻后始终第一个行动（位置最差），需谨慎。',
    strong:   ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo'],
    playable: ['99', '88', 'AQs', 'AQo', 'AJs', 'KQs'],
    marginal: ['77', '66', 'AJo', 'ATs', 'KQo', 'KJs', 'QJs'],
    note: '小盲对大盲单挑时范围可扩宽，但面对多玩家加注应大幅收紧。',
  },
  bb: {
    desc: '大盲翻前最后行动，已投入一个大盲，享有"防守权"，可比其他位置更宽地跟注。',
    strong:   ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo'],
    playable: ['99', '88', '77', 'AJs', 'AJo', 'ATs', 'KQs', 'KQo', 'KJs', 'QJs', 'JTs'],
    marginal: ['66', '55', 'A9s', 'A8s', 'KTs', 'QTs', 'T9s', '98s', '87s'],
    note: '面对单一加注，大盲可防守几乎所有同花连牌及中等口袋对。',
  },
}

Page({
  data: {
    positions: POSITIONS,
    selectedPos: 'utg',
    current: null,
  },

  onLoad() {
    this._apply('utg')
  },

  selectPos(e) {
    const key = e.currentTarget.dataset.key
    this._apply(key)
  },

  _apply(key) {
    const h = HANDS[key]
    this.setData({
      selectedPos: key,
      current: {
        ...h,
        strongStr:   h.strong.join('  '),
        playableStr: h.playable.join('  '),
        marginalStr: h.marginal.join('  '),
      },
    })
  },
})
