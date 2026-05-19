const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const validCategories = ['top', 'bottom', 'dress', 'set', 'unknown']

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

function normalizeCategory(category) {
  return validCategories.includes(category) ? category : 'unknown'
}

exports.main = async event => {
  const { itemId, cloudFileId } = event
  const apiUrl = process.env.CLOTHING_RECOGNITION_API_URL
  const apiKey = process.env.CLOTHING_RECOGNITION_API_KEY
  const model = process.env.CLOTHING_RECOGNITION_MODEL

  if (!itemId || !cloudFileId) {
    return { ok: false, code: 'BAD_REQUEST', message: 'itemId and cloudFileId are required.' }
  }

  if (!apiUrl) {
    return { ok: false, code: 'CONFIG_MISSING', message: 'CLOTHING_RECOGNITION_API_URL is empty.' }
  }

  const tempUrlResult = await cloud.getTempFileURL({
    fileList: [cloudFileId]
  })
  const imageUrl = tempUrlResult.fileList?.[0]?.tempFileURL

  if (!imageUrl) {
    return { ok: false, code: 'FILE_URL_FAILED', message: 'Failed to create image temp URL.' }
  }

  const response = await postJson(apiUrl, apiKey, {
    model,
    itemId,
    cloudFileId,
    imageUrl,
    categories: validCategories
  })
  const category = normalizeCategory(pickValue(response, 'category'))
  const confidence = pickValue(response, 'confidence')
  const tags = pickValue(response, 'tags')
  const color = pickValue(response, 'color')
  const name = pickValue(response, 'name')
  const updateData = {
    category,
    categorySource: category === 'unknown' ? 'unknown' : 'ai',
    recognition: {
      provider: 'api',
      confidence: typeof confidence === 'number' ? confidence : null,
      raw: response,
      updatedAt: new Date().toISOString()
    }
  }

  if (Array.isArray(tags)) updateData.tags = tags
  if (typeof color === 'string') updateData.color = color
  if (typeof name === 'string') updateData.name = name

  await db.collection('wardrobeItems').where({ id: itemId }).update({
    data: updateData
  })

  return {
    ok: true,
    itemId,
    category,
    categorySource: updateData.categorySource,
    tags: Array.isArray(tags) ? tags : [],
    color: typeof color === 'string' ? color : '',
    name: typeof name === 'string' ? name : '',
    confidence: updateData.recognition.confidence
  }
}
