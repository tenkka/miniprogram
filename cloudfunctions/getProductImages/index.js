const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { fileList } = event
  try {
    const res = await cloud.getTempFileURL({ fileList })
    const urlMap = {}
    res.fileList.forEach(f => {
      if (f.status === 0) urlMap[f.fileID] = f.tempFileURL
    })
    return { code: 0, urlMap }
  } catch (e) {
    return { code: 1, msg: e.message || JSON.stringify(e) }
  }
}
