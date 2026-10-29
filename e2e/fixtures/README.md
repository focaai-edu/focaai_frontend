# Fixtures do e2e (#11)

- `face.jpg` — recorte 640×480 do retrato oficial de Barack Obama (Pete Souza, Casa Branca, 2012), obra do governo dos EUA em **domínio público**. Origem: https://commons.wikimedia.org/wiki/File:President_Barack_Obama.jpg
- Os clipes `.y4m` são gerados no `globalSetup` em `e2e/.cache/` (fora do git): `yuv420p`, 640×480, 15 fps. Um `.y4m` pesa ~6,9 MB/s; por isso só a foto (e, no futuro, `.mp4` pequenos) vão para o git.
- Clipes reais (virar, baixo, olhos) chegam como `.mp4` gravados pelo dono; o roteiro está na issue #11.
