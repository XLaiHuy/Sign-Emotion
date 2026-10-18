#!/bin/sh
set -eu

# Fixed public model roots only. Never enumerate fixtures, vaults or transcripts.
root=/usr/share/nginx/html
destination=/tmp/signemo-immutable-assets.map
temporary=/tmp/signemo-immutable-assets.map.new
{
  printf 'map $uri $signemo_immutable_asset {\n    default 0;\n'
  for namespace in models runtime research/gipformer research/emotieff-b0 research/runtime-ort-gpu; do
    directory="$root/$namespace"
    [ -d "$directory" ] || continue
    find "$directory" -type f | LC_ALL=C sort | while IFS= read -r file; do
      relative=${file#"$root"}
      # Restrict config tokens, not shell-escape arbitrary filesystem names.
      case "$relative" in
        *[!A-Za-z0-9_./-]*|*/../*|*/./*|*/..|*/.) continue ;;
      esac
      checksum=$(sha256sum "$file")
      checksum=${checksum%% *}
      printf '%s' "$checksum" | grep -Eq '^[a-f0-9]{64}$'
      printf '    "/immutable/%s%s" 1;\n' "$checksum" "$relative"
    done
  done
  printf '}\n'
} > "$temporary"
mv "$temporary" "$destination"
printf 'Prepared content-addressed public model routes.\n'
