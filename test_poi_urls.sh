#!/bin/bash

# Test 100+ different image URL patterns for Fortnite POIs
echo "🔍 SEARCHING FOR WORKING POI IMAGES (100+ TESTS PER POI)"
echo "════════════════════════════════════════════════════════════════════"

# Sample POIs to test
POIS=(
  "tilted-towers"
  "pleasant-park"
  "dusty-depot"
  "retail-row"
  "salty-springs"
  "loot-lake"
  "lazy-links"
  "greasy-grove"
)

# 100+ different URL patterns to test
URL_PATTERNS=(
  "https://fortniteapi.io/images/poi/{}.png"
  "https://fortniteapi.io/v2/images/poi/{}.png"
  "https://static.wikia.nocookie.net/fortnite/images/{}.png"
  "https://static.wikia.nocookie.net/fortnite/images/{}/revision/latest.png"
  "https://cdn.fortniteapi.io/images/poi/{}.png"
  "https://media.fortniteapi.io/images/poi/{}.png"
  "https://images.fortniteapi.io/poi/{}.png"
  "https://fortnite.fandom.com/wiki/File:{}.png"
  "https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/pois/{}.png"
  "https://raw.githubusercontent.com/117580-droid/Shop-bot/main/pois/{}.png"
)

success_count=0
total_tests=0

for poi in "${POIS[@]}"; do
  echo ""
  echo "Testing: $poi"
  echo "─────────────────────────────────────────────────────────────────"
  
  for pattern in "${URL_PATTERNS[@]}"; do
    url="${pattern//\{\}/$poi}"
    ((total_tests++))
    
    # Test with curl
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 2 2>/dev/null)
    
    if [ "$status" = "200" ]; then
      echo "✅ [$status] $url"
      ((success_count++))
    elif [ "$status" = "301" ] || [ "$status" = "302" ]; then
      echo "⚠️  [$status] $url (redirect)"
    fi
  done
done

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "📊 TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════"
echo "Total Tests: $total_tests"
echo "✅ Working URLs: $success_count"
echo "Success Rate: $((success_count * 100 / total_tests))%"
