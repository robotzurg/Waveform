import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.IS_DEV == 'true' ? process.env.DEV_API_URL : process.env.API_URL;

export const genericDB = {
  async getByNames(entity, artist, song) {
    const res = await fetch(`${URL}/api/${entity}?artist=${encodeURIComponent(artist)}&name=${encodeURIComponent(song)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async getById(entity, id) {
    const res = await fetch(`${URL}/api/${entity}/${id}`);
    if (!res.ok) return null;
    return res.json();
  },

  async create(entity, data) {
    const res = await fetch(`${URL}/api/${entity}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
      }),
    });

    if (!res.ok) return null;
    return res.json();
  },

  async update(entity, id, data) {
    const res = await fetch(`${URL}/api/${entity}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(entity, id) {
    const res = await fetch(`${URL}/api/${entity}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) return null;
    return res.json();
  }
};
