const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function postJson(url, apiKey, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const client = target.protocol === 'http:' ? http : https
    const payload = JSON.stringify(body)
    const request = client.request({
      method: 'POST',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      }
    }, response => {
      let data = ''

      response.on('data', chunk => {
        data += chunk
      })
      response.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}

          if (response.statusCode >= 400) {
            reject(new Error(parsed.message || `API request failed: ${response.statusCode}`))
            return
          }

          resolve(parsed)
        } catch (error) {
          reject(error)
        }
      })
    })

    request.on('error', reject)
    request.write(payload)
    request.end()
  })
}

function pickValue(response, key) {
  return response?.[key] ?? response?.data?.[key] ?? response?.result?.[key]
}

exports.main = async event => {
  const { outfitId, audioCloudFileId, duration, format = 'mp3' } = event
  const apiUrl = process.env.SPEECH_TO_TEXT_API_URL
  const apiKey = process.env.SPEECH_TO_TEXT_API_KEY
  const model = process.env.SPEECH_TO_TEXT_MODEL

  if (!outfitId || !audioCloudFileId) {
    return { ok: false, code: 'BAD_REQUEST', message: 'outfitId and audioCloudFileId are required.' }
  }

  if (!apiUrl) {
    return { ok: false, code: 'CONFIG_MISSING', message: 'SPEECH_TO_TEXT_API_URL is empty.' }
  }

  const tempUrlResult = await cloud.getTempFileURL({
    fileList: [audioCloudFileId]
  })
  const audioUrl = tempUrlResult.fileList?.[0]?.tempFileURL

  if (!audioUrl) {
    return { ok: false, code: 'FILE_URL_FAILED', message: 'Failed to create audio temp URL.' }
  }

  try {
    const response = await postJson(apiUrl, apiKey, {
      model,
      outfitId,
      audioCloudFileId,
      audioUrl,
      duration,
      format,
      language: 'zh-CN'
    })
    const text = String(pickValue(response, 'text') || '')
    const transcript = {
      text,
      source: 'stt',
      updatedAt: new Date().toISOString()
    }

    await db.collection('outfitRecords').where({ id: outfitId }).update({
      data: {
        transcript,
        'aiStatus.stt': 'done'
      }
    })

    return { ok: true, outfitId, transcript }
  } catch (error) {
    await db.collection('outfitRecords').where({ id: outfitId }).update({
      data: {
        'aiStatus.stt': 'failed'
      }
    }).catch(() => undefined)

    throw error
  }
}
