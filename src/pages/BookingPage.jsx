import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigError } from '../lib/supabase';

function formatTimeRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleString()} - ${endDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function BookingPage() {
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.capacity - slot.booked_count > 0),
    [slots],
  );
  const effectiveSelectedSlotId = useMemo(() => {
    if (!availableSlots.length) return '';

    const currentStillAvailable = availableSlots.some((slot) => slot.id === selectedSlotId);
    return currentStillAvailable ? selectedSlotId : availableSlots[0].id;
  }, [availableSlots, selectedSlotId]);

  async function loadSlots() {
    if (!supabase) {
      setError(supabaseConfigError);
      setSlots([]);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('time_slots')
      .select('id,start_time,end_time,capacity,booked_count,is_active')
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setSlots([]);
    } else {
      setError('');
      setSlots(data ?? []);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      if (!supabase) {
        setError(supabaseConfigError);
        setSlots([]);
        setFetching(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('time_slots')
        .select('id,start_time,end_time,capacity,booked_count,is_active')
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (!mounted) return;

      if (queryError) {
        setError(queryError.message);
        setSlots([]);
      } else {
        setError('');
        setSlots(data ?? []);
      }
      setFetching(false);
    }

    initialLoad();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleBooking(event) {
    event.preventDefault();
    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');

    const { error: insertError } = await supabase.from('bookings').insert({
      slot_id: effectiveSelectedSlotId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setMessage('Booked! We saved your slot.');
    setName('');
    setEmail('');
    setLoading(false);
    setFetching(true);
    await loadSlots();
    setFetching(false);
  }

  return (
    <section className="card">
      <h2>Book a supervision slot</h2>
      <p className="lead">
        Pick an available time with Ebba + Vanessa for the kandidatexamensarbete.
      </p>

      {fetching && <p>Loading available times...</p>}

      {!fetching && !availableSlots.length && (
        <p className="empty-state">No available slots right now. Please check back soon.</p>
      )}

      {!!availableSlots.length && (
        <>
          <div className="slot-grid">
            {availableSlots.map((slot) => {
              const remaining = slot.capacity - slot.booked_count;
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`slot-chip ${effectiveSelectedSlotId === slot.id ? 'active' : ''}`}
                  onClick={() => setSelectedSlotId(slot.id)}
                >
                  <span>{formatTimeRange(slot.start_time, slot.end_time)}</span>
                  <strong>{remaining} spot(s) left</strong>
                </button>
              );
            })}
          </div>

          <form className="booking-form" onSubmit={handleBooking}>
            <label>
              Name
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
              />
            </label>
            <button type="submit" disabled={loading || !effectiveSelectedSlotId}>
              {loading ? 'Booking...' : 'Book this slot'}
            </button>
          </form>
        </>
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default BookingPage;
