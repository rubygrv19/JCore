# Dashboard Minimal

Dashboard multi-halaman berbasis Nuxt 4 dengan Nuxt UI, Nuxt Fonts (Inter), Nuxt Icon, Nuxt Image, dan Pinia. Halaman Dashboard dan layanan saat ini berstatus Coming Soon; konfigurasi di Settings hanya tersimpan selama sesi browser. Belum ada API service yang dihubungkan.

Route aplikasi berasal dari `app/pages/`: Dashboard (`/`), Settings (`/settings`), dan service (`/services/:service`). Halaman statis dibuat ke `.output/public`.

## Menjalankan

```bash
pnpm install
pnpm dev
```

Buka alamat lokal yang ditampilkan Nuxt.

## Perintah

- `pnpm dev` — jalankan server pengembangan
- `pnpm build` — buat output statis produksi di `.output/public`
- `pnpm preview` — pratinjau build produksi
- `pnpm typecheck` — periksa tipe TypeScript
- `pnpm lint` — jalankan ESLint
- `pnpm test` — jalankan tes di `test/unit/` dan `test/nuxt/`
