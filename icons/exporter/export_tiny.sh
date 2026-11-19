#!/bin/zsh
# Exports the dumped icon comps with TinyPNG. Run it in Terminal:  ./export_tiny.sh
# It asks for your TinyPNG API key (typing is hidden); the key lives only in this process and is never written anywhere.
# Already set TINIFY_KEY in your environment? Then it uses that and doesn't ask.
cd "$(dirname "$0")" || exit 1
if [[ -z "$TINIFY_KEY" || "$TINIFY_KEY" == *your-key* || "$TINIFY_KEY" == paste-* ]]; then
  if [[ ! -t 0 ]]; then
    echo "Run this in a Terminal window so it can ask for your TinyPNG key: $(pwd)/export_tiny.sh"; exit 1
  fi
  printf "TinyPNG API key (from tinypng.com/dashboard/api, hidden): "
  read -rs TINIFY_KEY; echo
fi
TINIFY_KEY="$TINIFY_KEY" python3 convert_icons.py "$@"
