# 线下服装搭配助手 · In-Store Outfit Assistant

> 为线下服装门店设计的微信小程序，帮助门店老板快速完成进货批次的拍照建档、AI 搭配推荐与员工执行交付。
>
> A WeChat Mini Program for brick-and-mortar clothing stores — helps shop owners photograph new stock, get AI-assisted outfit recommendations, and share execution results with staff.

---

## 目录 · Table of Contents

- [功能概览 · Features](#功能概览--features)
- [技术栈 · Tech Stack](#技术栈--tech-stack)
- [项目结构 · Project Structure](#项目结构--project-structure)
- [快速开始 · Getting Started](#快速开始--getting-started)
- [云函数 · Cloud Functions](#云函数--cloud-functions)
- [数据结构 · Data Models](#数据结构--data-models)

---

## 功能概览 · Features

### 中文

| 功能 | 说明 |
|------|------|
| **进货批次管理** | 每次进货创建一个批次，所有拍照和搭配自动归入当前批次 |
| **拍照建档** | 相机拍照后自动上传至微信云存储，AI 识别服装品类（上衣 / 下装 / 连衣裙 / 套装） |
| **智能搭配推荐** | 选中一件单品后，从同批次衣橱中推荐合适的搭配组合 |
| **语音备注** | 搭配确认时可录音说明搭配理由，WechatSI 插件实时转文字，DeepSeek 提取风格偏好标签 |
| **审美画像积累** | 每次保存搭配时，自动更新用户风格画像（场合 / 风格 / 颜色 / 避雷标签） |
| **员工执行页** | 批次结束后生成可分享的执行页，展示已搭配 / 未搭配单品，供员工按图陈列 |

### English

| Feature | Description |
|---------|-------------|
| **Batch Management** | Each restock creates a new batch; photos and outfits are automatically grouped into the active batch |
| **Photo Cataloging** | Camera photos are uploaded to WeChat Cloud Storage; AI classifies each item (top / bottom / dress / set) |
| **Outfit Recommendations** | Select an item to receive pairing suggestions from items in the same wardrobe |
| **Voice Notes** | Record voice memos when confirming outfits; WechatSI transcribes speech in real time; DeepSeek extracts style-preference tags |
| **Style Profile** | Each saved outfit updates the user's aesthetic profile (occasion / style / color / avoidance tags) |
| **Staff Execution Page** | After closing a batch, a shareable page shows matched vs. unmatched items for staff to fulfill in-store |

---

## 技术栈 · Tech Stack

| 层次 | 技术 |
|------|------|
| 框架 · Framework | [Taro](https://taro.jd.com/) 4.2 + React 18 |
| 语言 · Language | TypeScript 5 |
| 样式 · Styling | Sass |
| 云开发 · Cloud | 微信云开发（数据库 / 云存储 / 云函数） |
| AI · AI Services | DeepSeek API（偏好关键词提取）、微信 AI（服装识别）|
| 语音 · Speech | WechatSI 插件 0.3.7（实时语音转文字） |
| 代码规范 · Lint | ESLint · Stylelint · commitlint · Husky · lint-staged |

---

## 项目结构 · Project Structure

```
线下服装搭配DEMO/
└── sbti-miniapp/
    ├── src/
    │   ├── pages/
    │   │   ├── index/          # 主页（首页、相机、搭配、确认）
    │   │   └── execution/      # 员工执行页
    │   ├── services/
    │   │   └── auth.ts         # 微信登录 / openId 获取
    │   ├── app.ts              # 小程序入口
    │   └── app.config.ts       # 页面路由 & 权限声明
    ├── cloudfunctions/
    │   ├── login/              # 微信登录
    │   ├── recognizeClothing/  # AI 服装品类识别
    │   ├── extractKeywordsDeepSeek/  # DeepSeek 风格偏好提取
    │   ├── extractStylePreference/   # 风格偏好处理
    │   ├── transcribeVoice/    # 语音转文字（备用）
    │   └── getExecutionBatch/  # 获取批次执行数据
    ├── config/                 # Taro 构建配置
    ├── project.config.json     # 微信开发者工具项目配置
    └── package.json
```

---

## 快速开始 · Getting Started

### 前置条件 · Prerequisites

- Node.js ≥ 18
- 微信开发者工具（已开通云开发）
- 已配置 DeepSeek API Key（在对应云函数环境变量中）

### 安装依赖 · Install

```bash
cd sbti-miniapp
npm install
```

### 开发构建（微信小程序）· Dev Build

```bash
npm run dev:weapp
```

构建产物输出至 `dist/`，用微信开发者工具打开该目录即可预览。

Build output goes to `dist/`; open that directory in WeChat DevTools to preview.

### 生产构建 · Production Build

```bash
npm run build:weapp
```

### 上传云函数 · Deploy Cloud Functions

在微信开发者工具中，右键每个云函数目录 → **上传并部署（不覆盖线上文件）**。

In WeChat DevTools, right-click each cloud function directory → **Upload and deploy**.

---

## 云函数 · Cloud Functions

| 云函数 | 触发场景 | 说明 |
|--------|----------|------|
| `login` | 小程序启动 | 换取 openId |
| `recognizeClothing` | 拍照后 | 调用微信 AI 识别服装品类、颜色、名称 |
| `extractKeywordsDeepSeek` | 录音结束后 | 调用 DeepSeek 从语音文字中提取风格偏好标签 |
| `extractStylePreference` | 辅助偏好处理 | 风格标签后处理 |
| `transcribeVoice` | 备用转写路径 | WechatSI 不可用时的降级方案 |
| `getExecutionBatch` | 执行页加载 | 聚合批次、衣橱、搭配记录一次返回 |

---

## 数据结构 · Data Models

### 云数据库集合 · Firestore Collections

| 集合 | 说明 |
|------|------|
| `stockBatches` | 进货批次（`active` / `closed`） |
| `wardrobeItems` | 单件服装，含品类、颜色、云文件 ID、搭配次数 |
| `outfitRecords` | 搭配记录，含语音备注、转写文字、偏好标签 |
| `userStyleProfiles` | 用户审美画像，场合 / 风格 / 颜色 / 避雷标签的累计计数 |

---

## 注意事项 · Notes

- **生产数据库**：请勿在非测试环境中直接修改 `wardrobeItems` 或 `outfitRecords`。
- **API Key**：DeepSeek Key 存放在云函数环境变量中，不要硬编码到源码。
- **云存储路径**：服装图片存于 `wardrobe/{itemId}.jpg`，语音备注存于 `outfits/{voiceId}.mp3`。

- **Production DB**: Do not modify `wardrobeItems` or `outfitRecords` directly outside of a test environment.
- **API Keys**: DeepSeek keys live in cloud function env vars — never hardcode them.
- **Cloud Storage paths**: Clothing photos are stored at `wardrobe/{itemId}.jpg`; voice memos at `outfits/{voiceId}.mp3`.
