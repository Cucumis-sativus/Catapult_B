# スピーチ練習アプリ(仮称)

マイク音声の文字起こしから話す速さ(文字/分)を計測して観客の反応で伝え、台本がある場合は練習後に一致度を示す Web アプリ。

- 要求定義書: [docs/要求定義書.md](docs/要求定義書.md)
- 要件定義書: [docs/要件定義書.md](docs/要件定義書.md)(命名・フォルダ構成・型は **8章** に従う)

## 環境構築

必要なもの: Node.js 24(バージョン管理ツール fnm で入れる)、Git、VS Code、Chrome または Edge

### 1. fnm と Node.js 24 を入れる

Windows(PowerShell):

```powershell
winget install Schniz.fnm
# PowerShell のプロファイルに次の1行を追記して、PowerShell を開き直す
#   fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm install 24
fnm default 24
node -v   # v24.x.x と出ればよい
```

WSL / Mac / Linux:

```bash
curl -fsSL https://fnm.vercel.app/install | bash
# ターミナルを開き直してから
fnm install 24
fnm default 24
```

### 2. リポジトリを取得して起動する

```bash
git clone https://github.com/Cucumis-sativus/Catapult_B.git
cd Catapult_B
npm ci          # npm install ではなく npm ci(package-lock.json どおりに入れる)
npm run dev
```

表示された `http://localhost:5173` を **Chrome か Edge** で開く。マイクは `localhost` か https でしか使えない。

### 3. VS Code

フォルダを開くと、おすすめ拡張機能(ESLint、Prettier、Vitest)のインストールを勧められるので入れる。保存すると自動で整形される。

> WSL を使う場合は、リポジトリを `/mnt/c/...` ではなく WSL 側(`~/` の下)に置く。Windows 側に置くとホットリロードが効きにくい。

## よく使うコマンド

| コマンド             | 内容                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `npm run dev`        | 開発サーバーを起動する                                                     |
| `npm test`           | 単体テストを実行する(Vitest)                                               |
| `npm run test:watch` | ファイルを保存するたびにテストを実行する                                   |
| `npm run lint`       | ESLint でチェックする                                                      |
| `npm run format`     | Prettier で全ファイルを整形する                                            |
| `npm run build`      | 型チェックをして `dist/` に本番用ファイルを作る                            |
| `npm run check`      | lint・整形・テスト・ビルドをまとめて確認する(プルリクエストを出す前に実行) |

## フォルダ構成

要件定義書 8.2 のとおり(たたき台で足したものは要件定義書に「(たたき台で追加)」と書いてある)。

- **画面(`screens/`)は完成している。** 5.1 の項目、5.2 の遷移、5.3 のエラー表示がそろっていて、8.5 の関数を呼んでいる
- **8.5 の関数の中身は空。** 画面を最後まで操作できるよう仮の値(0、空の配列など)を返していて、`// TODO(F-xx): 未実装` と書いてある。担当者はここを実装する

```text
src/
  main.ts                     起動処理と画面の切り替え
  constants.ts                定数(8.3)とエラーメッセージ(5.3)。【未決定】の値は仮値
  types.ts                    型(8.4)
  appState.ts                 画面をまたいで受け渡すデータ(モード、台本、結果)
  data/presetScripts.ts       内蔵のお題文
  speech/speechRecognizer.ts  音声認識(F-03)
  analysis/                   速さの計算・判定、一致度の計算(F-04, F-06)
  audience/audienceView.ts    観客スプライトの表示(F-05)
  session/                    台本の設定、練習の開始・終了(F-01, F-02, F-07)
  storage/historyStore.ts     履歴(F-08, F-09)
  screens/                    5つの画面。render〇〇Screen(container, showScreen) を main.ts から呼ぶ
    screenParts.ts            ボタン、エラー表示、練習の開始など画面で共通に使う部品
public/sprites/               観客の画像3枚(今は仮の単色画像。絵の担当が差し替える)
```

AI コーディングツールを使う場合のルールは [AGENTS.md](AGENTS.md) にある。Claude Code は `CLAUDE.md` から同じ内容を読む。

単体テストは対象ファイルの隣に `〇〇.test.ts` として置く。要件定義書 10.2 の T-01〜T-07 は `it.todo` として書いてあるので、実装したら `it` に書き換える。

## Git の運用(仮案。チームで決まったら書き換える)

1. `main` に直接コミットしない
2. `feature/機能ID-内容` のブランチを作る(例: `feature/F-04-speed-calculator`)
3. `npm run check` が通ることを確かめてからプルリクエストを出す
4. GitHub Actions(CI)で lint・テスト・ビルドが自動で走る。通らないものはマージしない

```bash
git switch main
git pull
git switch -c feature/F-04-speed-calculator
# … 作業 …
git add .
git commit -m "F-04: 文字数のカウントを実装"
git push -u origin feature/F-04-speed-calculator
# GitHub でプルリクエストを作る
```
