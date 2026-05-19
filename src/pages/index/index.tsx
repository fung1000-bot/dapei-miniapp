import { useEffect, useRef, useState } from 'react'
import { Button, Camera, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

type Screen = 'home' | 'camera' | 'captureResult' | 'match' | 'manualPick' | 'confirm'
type ClothingCategory = 'top' | 'bottom' | 'dress' | 'set'
type RecordState = 'idle' | 'recording' | 'done'
type FlashMode = 'auto' | 'on' | 'off'

type ClothingItem = {
  id: number
  label: string
  tone: string
  category: ClothingCategory
}

type WardrobeItem = {
  id: string
  localPath: string
  albumSaved: boolean
  createdAt: string
  name: string
  color: string
  price: null
  tags: string[]
  outfits: string[]
}

const clothingCategories: { key: ClothingCategory, label: string }[] = [
  { key: 'top', label: '上衣' },
  { key: 'bottom', label: '下衣' },
  { key: 'dress', label: '连衣裙' },
  { key: 'set', label: '套装' }
]

const clothingItems: ClothingItem[] = [
  { id: 1, label: '上衣1', tone: 'tone-1', category: 'top' },
  { id: 2, label: '上衣2', tone: 'tone-2', category: 'top' },
  { id: 3, label: '上衣3', tone: 'tone-3', category: 'top' },
  { id: 4, label: '下衣1', tone: 'tone-4', category: 'bottom' },
  { id: 5, label: '下衣2', tone: 'tone-5', category: 'bottom' },
  { id: 6, label: '连衣裙1', tone: 'tone-6', category: 'dress' },
  { id: 7, label: '连衣裙2', tone: 'tone-1', category: 'dress' },
  { id: 8, label: '套装1', tone: 'tone-2', category: 'set' },
  { id: 9, label: '套装2', tone: 'tone-3', category: 'set' }
]

const recommendationItems: ClothingItem[] = [
  { id: 101, label: '推荐1', tone: 'tone-4', category: 'bottom' },
  { id: 102, label: '推荐2', tone: 'tone-5', category: 'top' },
  { id: 103, label: '推荐3', tone: 'tone-6', category: 'set' }
]

export default function Index () {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState<ClothingItem | null>(null)
  const [matchCategory, setMatchCategory] = useState<ClothingCategory>('top')
  const [manualPickCategory, setManualPickCategory] = useState<ClothingCategory>('bottom')
  const [note, setNote] = useState('')
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [showGuideButtons, setShowGuideButtons] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [capturedCount, setCapturedCount] = useState(0)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const guideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matchItems = clothingItems.filter(item => item.category === matchCategory)
  const manualPickItems = clothingItems.filter(item => item.category === manualPickCategory)

  useEffect(() => {
    return () => {
      clearRecordTimers()
    }
  }, [])

  function resetToHome () {
    setScreen('home')
    setSelectedItem(null)
    setSelectedRecommendation(null)
    setMatchCategory('top')
    setManualPickCategory('bottom')
    setNote('')
    setCapturedCount(0)
    setIsTakingPhoto(false)
    resetVoiceDemo()
  }

  function handlePickItem (item: ClothingItem) {
    setSelectedItem(item)
    setManualPickCategory(getManualPickDefaultCategory(item.category))
  }

  function handlePickRecommendation (item: ClothingItem) {
    setSelectedRecommendation(item)
    resetVoiceDemo()
    setScreen('confirm')
  }

  function handlePickManualItem (item: ClothingItem) {
    if (selectedItem?.id === item.id) return

    setSelectedRecommendation({ id: item.id, label: `自选${item.id}`, tone: item.tone, category: item.category })
    resetVoiceDemo()
    setScreen('confirm')
  }

  function handleChangeMatchCategory (category: ClothingCategory) {
    setMatchCategory(category)
    setSelectedItem(null)
    setSelectedRecommendation(null)
  }

  function getManualPickDefaultCategory (category: ClothingCategory): ClothingCategory {
    if (category === 'top') return 'bottom'
    return 'top'
  }

  function clearRecordTimers () {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }

    if (guideTimerRef.current) {
      clearTimeout(guideTimerRef.current)
      guideTimerRef.current = null
    }

    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current)
      analysisTimerRef.current = null
    }
  }

  function resetVoiceDemo () {
    clearRecordTimers()
    setRecordState('idle')
    setRecordSeconds(0)
    setShowGuideButtons(false)
    setIsAnalyzing(false)
  }

  function formatRecordTime (seconds: number) {
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0')
    const secondsText = String(seconds % 60).padStart(2, '0')

    return `${minutesText}:${secondsText}`
  }

  function handleRecordButtonTap () {
    if (recordState === 'recording') {
      finishVoiceDemo()
      return
    }

    startVoiceDemo()
  }

  function startVoiceDemo () {
    clearRecordTimers()
    setRecordState('recording')
    setRecordSeconds(0)
    setShowGuideButtons(false)
    setIsAnalyzing(false)

    recordTimerRef.current = setInterval(() => {
      setRecordSeconds(seconds => seconds + 1)
    }, 1000)

    guideTimerRef.current = setTimeout(() => {
      setShowGuideButtons(true)
    }, 5000)
  }

  function finishVoiceDemo () {
    clearRecordTimers()
    setRecordState('done')
    setShowGuideButtons(false)
    setIsAnalyzing(true)

    analysisTimerRef.current = setTimeout(() => {
      setIsAnalyzing(false)
      analysisTimerRef.current = null
    }, 1000)
  }

  function showDemoToast (title: string) {
    Taro.showToast({
      title,
      icon: 'none',
      duration: 1400
    })
  }

  function handleFlashModeTap () {
    const nextFlashMode: Record<FlashMode, FlashMode> = {
      auto: 'on',
      on: 'off',
      off: 'auto'
    }

    setFlashMode(nextFlashMode[flashMode])
  }

  async function handleTakePhoto () {
    if (isTakingPhoto) return

    setIsTakingPhoto(true)

    try {
      const tempImagePath = await takeCameraPhoto()
      const albumSaved = await savePhotoToAlbum(tempImagePath)
      await savePhotoToWardrobe(tempImagePath, albumSaved)

      setCapturedCount(count => count + 1)
      Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
    } catch (error) {
      Taro.showToast({
        title: '拍照失败，请重试',
        icon: 'none',
        duration: 1400
      })
    } finally {
      setIsTakingPhoto(false)
    }
  }

  function takeCameraPhoto () {
    return new Promise<string>((resolve, reject) => {
      const cameraContext = Taro.createCameraContext()

      cameraContext.takePhoto({
        quality: 'high',
        success: result => resolve(result.tempImagePath),
        fail: reject
      })
    })
  }

  async function savePhotoToAlbum (tempImagePath: string) {
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: tempImagePath })
      return true
    } catch (error) {
      return false
    }
  }

  async function savePhotoToWardrobe (tempImagePath: string, albumSaved: boolean) {
    const savedFile = await new Promise<Taro.saveFile.SuccessCallbackResult>((resolve, reject) => {
      Taro.saveFile({
        tempFilePath: tempImagePath,
        success: resolve,
        fail: reject
      })
    })
    const storageItems = Taro.getStorageSync<WardrobeItem[]>('wardrobeItems')
    const wardrobeItems = Array.isArray(storageItems) ? storageItems : []
    const wardrobeItem: WardrobeItem = {
      id: `item_${Date.now()}`,
      localPath: savedFile.savedFilePath,
      albumSaved,
      createdAt: new Date().toISOString(),
      name: '',
      color: '',
      price: null,
      tags: [],
      outfits: []
    }

    Taro.setStorageSync('wardrobeItems', [wardrobeItem, ...wardrobeItems])
  }

  function handleBackToMatch () {
    resetVoiceDemo()
    setScreen('match')
  }

  function renderCategoryTabs (
    activeCategory: ClothingCategory,
    onChange: (category: ClothingCategory) => void
  ) {
    return (
      <View className='category-tabs'>
        {clothingCategories.map(category => (
          <View
            key={category.key}
            className={`category-tab ${activeCategory === category.key ? 'is-active' : ''}`}
            onTap={() => onChange(category.key)}
          >
            <Text>{category.label}</Text>
          </View>
        ))}
      </View>
    )
  }

  function renderClothingCard (item: ClothingItem, size: 'grid' | 'result' | 'recommend' | 'pair' = 'grid') {
    const isSelected = selectedItem?.id === item.id

    return (
      <View className={`clothing-card clothing-card--${size} ${item.tone} ${isSelected ? 'is-selected' : ''}`}>
        <View className='clothing-card__hanger' />
        <View className='clothing-card__body'>
          <View className='clothing-card__neck' />
        </View>
        <Text className='clothing-card__label'>{item.label}</Text>
      </View>
    )
  }

  return (
    <View className='prototype'>
      {screen === 'home' && (
        <View className='home screen'>
          <View className='home__header'>
            <Text className='eyebrow'>进货搭配测试原型</Text>
            <Text className='title'>今天要做什么？</Text>
          </View>

          <View className='home__actions'>
            <Button className='action-card action-card--camera' onTap={() => setScreen('camera')}>
              <Text className='action-card__icon'>CAM</Text>
              <Text className='action-card__title'>拍新衣服</Text>
              <Text className='action-card__hint'>模拟拍照并记录新货</Text>
            </Button>

            <Button className='action-card action-card--match' onTap={() => setScreen('match')}>
              <Text className='action-card__icon'>SET</Text>
              <Text className='action-card__title'>搭衣服</Text>
              <Text className='action-card__hint'>选择单品查看推荐</Text>
            </Button>
          </View>
        </View>
      )}

      {screen === 'camera' && (
        <View className='camera'>
          <Camera
            className='camera-view'
            devicePosition='back'
            flash={flashMode}
          />
          <View className='camera-overlay camera-overlay--top'>
            <Button className='camera-control camera-control--back' onTap={resetToHome}>返回</Button>
            <Text className='camera-count'>已拍 {capturedCount}</Text>
          </View>
          <View className='camera-overlay camera-overlay--bottom'>
            <Button className='flash-button' onTap={handleFlashModeTap}>闪光灯 {flashMode}</Button>
            <Button
              className={`shutter-button ${isTakingPhoto ? 'is-taking' : ''}`}
              disabled={isTakingPhoto}
              onTap={handleTakePhoto}
            >
              拍照
            </Button>
            <View className='capture-badge'>
              <Text>{capturedCount}</Text>
            </View>
          </View>
        </View>
      )}

      {screen === 'captureResult' && (
        <View className='capture screen'>
          <View className='topbar'>
            <Button className='plain-button' onTap={resetToHome}>返回</Button>
          </View>
          <View className='capture__content'>
            {renderClothingCard({ id: 0, label: '拍照结果', tone: 'tone-2', category: 'top' }, 'result')}
          </View>
          <Button className='primary-button' onTap={resetToHome}>完成</Button>
        </View>
      )}

      {screen === 'match' && (
        <View className='match screen'>
          <View className='match__header'>
            <Button className='plain-button' onTap={resetToHome}>返回</Button>
            <Text className='screen-title'>选择要搭配的单品</Text>
          </View>
          {renderCategoryTabs(matchCategory, handleChangeMatchCategory)}

          <View className={`match__workspace ${selectedItem ? 'has-panel' : ''}`}>
            <View className='grid'>
              {matchItems.map(item => (
                <View key={item.id} className='grid__cell' onTap={() => handlePickItem(item)}>
                  {renderClothingCard(item)}
                </View>
              ))}
            </View>

            <View className={`recommend-panel ${selectedItem ? 'is-open' : ''}`}>
              <Text className='recommend-panel__title'>推荐搭配</Text>
              <Text className='recommend-panel__hint'>点击一个推荐单品继续</Text>
              <View className='recommend-list'>
                {recommendationItems.map(item => (
                  <View key={item.id} className='recommend-list__item' onTap={() => handlePickRecommendation(item)}>
                    {renderClothingCard(item, 'recommend')}
                  </View>
                ))}
              </View>
              <Button
                className='manual-pick-button'
                disabled={!selectedItem}
                onTap={() => setScreen('manualPick')}
              >
                自己选一件
              </Button>
            </View>
          </View>
        </View>
      )}

      {screen === 'manualPick' && selectedItem && (
        <View className='manual-pick screen'>
          <View className='match__header'>
            <Button className='plain-button' onTap={() => setScreen('match')}>返回</Button>
            <Text className='screen-title'>选择另一件搭配单品</Text>
          </View>
          {renderCategoryTabs(manualPickCategory, setManualPickCategory)}

          <View className='manual-pick__selected'>
            <Text className='manual-pick__label'>当前已选</Text>
            <Text className='manual-pick__name'>{selectedItem.label}</Text>
          </View>

          <View className='grid manual-pick__grid'>
            {manualPickItems.map(item => {
              const isCurrentItem = selectedItem.id === item.id

              return (
                <View
                  key={item.id}
                  className={`grid__cell ${isCurrentItem ? 'is-disabled' : ''}`}
                  onTap={() => handlePickManualItem(item)}
                >
                  {renderClothingCard(item)}
                </View>
              )
            })}
          </View>
        </View>
      )}

      {screen === 'confirm' && selectedItem && selectedRecommendation && (
        <View className='confirm screen'>
          <View className='topbar'>
            <Button className='plain-button' onTap={handleBackToMatch}>返回</Button>
          </View>
          <View className='confirm__header'>
            <Text className='title'>确认这组搭配</Text>
            <Text className='subtext'>用于用户测试的模拟保存流程</Text>
          </View>

          <View className='pair-row'>
            {renderClothingCard(selectedItem, 'pair')}
            <Text className='pair-row__plus'>+</Text>
            {renderClothingCard(selectedRecommendation, 'pair')}
          </View>

          <View className='confirm__form'>
            <Input
              className='note-input'
              value={note}
              placeholder='补充说明（可选）'
              onInput={event => setNote(event.detail.value)}
            />
            <View className={`voice-demo-card voice-demo-card--${recordState}`}>
              <Text className='voice-demo-badge'>演示版</Text>
              <Text className='voice-demo-title'>
                {recordState === 'recording' ? '模拟录音中...' : isAnalyzing ? '模拟分析中...' : recordState === 'done' ? '已生成搭配思路' : '点击模拟录音（演示版）'}
              </Text>
              {recordState === 'recording' && (
                <Text className='voice-demo-timer'>{formatRecordTime(recordSeconds)}</Text>
              )}
              <Button
                className={`voice-demo-record-button ${recordState === 'recording' ? 'is-recording' : ''}`}
                onTap={handleRecordButtonTap}
              >
                {recordState === 'recording' ? '⏹️' : '🎤'}
              </Button>
              {recordState === 'idle' && (
                <Text className='voice-demo-hint'>这是交互演示，不会真的录音</Text>
              )}
              {recordState === 'recording' && showGuideButtons && (
                <View className='voice-guide-row'>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('已记录：通勤')}>适合什么场合？</Button>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('已记录：颜色呼应')}>搭配亮点？</Button>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('已记录：加腰带')}>还有什么可配？</Button>
                </View>
              )}
              {isAnalyzing && (
                <View className='voice-analysis'>
                  <View className='voice-analysis-spinner' />
                  <Text className='voice-analysis-text'>正在整理搭配思路</Text>
                </View>
              )}
              {recordState === 'done' && !isAnalyzing && (
                <View className='voice-result-card'>
                  <Text className='voice-result-title'>AI识别结果（演示）</Text>
                  <View className='voice-result-list'>
                    <Text className='voice-result-item'>场合：通勤</Text>
                    <Text className='voice-result-item'>亮点：颜色呼应</Text>
                    <Text className='voice-result-item'>补充：可加腰带</Text>
                  </View>
                  <Text className='voice-result-summary'>这组搭配适合日常出门，整体清爽，层次足够明确。</Text>
                  <View className='voice-result-actions'>
                    <Button className='voice-result-button' onTap={resetVoiceDemo}>重新模拟</Button>
                    <Button className='voice-result-button is-primary' onTap={() => showDemoToast('演示数据已保存')}>保存演示</Button>
                  </View>
                </View>
              )}
            </View>
            <View className='confirm-action-bar'>
              <Button className='confirm-action-button' onTap={() => showDemoToast('演示已取消')}>取消</Button>
              <Button
                className={`confirm-action-button is-next ${recordState === 'done' && !isAnalyzing ? 'is-active' : ''}`}
                disabled={recordState !== 'done' || isAnalyzing}
                onTap={() => showDemoToast('已进入下一步')}
              >
                下一步
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
