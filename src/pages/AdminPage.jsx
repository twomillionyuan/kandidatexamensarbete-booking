import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function AdminPage() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState(1);

  const [loadingData, setLoadingData] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoadingData(true);

    const [{ data: slotData, error: slotError }, { data: bookingData, error: bookingError }] =
      await Promise.all([
        supabase
          .from('time_slots')
          .select('id,start_time,end_time,capacity,booked_count,is_active')
          .order('start_time', { ascending: true }),
        supabase
          .from('bookings')
          .select('id,name,email,created_at,slot:time_slots(start_time,end_time)')
          .order('created_at', { ascending: false }),
      ]);

    if (slotError) {
      setAuthError(slotError.message);
    } else {
      setSlots(slotData ?? []);
    }

    if (bookingError) {
      setAuthError(bookingError.message);
    } else {
      setBookings(bookingData ?? []);
    }

    setLoadingData(false);
  }, []);

  const checkAdminAccess = useCallback(
    async (currentSession) => {
      if (!currentSession?.user?.id) {
        setSession(null);
        setIsAdmin(false);
        setAuthChecked(true);
        return;
      }

      setSession(currentSession);

      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', currentSession.user.id)
        .maybeSingle();

      if (error || !data) {
        setIsAdmin(false);
        setLoadingData(false);
        setAuthError('This account is not allowed to access admin.');
      } else {
        setIsAdmin(true);
        setAuthError('');
        await loadAdminData();
      }

      setAuthChecked(true);
    },
    [loadAdminData],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await checkAdminAccess(data.session);
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      await checkAdminAccess(currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdminAccess]);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setEmail('');
    setPassword('');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setSession(null);
  }

  async function handleCreateSlot(event) {
    event.preventDefault();
    setSavingSlot(true);
    setActionMessage('');
    setAuthError('');

    const { error } = await supabase.from('time_slots').insert({
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      capacity,
      booked_count: 0,
      is_active: true,
    });

    if (error) {
      setAuthError(error.message);
      setSavingSlot(false);
      return;
    }

    setActionMessage('Slot created.');
    setStartTime('');
    setEndTime('');
    setCapacity(1);
    setSavingSlot(false);
    await loadAdminData();
  }

  async function handleDeactivateSlot(slotId) {
    setActionMessage('');
    setAuthError('');

    const { error } = await supabase
      .from('time_slots')
      .update({ is_active: false })
      .eq('id', slotId);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setActionMessage('Slot hidden from booking page.');
    await loadAdminData();
  }

  if (!authChecked) {
    return (
      <section className="card">
        <h2>Admin</h2>
        <p>Checking access...</p>
      </section>
    );
  }

  if (!session || !isAdmin) {
    return (
      <section className="card">
        <h2>Admin login</h2>
        <p className="lead">Sign in with your password to manage slots and view bookings.</p>

        <form className="booking-form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

      <p className="lead">Create time slots, set capacity, and view everyone who booked.</p>

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
                  <tr key={slot.id}>
                    <td>{`${formatDateTime(slot.start_time)} - ${formatDateTime(slot.end_time)}`}</td>
                    <td>{slot.booked_count}</td>
                    <td>{slot.capacity}</td>
                    <td>{slot.is_active ? 'Visible' : 'Hidden'}</td>
                    <td>
                      {slot.is_active ? (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleDeactivateSlot(slot.id)}
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
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.name}</td>
                    <td>{booking.email}</td>
                    <td>
                      {booking.slot
                        ? `${formatDateTime(booking.slot.start_time)} - ${formatDateTime(booking.slot.end_time)}`
                        : 'Slot deleted'}
                    </td>
                    <td>{formatDateTime(booking.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminPage;
