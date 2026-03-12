import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  couchConfigError,
  createSlot,
  createSlotsFromRange,
  fetchAllSlots,
  fetchBookings,
  hideSlot,
} from '../lib/couchdb';
import { formatDateTimeLabel, formatSlotLabel } from '../lib/dateFormat';

const ADMIN_PASSWORD = 'admin';
const ADMIN_FLAG = 'kandidatexamensarbete_admin_unlocked';

function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem(ADMIN_FLAG) === '1');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [slotLengthMinutes, setSlotLengthMinutes] = useState(30);
  const [rangeCapacity, setRangeCapacity] = useState(1);

  const [loadingData, setLoadingData] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const slotMap = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => map.set(slot._id, slot));
    return map;
  }, [slots]);

  const loadAdminData = useCallback(async () => {
    setLoadingData(true);

    try {
      const [slotData, bookingData] = await Promise.all([fetchAllSlots(), fetchBookings()]);
      setSlots(slotData);
      setBookings(bookingData);
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || couchConfigError);
    }

    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const timer = setTimeout(() => {
      loadAdminData();
    }, 0);

    return () => clearTimeout(timer);
  }, [isAdmin, loadAdminData]);

  function handleLogin(event) {
    event.preventDefault();

    if (password.trim() !== ADMIN_PASSWORD) {
      setAuthError('Wrong password.');
      return;
    }

    localStorage.setItem(ADMIN_FLAG, '1');
    setIsAdmin(true);
    setPassword('');
    setAuthError('');
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_FLAG);
    setIsAdmin(false);
    setSlots([]);
    setBookings([]);
    setActionMessage('');
  }

  async function handleCreateSlot(event) {
    event.preventDefault();
    setSavingSlot(true);
    setActionMessage('');
    setAuthError('');

    try {
      await createSlot({
        startTime,
        endTime,
        capacity,
      });
      setActionMessage('Slot created.');
      setStartTime('');
      setEndTime('');
      setCapacity(1);
      await loadAdminData();
    } catch (error) {
      setAuthError(error.message || 'Could not create slot.');
    }

    setSavingSlot(false);
  }

  async function handleDeactivateSlot(slotId) {
    setActionMessage('');
    setAuthError('');

    try {
      await hideSlot(slotId);
      setActionMessage('Slot hidden from booking page.');
      await loadAdminData();
    } catch (error) {
      setAuthError(error.message || 'Could not hide slot.');
    }
  }

  async function handleGenerateSlots(event) {
    event.preventDefault();
    setGeneratingSlots(true);
    setActionMessage('');
    setAuthError('');

    try {
      const createdCount = await createSlotsFromRange({
        rangeStart,
        rangeEnd,
        slotLengthMinutes,
        capacity: rangeCapacity,
      });
      setActionMessage(`Created ${createdCount} slot(s).`);
      await loadAdminData();
    } catch (error) {
      setAuthError(error.message || 'Could not generate slots.');
    }

    setGeneratingSlots(false);
  }

  if (!isAdmin) {
    return (
      <section className="card">
        <h2>Admin login</h2>
        <p className="lead">Enter the admin password to manage slots and view bookings.</p>

        <form className="booking-form" onSubmit={handleLogin}>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter admin password"
            />
          </label>
          <button type="submit">Sign in</button>
        </form>

        {authError && <p className="error">{authError}</p>}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="admin-header">
        <h2>Admin dashboard</h2>
        <button type="button" className="secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <p className="lead">Create time slots, generate many at once, and view everyone who booked.</p>

      <form className="slot-form" onSubmit={handleCreateSlot}>
        <label>
          Start time
          <input
            type="datetime-local"
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label>
          End time
          <input
            type="datetime-local"
            required
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>
        <label>
          Capacity
          <input
            type="number"
            min="1"
            max="20"
            required
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </label>
        <button type="submit" disabled={savingSlot}>
          {savingSlot ? 'Saving...' : 'Create slot'}
        </button>
      </form>

      <h3>Auto-generate slots</h3>
      <p className="lead form-note">
        Pick a timeframe and slot length. The app creates all full slots that fit inside it.
      </p>
      <form className="slot-form" onSubmit={handleGenerateSlots}>
        <label>
          Range start
          <input
            type="datetime-local"
            required
            value={rangeStart}
            onChange={(event) => setRangeStart(event.target.value)}
          />
        </label>
        <label>
          Range end
          <input
            type="datetime-local"
            required
            value={rangeEnd}
            onChange={(event) => setRangeEnd(event.target.value)}
          />
        </label>
        <label>
          Slot length (minutes)
          <input
            type="number"
            min="1"
            max="240"
            required
            value={slotLengthMinutes}
            onChange={(event) => setSlotLengthMinutes(Number(event.target.value))}
          />
        </label>
        <label>
          Capacity per slot
          <input
            type="number"
            min="1"
            max="20"
            required
            value={rangeCapacity}
            onChange={(event) => setRangeCapacity(Number(event.target.value))}
          />
        </label>
        <button type="submit" disabled={generatingSlots}>
          {generatingSlots ? 'Generating...' : 'Generate slots'}
        </button>
      </form>

      {actionMessage && <p className="success">{actionMessage}</p>}
      {authError && <p className="error">{authError}</p>}

      {loadingData ? (
        <p>Loading admin data...</p>
      ) : (
        <>
          <h3>All slots</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Booked</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot._id}>
                    <td>{formatSlotLabel(slot.start_time, slot.end_time)}</td>
                    <td>{slot.booked_count}</td>
                    <td>{slot.capacity}</td>
                    <td>{slot.is_active ? 'Visible' : 'Hidden'}</td>
                    <td>
                      {slot.is_active ? (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleDeactivateSlot(slot._id)}
                        >
                          Hide
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Bookings</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Slot</th>
                  <th>Booked at</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const slot = slotMap.get(booking.slot_id);

                  return (
                    <tr key={booking._id}>
                      <td>{booking.name}</td>
                      <td>{booking.email}</td>
                      <td>
                        {slot
                          ? formatSlotLabel(slot.start_time, slot.end_time)
                          : 'Slot missing'}
                      </td>
                      <td>{formatDateTimeLabel(booking.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminPage;
