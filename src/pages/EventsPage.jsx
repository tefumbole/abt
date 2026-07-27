import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { getPublishedEvents } from '@/services/eventsService';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useSiteContent } from '@/hooks/useSiteContent';

const EventsPage = () => {
  const { field } = useSiteContent();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const heroTitle = field(
    'events',
    'hero_title',
    'Upcoming <span class="text-[#D4AF37]">Events</span>'
  );
  const heroSubtitle = field(
    'events',
    'hero_subtitle',
    'Join Alpha Bridge at our next gathering, workshop, or masterclass.'
  );

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getPublishedEvents();
        setEvents(data || []);
      } catch (err) {
        console.error('EventsPage: Error fetching events:', err);
        setError('Failed to load events. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#003D82] mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Events</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {field('events', 'empty_title', 'No events yet')}
          </h2>
          <p className="text-gray-600">
            {field(
              'events',
              'empty_text',
              'Check back soon for upcoming events and programs.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Events & Highlights | Alpha Bridge</title>
        <meta
          name="description"
          content="Discover upcoming events, workshops, and highlights from Alpha Bridge. Join us for networking, training, and technology showcases."
        />
      </Helmet>

      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl md:text-5xl font-bold text-[#003D82] mb-4"
              dangerouslySetInnerHTML={{ __html: heroTitle }}
            />
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {heroSubtitle}
            </p>
          </div>

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group"
              >
                <Card className="h-full overflow-hidden border-2 border-gray-200 hover:border-[#003D82] transition-all duration-300 hover:shadow-xl">
                  {/* Event Image */}
                  <div className="relative h-48 overflow-hidden bg-gray-200">
                    {event.featured_image ? (
                      <img
                        src={event.featured_image}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#003D82] to-[#0066CC]">
                        <Calendar className="w-16 h-16 text-white opacity-50" />
                      </div>
                    )}

                    {/* Date Badge */}
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-[#D4AF37] text-[#003D82] font-bold px-3 py-1">
                        {format(new Date(event.event_date), 'MMM dd')}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    {/* Event Title */}
                    <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-[#003D82] transition-colors">
                      {event.title}
                    </h3>

                    {/* Event Date */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Calendar className="w-4 h-4 text-[#003D82]" />
                      <span>{format(new Date(event.event_date), 'EEEE, MMMM dd, yyyy')}</span>
                    </div>

                    {/* Event Location */}
                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <MapPin className="w-4 h-4 text-[#003D82]" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    )}

                    {/* Event Description */}
                    {event.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {event.description}
                      </p>
                    )}

                    {/* View Details Link */}
                    <div className="flex items-center gap-2 text-[#003D82] font-semibold text-sm group-hover:gap-3 transition-all">
                      <span>View Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default EventsPage;