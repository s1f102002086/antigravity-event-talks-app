# BigQuery Release Pulse

Google Cloud BigQuery の公式リリースノートをパースし、美しく一覧表示・検索・フィルターできる、ダークテーマ仕様のモダンな Web アプリケーションです。特定の更新内容を選択して、X (旧 Twitter) に即座にポストできるエディタ機能も搭載しています。

---

## 🚀 主な機能

### 1. サーバーサイド (Python Flask)
* **Atomフィード自動取得**: Google Cloud の BigQuery 公式リリースノートフィード (XML) を取得・パース。
* **インメモリキャッシュ**: フィードサーバーへの負荷を抑え、高速レスポンスを実現するデータキャッシュ。
* **手動更新 (リフレッシュ)**: キャッシュを破棄し、いつでも最新データを再同期可能。

### 2. クライアントサイド (Vanilla HTML, CSS, JavaScript)
* **更新情報の詳細分割**: 日付ごとにまとまっているリリース文を `<h3>` タグで自動分割し、一件ずつのカード形式で表示。
* **カテゴリー分類**: 内容から自動的に `Feature` (機能追加), `Issue` (不具合/制限), `Change` (変更/更新), `Deprecated` (非推奨) 等のバッジを付与。
* **リアルタイム検索 & フィルター**: テキスト入力やカテゴリー選択ボタンで、瞬時にカードを絞り込み。
* **統計ダッシュボード**: 取得したカードデータから、新機能数やバグ修正数などをリアルタイムに自動集計。
* **X (Twitter) 投稿カスタマイザー**: 
  * 実際の X 投稿を模したプレビューエディタ。
  * 280文字の制限数を追従するインタラクティブな文字数カウンターおよびカラーサークル。
  * クリップボードコピー & 自動下書き遷移。

---

## 🛠️ 技術スタック

* **Backend**: Python 3.12, Flask 3.1
* **Frontend**: Vanilla HTML5, Vanilla CSS3 (CSSカスタム変数、ガラスモーフィズム、トランジションアニメーション), Vanilla JavaScript (DOMParser)

---

## 📂 ディレクトリ構成

```text
bq-releases-notes/
├── app.py                  # Flaskサーバーサイドアプリケーション
├── templates/
│   └── index.html          # メインHTML5テンプレート
├── static/
│   ├── css/
│   │   └── style.css       # スタイルシート（グラスモーフィズムデザイン）
│   └── js/
│       └── main.js         # クライアントサイドロジック（UI制御・パース・X連携）
├── .gitignore              # Gitコミット除外設定ファイル
└── README.md               # プロジェクト説明書 (本ファイル)
```

---

## 💻 セットアップと起動方法

### 1. 依存ライブラリのインストール
Python がインストールされている環境で、以下のコマンドを実行し Flask と requests をインストールします。

```bash
pip install flask requests
```

> **注意 (Debian/Ubuntu環境等)**:  
> システムのPython環境が「externally-managed-environment」と判定される場合は、`--break-system-packages` フラグを付与して実行してください。
> ```bash
> pip install --user --break-system-packages flask requests
> ```

### 2. Webサーバーの起動
プロジェクトのルートディレクトリで、`app.py` を実行します。

```bash
python app.py
```

### 3. ブラウザでアクセス
起動後、ブラウザで以下のURLにアクセスします。
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🔄 システム連携フロー

1. アプリを起動すると、クライアントサイドが `GET /api/releases` エンドポイントを叩きます。
2. サーバーサイドが Google Cloud の最新フィード（XML）を読み込んで JSON を組み立てて返却します。
3. クライアントの JavaScript が HTML 内のテキストをスライスし、表示・検索・共有機能を提供します。
4. 各更新情報の「Tweet」ボタンから X 投稿用の Web Intent (`https://twitter.com/intent/tweet?text=...`) を呼び出して共有をスムーズにします。
