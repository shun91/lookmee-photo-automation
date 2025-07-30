#!/bin/bash

set -e  # エラーが発生したら即座に終了

# スクリプトの概要
echo "=== Batch Make Diff Album Script ==="
echo "24年1月から25年2月までのmakeDiffAlbumを順次実行します"
echo

# 期間を生成する関数
generate_periods() {
    local periods=()
    
    # 2024年1月〜12月
    for month in $(seq 1 12); do
        local month_str=$(printf "%02d" $month)
        periods+=("lookmee24${month_str}h")
        periods+=("lookmee24${month_str}t")
    done
    
    # 2025年1月〜2月
    for month in $(seq 1 2); do
        local month_str=$(printf "%02d" $month)
        periods+=("lookmee25${month_str}h")
        periods+=("lookmee25${month_str}t")
    done
    
    echo "${periods[@]}"
}

# 実行統計を初期化
TOTAL_COUNT=0
SUCCESS_COUNT=0
FAILURE_COUNT=0
FAILED_PERIODS=()

# 各期間のmakeDiffAlbumを実行
echo "実行開始..."
echo

periods=($(generate_periods))

for period in "${periods[@]}"; do
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    echo "[$TOTAL_COUNT/${#periods[@]}] Processing: $period"
    
    if yarn makeDiffAlbum "$period"; then
        echo "✓ 成功: $period"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "✗ 失敗: $period"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        FAILED_PERIODS+=("$period")
    fi
    
    echo "----------------------------------------"
done

# 結果の表示
echo
echo "=== 実行結果 ==="
echo "総件数: $TOTAL_COUNT"
echo "成功: $SUCCESS_COUNT"
echo "失敗: $FAILURE_COUNT"

if [ $FAILURE_COUNT -gt 0 ]; then
    echo
    echo "失敗した期間:"
    for failed_period in "${FAILED_PERIODS[@]}"; do
        echo "  - $failed_period"
    done
    echo
    echo "⚠️  一部の処理が失敗しました"
    exit 1
else
    echo
    echo "🎉 すべての処理が正常に完了しました"
    exit 0
fi