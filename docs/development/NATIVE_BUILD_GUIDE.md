# Сборка нативных приложений Loyal Spark

## Предварительные требования

- Node.js 18+
- Для iOS: macOS + Xcode 15+
- Для Android: Android Studio с SDK 33+
- Аккаунт Apple Developer ($99/год) для App Store
- Аккаунт Google Play Developer ($25 единоразово) для Google Play

## Архитектура

Один кодбейз → два приложения:

| Приложение | App ID | Описание |
|-----------|--------|----------|
| **Loyal Spark** | `app.loyalspark.shopper` | Для покупателей: QR, баланс, ваучеры, маркетплейс |
| **Loyal Spark Business** | `app.loyalspark.business` | Для бизнеса: CRM, минт, аналитика, награды |

## Шаги сборки

### 1. Экспорт и клонирование

1. Репозиторий уже на GitHub (например `https://github.com/aspekt19/unboxed-loyalty-spark.git`) — клонируйте его или продолжайте в существующей копии.
2. Установка зависимостей:
```bash
git clone https://github.com/aspekt19/unboxed-loyalty-spark.git
cd unboxed-loyalty-spark
npm install
```

### 2. Сборка Shopper-версии (для покупателей)

```bash
# Убедитесь что в capacitor.config.ts:
# const APP_VARIANT = 'shopper';

npm run build
npx cap add ios        # первый раз
npx cap add android    # первый раз
npx cap sync
```

**Запуск на устройстве:**
```bash
# iOS (нужен Mac с Xcode)
npx cap open ios
# Или напрямую на устройство:
npx cap run ios

# Android
npx cap open android
# Или напрямую:
npx cap run android
```

### 3. Сборка Business-версии (для бизнеса)

```bash
# Измените в capacitor.config.ts:
# const APP_VARIANT = 'business';

npm run build
npx cap sync
```

⚠️ **Важно**: при переключении между вариантами нужно удалить и заново добавить платформы:
```bash
rm -rf ios android
npx cap add ios
npx cap add android
npx cap sync
```

### 4. Разработка с hot-reload

Раскомментируйте строку `server.url` в `capacitor.config.ts`:
```typescript
server: {
  url: 'https://9f9b9a35-7ebe-4782-9103-fd6fffe9fbe0.lovableproject.com?forceHideBadge=true',
  cleartext: true,
}
```

Затем:
```bash
npx cap sync
npx cap run ios  # или android
```

Приложение будет загружать UI из Lovable preview — любые изменения в Lovable автоматически отобразятся на устройстве.

### 5. Подготовка к публикации

#### App Store (iOS)
1. Откройте проект в Xcode: `npx cap open ios`
2. Настройте **Bundle Identifier** (уже задан в конфиге)
3. Настройте **Signing & Capabilities** с вашим Apple Developer аккаунтом
4. Добавьте иконки приложения в `Assets.xcassets`
5. Archive → Distribute App → App Store Connect

#### Google Play (Android)
1. Откройте проект в Android Studio: `npx cap open android`
2. Настройте подпись APK (keystore)
3. Build → Generate Signed Bundle (AAB)
4. Загрузите AAB в Google Play Console

### 6. Иконки и Splash Screen

Используйте утилиту `@capacitor/assets`:
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#000000' --splashBackgroundColor '#000000'
```

Положите исходные файлы в `assets/`:
- `icon-only.png` (1024x1024) — иконка приложения
- `splash.png` (2732x2732) — splash screen
- `splash-dark.png` (2732x2732) — splash для тёмной темы

## Маршрутизация в нативных приложениях

В нативном режиме приложение открывается напрямую на:
- **Shopper**: `/native/shopper` → CustomerPage
- **Business**: `/native/business` → MerchantPage

Выбор роли пропускается — пользователь сразу попадает в нужный интерфейс.

## Следующие шаги

- [ ] Кассовый модуль (сканирование QR покупателя → начисление баллов)
- [ ] Push-уведомления (`@capacitor/push-notifications`)
- [ ] Камера для QR (`@capacitor/barcode-scanner`)
- [ ] Биометрическая аутентификация
- [ ] Offline-режим
