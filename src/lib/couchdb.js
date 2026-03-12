const DEFAULT_COUCHDB_URL = 'https://ebba-pageturnercouch.apache-couchdb.auto.prod.osaas.io';
const DEFAULT_COUCHDB_DB = 'kandidatebooking';

const baseUrlRaw = import.meta.env.VITE_COUCHDB_URL || DEFAULT_COUCHDB_URL;
const dbName = import.meta.env.VITE_COUCHDB_DB || DEFAULT_COUCHDB_DB;
const baseUrl = baseUrlRaw.replace(/\/$/, '');
const dbUrl = `${baseUrl}/${encodeURIComponent(dbName)}`;

const hasConfig = Boolean(baseUrl && dbName);
export const couchConfigError = hasConfig
  ? ''
  : 'Missing CouchDB config. Set VITE_COUCHDB_URL and VITE_COUCHDB_DB.';

if (!hasConfig) {
  console.warn(couchConfigError);
}

function getErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (payload.reason) return payload.reason;
  if (payload.error) return payload.error;
  return fallback;
}

function isConflictError(error) {
  return String(error?.message ?? '').toLowerCase().includes('conflict');
}

async function couchRequest(path = '', options = {}) {
  if (!hasConfig) {
    throw new Error(couchConfigError);
  }

  const response = await fetch(`${dbUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `CouchDB request failed (${response.status})`));
  }

  return payload;
}

let indexesPromise = null;

async function ensureIndexes() {
  if (indexesPromise) return indexesPromise;

  indexesPromise = Promise.all([
    couchRequest('/_index', {
      method: 'POST',
      body: JSON.stringify({
        index: { fields: ['type', 'is_active', 'start_time'] },
        name: 'idx_type_active_start',
        type: 'json',
      }),
    }),
    couchRequest('/_index', {
      method: 'POST',
      body: JSON.stringify({
        index: { fields: ['type', 'created_at'] },
        name: 'idx_type_created_at',
        type: 'json',
      }),
    }),
  ]).catch((error) => {
    indexesPromise = null;
    throw error;
  });

  return indexesPromise;
}

function sortByStart(a, b) {
  return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
}

function sortByCreatedDesc(a, b) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emailKey(email) {
  return email.toLowerCase().replace(/[^a-z0-9]/gi, '_');
}

async function getDoc(id) {
  return couchRequest(`/${encodeURIComponent(id)}`);
}

async function putDoc(doc) {
  return couchRequest(`/${encodeURIComponent(doc._id)}`, {
    method: 'PUT',
    body: JSON.stringify(doc),
  });
}

async function decrementSlotCount(slotId) {
  for (let attempts = 0; attempts < 4; attempts += 1) {
    const slotDoc = await getDoc(slotId);

    if ((slotDoc.booked_count ?? 0) <= 0) {
      return;
    }

    try {
      await putDoc({
        ...slotDoc,
        booked_count: Math.max((slotDoc.booked_count ?? 0) - 1, 0),
        updated_at: new Date().toISOString(),
      });
      return;
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }
    }
  }
}

export async function fetchActiveSlots() {
  await ensureIndexes();

  const result = await couchRequest('/_find', {
    method: 'POST',
    body: JSON.stringify({
      selector: { type: 'slot', is_active: true },
      limit: 500,
    }),
  });

  return (result.docs ?? []).sort(sortByStart);
}

export async function fetchAllSlots() {
  await ensureIndexes();

  const result = await couchRequest('/_find', {
    method: 'POST',
    body: JSON.stringify({
      selector: { type: 'slot' },
      limit: 1000,
    }),
  });

  return (result.docs ?? []).sort(sortByStart);
}

export async function fetchBookings() {
  await ensureIndexes();

  const result = await couchRequest('/_find', {
    method: 'POST',
    body: JSON.stringify({
      selector: { type: 'booking' },
      limit: 2000,
    }),
  });

  return (result.docs ?? []).sort(sortByCreatedDesc);
}

export async function createSlot({ startTime, endTime, capacity }) {
  const slotDoc = {
    _id: `slot:${randomId()}`,
    type: 'slot',
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString(),
    capacity: Number(capacity),
    booked_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  await putDoc(slotDoc);
}

export async function hideSlot(slotId) {
  for (let attempts = 0; attempts < 4; attempts += 1) {
    const slotDoc = await getDoc(slotId);

    try {
      await putDoc({
        ...slotDoc,
        is_active: false,
        updated_at: new Date().toISOString(),
      });
      return;
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }
    }
  }

  throw new Error('Could not update slot. Please try again.');
}

export async function createBooking({ slotId, name, email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const bookingId = `booking:${slotId}:${emailKey(normalizedEmail)}`;

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const slotDoc = await getDoc(slotId);

    if (!slotDoc.is_active) {
      throw new Error('This slot is no longer available');
    }

    if ((slotDoc.booked_count ?? 0) >= slotDoc.capacity) {
      throw new Error('This slot is already full');
    }

    try {
      await putDoc({
        ...slotDoc,
        booked_count: (slotDoc.booked_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      if (isConflictError(error)) {
        continue;
      }
      throw error;
    }

    try {
      await putDoc({
        _id: bookingId,
        type: 'booking',
        slot_id: slotId,
        name: name.trim(),
        email: normalizedEmail,
        created_at: new Date().toISOString(),
      });

      return;
    } catch (error) {
      await decrementSlotCount(slotId);

      if (isConflictError(error)) {
        throw new Error('You have already booked this slot with this email.');
      }

      throw error;
    }
  }

  throw new Error('Slot updated by someone else. Please try again.');
}
