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

async function ensureIndexes() {
  // Indexes are managed server-side on CouchDB; clients should not create design docs.
  return Promise.resolve();
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

function parseIsoDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return date;
}

function normalizeCapacity(capacity) {
  const parsed = Number(capacity);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Capacity must be at least 1');
  }
  return parsed;
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
  const startDate = parseIsoDate(startTime, 'start time');
  const endDate = parseIsoDate(endTime, 'end time');
  const normalizedCapacity = normalizeCapacity(capacity);

  if (endDate <= startDate) {
    throw new Error('End time must be after start time');
  }

  const slotDoc = {
    _id: `slot:${randomId()}`,
    type: 'slot',
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    capacity: normalizedCapacity,
    booked_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  await putDoc(slotDoc);
}

export async function createSlotsFromRange({ rangeStart, rangeEnd, slotLengthMinutes, capacity }) {
  const startDate = parseIsoDate(rangeStart, 'range start');
  const endDate = parseIsoDate(rangeEnd, 'range end');
  const normalizedCapacity = normalizeCapacity(capacity);

  const slotMinutes = Number(slotLengthMinutes);
  if (!Number.isInteger(slotMinutes) || slotMinutes < 1) {
    throw new Error('Slot length must be at least 1 minute');
  }

  if (endDate <= startDate) {
    throw new Error('Range end must be after range start');
  }

  const slotLengthMs = slotMinutes * 60 * 1000;
  const availableMs = endDate.getTime() - startDate.getTime();
  const slotCount = Math.floor(availableMs / slotLengthMs);

  if (slotCount < 1) {
    throw new Error('No slots fit in this time range with that slot length');
  }

  const docs = Array.from({ length: slotCount }, (_value, index) => {
    const slotStart = new Date(startDate.getTime() + index * slotLengthMs);
    const slotEnd = new Date(slotStart.getTime() + slotLengthMs);

    return {
      _id: `slot:${randomId()}`,
      type: 'slot',
      start_time: slotStart.toISOString(),
      end_time: slotEnd.toISOString(),
      capacity: normalizedCapacity,
      booked_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  });

  const result = await couchRequest('/_bulk_docs', {
    method: 'POST',
    body: JSON.stringify({ docs }),
  });

  const failed = (result ?? []).find((entry) => entry.error);
  if (failed) {
    throw new Error(failed.reason || failed.error || 'Failed to create generated slots');
  }

  return slotCount;
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
