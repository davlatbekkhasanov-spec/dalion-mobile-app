Demo ambient clips for GlobusMarket live here.

Seeded playlist (`prisma/seed.js`) writes **PCM WAV** tones if missing:

- `calm-jazz-01.wav` … `calm-jazz-04.wav`

The customer app loads **`/api/v1/ambient-playlist`** first (Postgres `AmbientTrack` rows); the `/uploads/audio/ambient-jazz/*.wav` paths are the fallback when the API returns no usable URLs.

For production MP3s, replace these files and point admin ambient uploads or seed URLs at your preferred assets.
