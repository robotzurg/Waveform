// reviewStore.js
const BASE = 'https://api.waveformreviews.net';
const DEV_BASE = 'http://localhost:3000';

export const songDB = {
  async get(artist, song) {
    const res = await fetch(`${DEV_BASE}/api/songs?artist=${encodeURIComponent(artist)}&name=${encodeURIComponent(song)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};
