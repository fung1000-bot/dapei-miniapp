import { useEffect, useMemo, useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

type ClothingCategory = 'top' | 'bottom' | 'dress' | 'set' | 'unknown'
type BatchStatus = 'active' | 'closed'

type StockBatch = {
  id: string
  name: string
  status: BatchStatus
  createdAt: string
  closedAt: string | null
}

type WardrobeItem = {
  id: string
  batchId: string
  cloudFileId: string
  localPath: string
  category: ClothingCategory
  categorySource: string
  name: string
  tags: string[]
}

type OutfitRecord = {
  id: string
  batchId: string
  itemIds: string[]
  createdAt: string
}

type OutfitView = {
  record: OutfitRecord
  items: WardrobeItem[]
}

const BATCH_COLLECTION = 'stockBatches'
const WARDROBE_COLLECTION = 'wardrobeItems'
const OUTFIT_COLLECTION = 'outfitRecords'

const categoryLabels: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  dress: '连衣裙',
  set: '套装',
  unknown: '未分类'
}

function getCloudDatabase () {
  if (!wx.cloud) {
    throw new Error('Cloud development is not available.')
  }

  return wx.cloud.database()
}

async function fetchExecutionBatchFromCloudFunction (batchId: string) {
  if (!wx.cloud?.callFunction) return null

  const result = await wx.cloud.callFunction({
    name: 'getExecutionBatch',
    data: {
      batchId
    }
  })
  const response = result?.result

  if (!response?.ok) {
    throw new Error(response?.message || response?.code || 'Failed to get execution batch.')
  }

  return response
}

function normalizeBatch (item): StockBatch {
  return {
    id: String(item.id || ''),
    name: String(item.name || ''),
    status: item.status === 'closed' ? 'closed' : 'active',
    createdAt: String(item.createdAt || ''),
    closedAt: item.closedAt ? String(item.closedAt) : null
  }
}

function normalizeWardrobeItem (item): WardrobeItem {
  return {
    id: String(item.id || ''),
    batchId: String(item.batchId || ''),
    cloudFileId: String(item.cloudFileId || ''),
    localPath: String(item.localPath || ''),
    category: item.category || 'unknown',
    categorySource: String(item.categorySource || ''),
    name: String(item.name || ''),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : []
  }
}

function normalizeOutfitRecord (item): OutfitRecord {
  return {
    id: String(item.id || ''),
    batchId: String(item.batchId || ''),
    itemIds: Array.isArray(item.itemIds) ? item.itemIds.map(String) : [],
    createdAt: String(item.createdAt || '')
  }
}

