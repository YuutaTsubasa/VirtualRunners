#!/usr/bin/env bash
# 監看美術收件匣：有新東西、而且 2 分鐘沒再變動就結束（讓 Claude 醒來處理）。
# 用法：watch-art.sh <repo> <codex 輸出資料夾>
REPO="$1"
CODEX="$2"
STABLE=120      # 秒：檔案多久沒變才算交完
INTERVAL=20
MAX=$((14 * 3600))

snapshot() {
  {
    # 收件匣：留言與交件（不含 README、Claude 自己寫的 replies/requests）
    find "$REPO/art-inbox" -type f \
      ! -path "$REPO/art-inbox/README.md" \
      ! -path "$REPO/art-inbox/replies/*" \
      ! -path "$REPO/art-inbox/requests/*" \
      ! -path "$REPO/art-inbox/wait-for-claude.ps1"       ! -name .seen-by-chatgpt       ! -name .gitkeep -printf '%p %s %T@\n' 2>/dev/null
    # ChatGPT 原本的輸出資料夾：只看最上層的 zip
    find "$CODEX" -maxdepth 1 -type f -name '*.zip' -printf '%p %s %T@\n' 2>/dev/null
  } | sort
}

base="$(snapshot)"
last="$base"
changed_at=0
start=$(date +%s)
echo "開始監看 $(date '+%F %T')"
while true; do
  sleep "$INTERVAL"
  now=$(date +%s)
  cur="$(snapshot)"
  if [ "$cur" != "$last" ]; then
    last="$cur"
    changed_at=$now
  fi
  if [ "$cur" != "$base" ] && [ $changed_at -gt 0 ] && [ $((now - changed_at)) -ge $STABLE ]; then
    echo "有新東西（$(date '+%F %T')）："
    diff <(echo "$base") <(echo "$cur") | grep '^>' | sed 's/^> //'
    exit 0
  fi
  if [ $((now - start)) -ge $MAX ]; then
    echo "監看 14 小時沒有新東西，結束。"
    exit 0
  fi
done
