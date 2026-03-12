import { useEffect, useMemo, useState } from 'react';
import { couchConfigError, createBooking, fetchActiveSlots } from '../lib/couchdb';
import { formatSlotLabel } from '../lib/dateFormat';

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

    const currentStillAvailable = availableSlots.some((slot) => slot._id === selectedSlotId);
    return currentStillAvailable ? selectedSlotId : availableSlots[0]._id;
  }, [availableSlots, selectedSlotId]);

  async function loadSlots() {
    try {
      const data = await fetchActiveSlots();
      setSlots(data);
      setError('');
    } catch (loadError) {
      setSlots([]);
      setError(loadError.message || couchConfigError);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      try {
        const data = await fetchActiveSlots();
        if (!mounted) return;
        setSlots(data);
        setError('');
      } catch (loadError) {
        if (!mounted) return;
        setSlots([]);
        setError(loadError.message || couchConfigError);
      }

      if (mounted) {
        setFetching(false);
      }
    }

    initialLoad();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleBooking(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await createBooking({
        slotId: effectiveSelectedSlotId,
        name,
        email,
      });

      setMessage('Booked! We saved your slot.');
      setName('');
      setEmail('');
      setFetching(true);
      await loadSlots();
    } catch (bookingError) {
      setError(bookingError.message || 'Could not complete booking.');
    }

    setLoading(false);
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
                  key={slot._id}
                  type="button"
                  className={`slot-chip ${effectiveSelectedSlotId === slot._id ? 'active' : ''}`}
                  onClick={() => setSelectedSlotId(slot._id)}
                >
                  <span>{formatSlotLabel(slot.start_time, slot.end_time)}</span>
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