function formatTime (value: string) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${month}/${day} ${hour}:${minute}`
}

function sortByCreatedAtDesc<T extends { createdAt: string }> (items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function getItemImage (item?: WardrobeItem) {
  return item?.cloudFileId || item?.localPath || ''
}

function getItemLabel (item?: WardrobeItem) {
  if (!item) return '未找到单品'

  return item.name || item.tags.find(Boolean) || categoryLabels[item.category] || '单品'
}

export default function ExecutionPage () {
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [batch, setBatch] = useState<StockBatch | null>(null)
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([])
  const [outfitRecords, setOutfitRecords] = useState<OutfitRecord[]>([])

  useEffect(() => {
    loadExecutionPage()
  }, [])

  const itemMap = useMemo(() => {
    const map: Record<string, WardrobeItem> = {}

    wardrobeItems.forEach(item => {
      map[item.id] = item
    })

    return map
  }, [wardrobeItems])

  const pairedOutfits = useMemo<OutfitView[]>(() => {
    return outfitRecords.map(record => ({
      record,
      items: record.itemIds.map(itemId => itemMap[itemId]).filter(Boolean)
    }))
  }, [itemMap, outfitRecords])

  const pairedItemIds = useMemo(() => {
    const ids: Record<string, boolean> = {}

    outfitRecords.forEach(record => {
      record.itemIds.forEach(itemId => {
        ids[itemId] = true
      })
    })

    return ids
  }, [outfitRecords])

  const unpairedItems = wardrobeItems.filter(item => item.batchId === batch?.id && !pairedItemIds[item.id])

  async function loadExecutionPage () {
    const batchId = String(Taro.getCurrentInstance().router?.params?.batchId || '')

    if (!batchId) {
      setErrorMessage('缺少批次 ID')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    try {
      const cloudFunctionResponse = await fetchExecutionBatchFromCloudFunction(batchId)

      if (cloudFunctionResponse) {
        setBatch(normalizeBatch(cloudFunctionResponse.batch))
        setWardrobeItems(Array.isArray(cloudFunctionResponse.wardrobeItems)
          ? cloudFunctionResponse.wardrobeItems.map(normalizeWardrobeItem).filter(item => item.id)
          : [])
        setOutfitRecords(Array.isArray(cloudFunctionResponse.outfitRecords)
          ? cloudFunctionResponse.outfitRecords.map(normalizeOutfitRecord).filter(record => record.id)
          : [])
        return
      }

      const database = getCloudDatabase()
      const command = database.command
      const [batchResult, wardrobeResult, outfitResult] = await Promise.all([
        database.collection(BATCH_COLLECTION).where({ id: batchId }).limit(1).get(),
        database.collection(WARDROBE_COLLECTION).where({ batchId }).get(),
        database.collection(OUTFIT_COLLECTION).where({ batchId }).get()
      ])
      const nextBatch = Array.isArray(batchResult.data) ? batchResult.data[0] : null
      const batchItems = Array.isArray(wardrobeResult.data)
        ? sortByCreatedAtDesc(wardrobeResult.data.map(normalizeWardrobeItem).filter(item => item.id))
        : []
      const nextOutfits = Array.isArray(outfitResult.data)
        ? sortByCreatedAtDesc(outfitResult.data.map(normalizeOutfitRecord).filter(record => record.id))
        : []
      const knownItemIds = new Set(batchItems.map(item => item.id))
      const missingItemIds = [...new Set(nextOutfits.flatMap(record => record.itemIds))]
        .filter(itemId => itemId && !knownItemIds.has(itemId))
      let linkedItems: WardrobeItem[] = []

      if (missingItemIds.length > 0) {
        const linkedResult = await database.collection(WARDROBE_COLLECTION)
          .where({ id: command.in(missingItemIds) })
          .get()

        linkedItems = Array.isArray(linkedResult.data)
          ? linkedResult.data.map(normalizeWardrobeItem).filter(item => item.id)
          : []
      }

      if (!nextBatch) {
        setErrorMessage('没有找到这个批次')
        return
      }

      setBatch(normalizeBatch(nextBatch))
      setWardrobeItems([...batchItems, ...linkedItems])
      setOutfitRecords(nextOutfits)
    } catch (error) {
      console.error('[execution] load page failed', error)
      setErrorMessage('执行页加载失败，请检查云数据库权限')
    } finally {
      setIsLoading(false)
    }
  }

  function renderItemImage (item?: WardrobeItem) {
    return (
      <View className='item-photo'>
        {getItemImage(item) ? (
          <Image className='item-photo__image' src={getItemImage(item)} mode='aspectFill' />
        ) : (
          <Text className='item-photo__empty'>无图</Text>
        )}
      </View>
    )
  }

  function renderItemMeta (item?: WardrobeItem) {
    return (
      <View className='item-meta'>
        <Text className='item-meta__name'>{getItemLabel(item)}</Text>
        <Text className='item-meta__category'>
          {item ? categoryLabels[item.category] || '未分类' : '缺失'} · {item?.categorySource === 'manual' ? '手动确认' : item?.categorySource === 'ai' ? 'AI识别' : '待确认'}
        </Text>
      </View>
    )
  }

  return (
    <View className='execution-page'>
      <View className='execution-hero'>
        <Text className='execution-kicker'>员工执行页</Text>
        <Text className='execution-title'>{batch?.name || '搭配结果'}</Text>
        <Text className='execution-subtitle'>
          {batch ? `${batch.status === 'closed' ? '已结束' : '进行中'} · ${formatTime(batch.closedAt || batch.createdAt)}` : '按图片完成店内拿货与陈列'}
        </Text>
      </View>

      {isLoading ? (
        <View className='execution-state'>
          <Text>正在读取搭配结果...</Text>
        </View>
      ) : errorMessage ? (
        <View className='execution-state'>
          <Text>{errorMessage}</Text>
          <Button className='execution-state__button' onTap={loadExecutionPage}>重新加载</Button>
        </View>
      ) : (
        <>
          <View className='summary-row'>
            <View className='summary-card'>
              <Text className='summary-card__value'>{pairedOutfits.length}</Text>
              <Text className='summary-card__label'>已搭配</Text>
            </View>
            <View className='summary-card'>
              <Text className='summary-card__value'>{unpairedItems.length}</Text>
              <Text className='summary-card__label'>未搭配</Text>
            </View>
          </View>

          <View className='execution-section'>
            <Text className='section-title'>已搭配</Text>
            {pairedOutfits.length > 0 ? (
              pairedOutfits.map((outfit, index) => (
                <View key={outfit.record.id} className='paired-card'>
                  <Text className='paired-card__index'>组合 {index + 1}</Text>
                  <View className='paired-card__items'>
                    {[0, 1].map(slotIndex => (
                      <View key={`${outfit.record.id}_${slotIndex}`} className='paired-card__item'>
                        {renderItemImage(outfit.items[slotIndex])}
                        {renderItemMeta(outfit.items[slotIndex])}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <Text className='empty-copy'>本批次还没有保存搭配。</Text>
            )}
          </View>

          <View className='execution-section'>
            <Text className='section-title'>未搭配</Text>
            {unpairedItems.length > 0 ? (
              <View className='unpaired-grid'>
                {unpairedItems.map(item => (
                  <View key={item.id} className='unpaired-card'>
                    {renderItemImage(item)}
                    {renderItemMeta(item)}
                  </View>
                ))}
              </View>
            ) : (
              <Text className='empty-copy'>本批次所有单品都已经进入搭配。</Text>
            )}
          </View>
        </>
      )}
    </View>
  )
}
