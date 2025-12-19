# Webアプリとしてデプロイする方法

このToDoアプリをWebアプリとして公開する方法を説明します。

## 方法1: Vercel（推奨・最も簡単）

### 手順

1. **Vercelにアクセス**
   - https://vercel.com にアクセス
   - GitHubアカウントでログイン

2. **プロジェクトをインポート**
   - 「Add New...」→「Project」をクリック
   - GitHubリポジトリ `simple-todo-list-ai` を選択
   - 「Import」をクリック

3. **設定**
   - Framework Preset: **Vite** を選択
   - Build Command: `npm run build`（自動で設定される）
   - Output Directory: `dist`（自動で設定される）
   - Install Command: `npm install`（自動で設定される）

4. **デプロイ**
   - 「Deploy」をクリック
   - 数分でデプロイ完了
   - 自動的にURLが発行されます（例: `https://simple-todo-list-ai.vercel.app`）

### メリット
- ✅ 完全無料（個人利用）
- ✅ GitHubと連携して自動デプロイ
- ✅ カスタムドメイン対応
- ✅ HTTPS自動設定
- ✅ 高速CDN配信

---

## 方法2: Netlify

### 手順

1. **Netlifyにアクセス**
   - https://www.netlify.com にアクセス
   - GitHubアカウントでログイン

2. **プロジェクトをデプロイ**
   - 「Add new site」→「Import an existing project」
   - GitHubリポジトリを選択
   - 設定:
     - Build command: `npm run build`
     - Publish directory: `dist`

3. **デプロイ**
   - 「Deploy site」をクリック
   - 自動的にURLが発行されます

### メリット
- ✅ 完全無料（個人利用）
- ✅ GitHubと連携
- ✅ カスタムドメイン対応

---

## 方法3: GitHub Pages

### 手順

1. **vite.config.jsを更新**
   ```js
   export default defineConfig({
     plugins: [react()],
     base: '/simple-todo-list-ai/', // リポジトリ名に合わせる
   })
   ```

2. **GitHub Actionsで自動デプロイ**
   - `.github/workflows/deploy.yml` を作成（下記参照）

3. **GitHubで設定**
   - リポジトリの「Settings」→「Pages」
   - Source: 「GitHub Actions」を選択

### GitHub Actions設定ファイル

`.github/workflows/deploy.yml` を作成:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v4
```

### メリット
- ✅ 完全無料
- ✅ GitHubと完全統合
- ⚠️ カスタムドメインは設定可能だが、少し手間

---

## ローカルでビルドを確認する方法

```bash
# ビルド
npm run build

# ビルド結果をプレビュー
npm run preview
```

ブラウザで `http://localhost:4173` にアクセスして確認できます。

---

## 注意事項

### APIキーの管理
- Gemini APIキーとGoogle Client IDは、**ブラウザのlocalStorageに保存**されます
- 各ユーザーが自分で設定する必要があります
- サーバー側で管理する場合は、環境変数を使用してください

### セキュリティ
- APIキーはクライアント側に保存されるため、**公開リポジトリにAPIキーをコミットしないでください**
- 現在の実装では、ユーザーが各自でAPIキーを設定する方式になっているため問題ありません

---

## 推奨デプロイ方法

**Vercel** を推奨します。理由：
- 設定が最も簡単
- 自動デプロイが便利
- 無料プランで十分
- 高速で安定している


