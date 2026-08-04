const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { fileID } = event

  try {
    const urlRes = await cloud.getTempFileURL({ fileList: [fileID] })
    const mediaUrl = urlRes.fileList[0].tempFileURL

    const result = await cloud.openapi.security.mediaCheckAsync({
      mediaUrl,
      mediaType: 2,
      version: 2,
      scene: 1,
      openid: OPENID,
    })

    await db.collection('media_security_checks').add({
      data: {
        traceId: result.traceId,
        openid: OPENID,
        fileID,
        type: 'avatar',
        status: 'pending',
        createdAt: db.serverDate(),
      }
    })

    return { code: 0, traceId: result.traceId }
  } catch (e) {
    console.error('checkImageSafety error:', e)
    return { code: 1, msg: e.errMsg || e.message }
  }
}
